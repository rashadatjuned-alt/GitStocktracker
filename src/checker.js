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

// ─── Shopify JSON endpoint ────────────────────────────────────────────────────
async function checkShopifyJson(url) {
  const base    = url.split('?')[0].replace(/\/$/, '');
  const jsonUrl = base.endsWith('.json') ? base : base + '.json';

  const res = await fetch(jsonUrl, { headers: HEADERS });
  if (!res.ok) return null;

  const data    = await res.json();
  const product = data.product;
  if (!product) return null;

  const variants = product.variants || [];

  // Check if `available` field exists in ANY variant
  const hasAvailableField = variants.some(v => typeof v.available !== 'undefined');

  if (hasAvailableField) {
    // Reliable — use available field directly
    const anyAvailable = variants.some(v => v.available === true);
    const totalQty = variants.reduce((s, v) => s + Math.max(0, v.inventory_quantity || 0), 0);
    return {
      status: anyAvailable ? 'in' : 'out',
      title: product.title,
      detail: anyAvailable
        ? `In stock (${totalQty > 0 ? totalQty + ' units' : 'available'})`
        : `Out of stock — all ${variants.length} variant(s) unavailable`,
      platform: 'shopify'
    };
  }

  // `available` field missing — store hides it (e.g. Limelight)
  // Fall through to HTML parsing
  console.log(`  [Checker] JSON missing 'available' field — falling back to HTML`);
  return null;
}

// ─── HTML fetch + parse ───────────────────────────────────────────────────────
async function fetchHtml(url) {
  const res = await fetch(url, { headers: { ...HEADERS, Referer: new URL(url).origin } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// ─── Shopify HTML parsing ─────────────────────────────────────────────────────
function checkShopifyHtml($, url) {
  // Method 1: Script tag with "available" boolean
  let scriptResult = null;
  $('script').each((_, el) => {
    const text = $(el).html() || '';

    // Look for "available": true/false
    const availMatch = text.match(/"available"\s*:\s*(true|false)/i);
    if (availMatch) {
      scriptResult = availMatch[1].toLowerCase() === 'true' ? 'in' : 'out';
      return false;
    }
  });

  if (scriptResult) {
    return {
      status: scriptResult,
      detail: scriptResult === 'in' ? 'In stock (script data)' : 'Out of stock (script data)',
      platform: 'shopify'
    };
  }

  // Method 2: Look for soldout / add-to-cart form action
  // Shopify uses form action="/cart/add" when in stock
  const cartForm = $('form[action="/cart/add"], form[action*="cart/add"]');
  if (cartForm.length > 0) {
    const submitBtn = cartForm.find('button[type="submit"], input[type="submit"], button[name="add"]');
    if (submitBtn.length > 0) {
      const isDisabled = submitBtn.prop('disabled') ||
        submitBtn.attr('disabled') !== undefined ||
        submitBtn.hasClass('disabled') ||
        submitBtn.hasClass('sold-out') ||
        submitBtn.hasClass('soldout');

      if (!isDisabled) {
        // Check button text for sold out
        const btnText = submitBtn.text().trim().toLowerCase();
        if (btnText.includes('sold out') || btnText.includes('out of stock') || btnText.includes('unavailable')) {
          return { status: 'out', detail: `Button says: "${submitBtn.text().trim()}"`, platform: 'shopify' };
        }
        return { status: 'in', detail: `Add to cart available: "${submitBtn.text().trim()}"`, platform: 'shopify' };
      } else {
        return { status: 'out', detail: 'Add to cart button disabled', platform: 'shopify' };
      }
    }
  }

  // Method 3: Look for sold-out CSS classes on product wrapper
  if ($('.sold-out, .soldout, .product--sold-out, [class*="sold-out"]').length > 0) {
    return { status: 'out', detail: 'Sold-out CSS class detected', platform: 'shopify' };
  }

  // Method 4: Generic keyword scan
  return checkKeywords($, 'shopify');
}

// ─── Generic keyword scan ─────────────────────────────────────────────────────
function checkKeywords($, platform = 'generic') {
  $('script, style, noscript, nav, footer, header').remove();
  const body = $('body').text().replace(/\s+/g, ' ').toLowerCase();

  const outSignals = [
    'sold out', 'out of stock', 'currently unavailable',
    'not available', 'no longer available', 'out-of-stock',
    'notify me when available', 'email when available',
    'temporarily unavailable',
  ];
  const inSignals = [
    'add to cart', 'add to bag', 'add to basket',
    'buy now', 'in stock', 'order now',
    'add to trolley',
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
  if (url.includes('/products/') || html.includes('cdn.shopify.com') || html.includes('Shopify.theme')) return 'shopify';
  if (html.includes('woocommerce')) return 'woocommerce';
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
    const isShopify = product.platform === 'shopify' || url.includes('/products/');

    // 1. Try Shopify JSON (fast, reliable — but some stores hide availability)
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

    if (platform === 'shopify')     return checkShopifyHtml($, url);
    if (platform === 'woocommerce') return checkWooCommerce($);
    return checkKeywords($, platform);

  } catch (err) {
    return { status: 'error', detail: err.message, platform: product.platform || 'unknown' };
  }
}

module.exports = { checkStock, detectPlatform };
