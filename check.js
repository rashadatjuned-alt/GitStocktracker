const cheerio = require('cheerio');
 
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Cache-Control': 'max-age=0',
};
 
function getVariantId(url) {
  try { return new URL(url).searchParams.get('variant') || null; } catch { return null; }
}
 
// ─── Shopify JSON endpoint ────────────────────────────────────────────────────
async function checkShopifyJson(url) {
  const variantId = getVariantId(url);
  const base      = url.split('?')[0].replace(/\/$/, '');
  const jsonUrl   = base.endsWith('.json') ? base : base + '.json';
 
  const res = await fetch(jsonUrl, { headers: HEADERS });
  console.log(`  [Checker] JSON endpoint: ${jsonUrl} → HTTP ${res.status}`);
  if (!res.ok) return null;
 
  const data    = await res.json();
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
  const totalQty     = variants.reduce((s, v) => s + Math.max(0, v.inventory_quantity || 0), 0);
 
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
  const res = await fetch(url, { headers: { ...HEADERS, Referer: new URL(url).origin } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}
 
// ─── JSON-LD Schema.org (Khaadi, Sapphire, many non-Shopify sites) ────────────
function checkJsonLd($) {
  let result = null;
 
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data  = JSON.parse($(el).html() || '');
      const items = Array.isArray(data) ? data : [data];
 
      for (const item of items) {
        const avail = item.availability ||
                      item?.offers?.availability ||
                      (Array.isArray(item.offers) ? item.offers[0]?.availability : null) || '';
        if (!avail) continue;
 
        const isIn  = avail.includes('InStock');
        const isOut = avail.includes('OutOfStock') || avail.includes('SoldOut') ||
                      avail.includes('Discontinued') || avail.includes('InStoreOnly');
 
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
      const m1 = text.match(p1);
      const m2 = text.match(p2);
      if (m1) { scriptResult = m1[1].toLowerCase() === 'true' ? 'in' : 'out'; return false; }
      if (m2) { scriptResult = m2[1].toLowerCase() === 'true' ? 'in' : 'out'; return false; }
    } else {
      const m = text.match(/"available"\s*:\s*(true|false)/i);
      if (m) { scriptResult = m[1].toLowerCase() === 'true' ? 'in' : 'out'; return false; }
    }
  });
 
  if (scriptResult !== null) {
    return { status: scriptResult, detail: scriptResult === 'in' ? 'In stock (script data)' : 'Out of stock (script data)', platform: 'shopify' };
  }
 
  const cartForm = $('form[action="/cart/add"], form[action*="cart/add"]');
  if (cartForm.length > 0) {
    const btn = cartForm.find('button[type="submit"], button[name="add"]');
    if (btn.length > 0) {
      const disabled = btn.prop('disabled') || btn.attr('disabled') !== undefined ||
                       btn.hasClass('disabled') || btn.hasClass('sold-out') || btn.hasClass('soldout');
      if (!disabled) {
        const t = btn.text().trim().toLowerCase();
        if (t.includes('sold out') || t.includes('out of stock') || t.includes('unavailable')) {
          return { status: 'out', detail: `Button says: "${btn.text().trim()}"`, platform: 'shopify' };
        }
        return { status: 'in', detail: `Add to cart: "${btn.text().trim()}"`, platform: 'shopify' };
      }
      return { status: 'out', detail: 'Add to cart button disabled', platform: 'shopify' };
    }
  }
 
  if ($('.sold-out, .soldout, .product--sold-out').length > 0) {
    return { status: 'out', detail: 'Sold-out class detected', platform: 'shopify' };
  }
 
  return checkKeywords($, 'shopify');
}
 
// ─── Sapphire specific ───────────────────────────────────────────────────────
function checkSapphire($) {
  const addToBag = $('.add-to-cart');
  const notifyMe = $('.notify-me-button');
  if (addToBag.length > 0 && addToBag.text().toLowerCase().includes('add to bag')) {
    return { status: 'in', detail: 'Sapphire: Add to Bag available', platform: 'sapphire' };
  }
  if (notifyMe.length > 0 && addToBag.length === 0) {
    return { status: 'out', detail: 'Sapphire: Notify Me only — out of stock', platform: 'sapphire' };
  }
  if (addToBag.length > 0) {
    return { status: 'in', detail: 'Sapphire: Add to Bag available', platform: 'sapphire' };
  }
  return checkKeywords($, 'sapphire');
}
 
// ─── Generic keyword scan ─────────────────────────────────────────────────────
function checkKeywords($, platform = 'generic') {
  // Remove sections that may contain misleading stock text from other products
  $('script, style, noscript, nav, footer, header, .recently-viewed, .recommendations, .related-products').remove();
  const body = $('body').text().replace(/\s+/g, ' ').toLowerCase();
 
  const outSignals = [
    'out of stock', 'currently unavailable', 'not available',
    'no longer available', 'out-of-stock', 'temporarily unavailable',
  ];
  const inSignals = [
    'add to cart', 'add to bag', 'add to basket',
    'buy now', 'in stock', 'order now', 'add to trolley',
  ];
 
  for (const s of outSignals) {
    if (body.includes(s)) return { status: 'out', detail: `Detected: "${s}"`, platform };
  }
  for (const s of inSignals) {
    if (body.includes(s)) return { status: 'in', detail: `Detected: "${s}"`, platform };
  }
 
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
 
    // 1. Try Shopify JSON (variant-aware)
    if (isShopify) {
      try {
        const jsonResult = await checkShopifyJson(url);
        if (jsonResult) return jsonResult;
      } catch (_) {}
    }
 
    // 2. Full HTML parse
    const html     = await fetchHtml(url);
    const $        = cheerio.load(html);
    const platform = detectPlatform(url, html);
 
    // 3. Try JSON-LD first for non-Shopify platforms (Khaadi, Sapphire etc.)
    if (platform !== 'shopify') {
      const jsonLdResult = checkJsonLd($);
      if (jsonLdResult) return { ...jsonLdResult, platform };
    }
 
    if (platform === 'sapphire')    return checkSapphire($);
    if (platform === 'shopify')     return checkShopifyHtml($, url);
    if (platform === 'woocommerce') return checkWooCommerce($);
 
    // 4. For Demandware and generic — try JSON-LD then keywords
    const jsonLdResult = checkJsonLd($);
    if (jsonLdResult) return { ...jsonLdResult, platform };
 
    return checkKeywords($, platform);
 
  } catch (err) {
    return { status: 'error', detail: err.message, platform: product.platform || 'unknown' };
  }
}
 
module.exports = { checkStock, detectPlatform };
