const cheerio = require('cheerio');

// ─── Resilient Fetch Utility ──────────────────────────────────────────────────
async function fetchWithRetry(url, options = {}, retries = 3, baseBackoff = 1000) {
  for (let i = 0; i < retries; i++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); 

    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok && (res.status === 429 || res.status >= 500)) {
        throw new Error(`HTTP ${res.status}`);
      }
      return res; 
    } catch (error) {
      clearTimeout(timeoutId);
      if (i === retries - 1) throw new Error(`Failed after ${retries} attempts: ${error.message}`);
      
      const waitTime = baseBackoff * (i + 1);
      console.log(`  [Network] Error fetching ${url} (${error.message}). Retrying in ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

// ─── Headers & User Agents ────────────────────────────────────────────────────
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15'
];

function getRandomHeaders() {
  return {
    'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Cache-Control': 'max-age=0',
  };
}

function getVariantId(url) {
  try { return new URL(url).searchParams.get('variant') || null; } catch { return null; }
}

// ─── Shopify JSON endpoint ────────────────────────────────────────────────────
async function checkShopifyJson(url) {
  const variantId = getVariantId(url);
  const parsedUrl = new URL(url);
  parsedUrl.search = ''; 
  let base = parsedUrl.toString().replace(/\/$/, '');
  const jsonUrl = base.endsWith('.json') ? base : base + '.json';

  const res = await fetchWithRetry(jsonUrl, { headers: getRandomHeaders() });
  console.log(`  [Checker] JSON endpoint: ${jsonUrl} → HTTP ${res.status}`);
  if (!res.ok) return null;

  const data = await res.json();
  const product = data.product;
  if (!product) { console.log(`  [Checker] No product in JSON response`); return null; }

  const variants = product.variants || [];
  console.log(`  [Checker] Variants: ${variants.length}, First available: ${variants[0]?.available}`);
  const hasAvailableField = variants.some(v => typeof v.available !== 'undefined');
  if (!hasAvailableField) {
    console.log(`  [Checker] JSON missing 'available' field — falling back to HTML`);
    return null;
  }

  if (variantId) {
    const variant = variants.find(v => String(v.id) === String(variantId));
    if (variant) {
      return {
        status: variant.available ? 'in' : 'out',
        title:  `${product.title} — ${variant.title}`,
        detail: variant.available ? `Variant "${variant.title}" in stock` : `Variant "${variant.title}" out of stock`,
        platform: 'shopify'
      };
    }
  }

  const anyAvailable = variants.some(v => v.available === true);
  const totalQty = variants.reduce((s, v) => s + Math.max(0, v.inventory_quantity || 0), 0);

  return {
    status: anyAvailable ? 'in' : 'out',
    title:  product.title,
    detail: anyAvailable
      ? `In stock (${totalQty > 0 ? totalQty + ' units' : 'available'})`
      : `Out of stock — all ${variants.length} variant(s) unavailable`,
    platform: 'shopify'
  };
}

// ─── HTML fetch ───────────────────────────────────────────────────────────────
async function fetchHtml(url) {
  const res = await fetchWithRetry(url, { 
    headers: { ...getRandomHeaders(), Referer: new URL(url).origin } 
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// ─── JSON-LD Schema.org ───────────────────────────────────────────────────────
function checkJsonLd($) {
  let result = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html() || '');
      const items = Array.isArray(data) ? data : [data];

      for (const item of items) {
        const avail = item.availability || item?.offers?.availability || (Array.isArray(item.offers) ? item.offers[0]?.availability : null) || '';
        if (!avail) continue;

        const isIn = avail.includes('InStock');
        const isOut = avail.includes('OutOfStock') || avail.includes('SoldOut') || avail.includes('Discontinued') || avail.includes('InStoreOnly');

        if (isIn)  { result = { status: 'in',  detail: 'In stock (schema.org)'  }; return false; }
        if (isOut) { result = { status: 'out', detail: 'Out of stock (schema.org)' }; return false; }
      }
    } catch (_) {}
  });
  return result;
}

// ─── Shopify HTML parsing ─────────────────────────────────────────────────────
function checkShopifyHtml($, url) {
  const variantId = getVariantId(url);
  let scriptResult = null;

  $('script').each((_, el) => {
    const text = $(el).html() || '';
    if (variantId) {
      const p1 = new RegExp(`"id"\\s*:\\s*${variantId}[^}]*?"available"\\s*:\\s*(true|false)`, 'i');
      const p2 = new RegExp(`"available"\\s*:\\s*(true|false)[^}]*?"id"\\s*:\\s*${variantId}`, 'i');
      if (text.match(p1)) { scriptResult = text.match(p1)[1].toLowerCase() === 'true' ? 'in' : 'out'; return false; }
      if (text.match(p2)) { scriptResult = text.match(p2)[1].toLowerCase() === 'true' ? 'in' : 'out'; return false; }
    } else {
      const m = text.match(/"available"\s*:\s*(true|false)/i);
      if (m) { scriptResult = m[1].toLowerCase() === 'true' ? 'in' : 'out'; return false; }
    }
  });

  if (scriptResult !== null) return { status: scriptResult, detail: scriptResult === 'in' ? 'In stock (script data)' : 'Out of stock (script data)', platform: 'shopify' };

  const cartForm = $('form[action="/cart/add"], form[action*="cart/add"]');
  if (cartForm.length > 0) {
    const btn = cartForm.find('button[type="submit"], button[name="add"]');
    if (btn.length > 0) {
      const disabled = btn.prop('disabled') || btn.attr('disabled') !== undefined || btn.hasClass('disabled') || btn.hasClass('sold-out') || btn.hasClass('soldout');
      if (!disabled) {
        const t = btn.text().trim().toLowerCase();
        if (t.includes('sold out') || t.includes('out of stock') || t.includes('unavailable')) return { status: 'out', detail: `Button says: "${btn.text().trim()}"`, platform: 'shopify' };
        return { status: 'in', detail: `Add to cart: "${btn.text().trim()}"`, platform: 'shopify' };
      }
      return { status: 'out', detail: 'Add to cart button disabled', platform: 'shopify' };
    }
  }

  if ($('.sold-out, .soldout, .product--sold-out').length > 0) return { status: 'out', detail: 'Sold-out class detected', platform: 'shopify' };
  return checkKeywords($, 'shopify');
}

// ─── Sapphire specific ───────────────────────────────────────────────────────
function checkSapphire($) {
  if ($('.sold-out-badge.sold-out, .badge-wrapper.sold-out').length > 0) {
    return { status: 'out', detail: 'Sapphire: Sold out badge detected', platform: 'sapphire' };
  }
  const notifyWrapper = $('.notifyMe-wrapper');
  if (notifyWrapper.length > 0) {
    return notifyWrapper.hasClass('d-none') 
      ? { status: 'in', detail: 'Sapphire: Add to Bag available', platform: 'sapphire' }
      : { status: 'out', detail: 'Sapphire: Notify Me shown — out of stock', platform: 'sapphire' };
  }
  return checkKeywords($, 'sapphire');
}

// ─── Generic keyword scan ─────────────────────────────────────────────────────
function checkKeywords($, platform = 'generic') {
  $('script, style, noscript, nav, footer, header, .recently-viewed, .recommendations, .related-products').remove();
  
  const body = $('body *').contents().map(function() {
      return (this.type === 'text') ? $(this).text() + ' ' : '';
  }).get().join('').replace(/\s+/g, ' ').toLowerCase();

  const outSignals = ['out of stock', 'currently unavailable', 'not available', 'no longer available', 'out-of-stock', 'temporarily unavailable'];
  const inSignals = ['add to cart', 'add to bag', 'add to basket', 'buy now', 'in stock', 'order now', 'add to trolley'];

  for (const s of outSignals) if (body.includes(s)) return { status: 'out', detail: `Detected: "${s}"`, platform };
  for (const s of inSignals) if (body.includes(s)) return { status: 'in', detail: `Detected: "${s}"`, platform };

  return { status: 'unknown', detail: 'Could not determine stock from page', platform };
}

// ─── Platform detection ───────────────────────────────────────────────────────
function detectPlatform(url, html = '') {
  if (url.includes('pk.sapphireonline.pk')) return 'sapphire';
  if (url.includes('/products/') || html.includes('cdn.shopify.com') || html.includes('Shopify.theme')) return 'shopify';
  if (html.includes('woocommerce'))  return 'woocommerce';
  if (html.includes('demandware') || html.includes('on/demandware')) return 'demandware';
  return 'generic';
}

// ─── WooCommerce ──────────────────────────────────────────────────────────────
function checkWooCommerce($) {
  const stock = $('.stock');
  if (stock.length) {
    const t = stock.text().toLowerCase();
    if (t.includes('out of stock')) return { status: 'out', detail: 'WooCommerce: Out of stock', platform: 'woocommerce' };
    if (t.includes('in stock'))     return { status: 'in',  detail: stock.text().trim(), platform: 'woocommerce' };
  }
  const btn = $('button.single_add_to_cart_button');
  if (btn.length) {
    return btn.prop('disabled') || btn.hasClass('disabled')
      ? { status: 'out', detail: 'Cart button disabled', platform: 'woocommerce' }
      : { status: 'in',  detail: 'Cart button active',   platform: 'woocommerce' };
  }
  return checkKeywords($, 'woocommerce');
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function checkStock(product) {
  const { url } = product;
  try {
    const isShopify = (product.platform === 'shopify' || url.includes('/products/')) && !url.includes('pk.sapphireonline.pk');

    if (isShopify) {
      try {
        const jsonResult = await checkShopifyJson(url);
        if (jsonResult) return jsonResult;
      } catch (_) {}
    }

    const html = await fetchHtml(url);
    const $ = cheerio.load(html);
    const platform = detectPlatform(url, html);

    if (platform !== 'shopify') {
      const jsonLdResult = checkJsonLd($);
      if (jsonLdResult) return { ...jsonLdResult, platform };
    }

    if (platform === 'sapphire')    return checkSapphire($);
    if (platform === 'shopify')     return checkShopifyHtml($, url);
    if (platform === 'woocommerce') return checkWooCommerce($);

    const jsonLdResult = checkJsonLd($);
    if (jsonLdResult) return { ...jsonLdResult, platform };

    return checkKeywords($, platform);

  } catch (err) {
    return { status: 'error', detail: err.message, platform: product.platform || 'unknown' };
  }
}

module.exports = { checkStock, detectPlatform };
