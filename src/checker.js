const cheerio = require('cheerio');

// ─── Realistic browser headers to bypass Cloudflare ──────────────────────────
function getHeaders(url) {
  const origin = new URL(url).origin;
  return {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0',
    'Referer': origin,
  };
}

// ─── Platform Detection ───────────────────────────────────────────────────────
function detectPlatform(url, html = '') {
  if (
    html.includes('Shopify.theme') ||
    html.includes('cdn.shopify.com') ||
    html.includes('shopify-section') ||
    url.includes('/products/') ||
    url.includes('myshopify.com')
  ) return 'shopify';

  if (html.includes('woocommerce') || html.includes('wc-add-to-cart')) return 'woocommerce';
  if (html.includes('prestashop'))  return 'prestashop';
  if (html.includes('Magento'))     return 'magento';
  if (html.includes('bigcommerce')) return 'bigcommerce';
  return 'generic';
}

// ─── Shopify JSON endpoint ────────────────────────────────────────────────────
async function checkShopifyJson(url) {
  // Strip query params and build .json URL
  const base = url.split('?')[0].replace(/\/$/, '');
  const jsonUrl = base.endsWith('.json') ? base : base + '.json';

  const res = await fetch(jsonUrl, { headers: getHeaders(url) });
  if (!res.ok) return null; // fall through to HTML

  const data = await res.json();
  const product = data.product;
  if (!product) return null;

  const variants = product.variants || [];
  const anyAvailable = variants.some(v => v.available === true || v.inventory_management === null);
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

// ─── Shopify HTML parsing (fallback when .json is blocked) ───────────────────
function checkShopifyHtml($, url) {
  // Method 1: Look for Shopify's availability JSON in the page script tags
  let foundInScript = null;
  $('script').each((_, el) => {
    const text = $(el).html() || '';

    // Shopify often embeds product JSON in a script tag
    const match = text.match(/"available"\s*:\s*(true|false)/i);
    if (match) {
      foundInScript = match[1].toLowerCase() === 'true' ? 'in' : 'out';
      return false; // break
    }

    // Also look for inventory_quantity
    const qtyMatch = text.match(/"inventory_quantity"\s*:\s*(\d+)/);
    if (qtyMatch && foundInScript === null) {
      foundInScript = parseInt(qtyMatch[1]) > 0 ? 'in' : 'out';
    }
  });

  if (foundInScript) {
    return {
      status: foundInScript,
      detail: foundInScript === 'in' ? 'In stock (from page script)' : 'Out of stock (from page script)',
      platform: 'shopify'
    };
  }

  // Method 2: Check add-to-cart button
  const addToCartBtn = $(
    'button[name="add"], #AddToCart, .add-to-cart, [data-testid="add-to-cart"], button.btn-addtocart'
  );

  if (addToCartBtn.length > 0) {
    const disabled = addToCartBtn.prop('disabled') ||
      addToCartBtn.hasClass('disabled') ||
      addToCartBtn.hasClass('sold-out') ||
      addToCartBtn.attr('disabled') !== undefined;

    if (!disabled) {
      return { status: 'in', detail: 'Add to cart button is active', platform: 'shopify' };
    } else {
      return { status: 'out', detail: 'Add to cart button is disabled', platform: 'shopify' };
    }
  }

  // Method 3: Text-based signals
  return checkGenericKeywords($, 'shopify');
}

// ─── WooCommerce ──────────────────────────────────────────────────────────────
function checkWooCommerce($) {
  const stockEl   = $('.stock');
  const stockText = stockEl.text().trim().toLowerCase();

  if (stockText.includes('out of stock')) return { status: 'out', detail: 'WooCommerce: Out of stock', platform: 'woocommerce' };
  if (stockText.includes('in stock'))     return { status: 'in',  detail: `WooCommerce: ${stockEl.text().trim()}`, platform: 'woocommerce' };

  const btn = $('button.single_add_to_cart_button');
  if (btn.length > 0) {
    return btn.prop('disabled') || btn.hasClass('disabled')
      ? { status: 'out', detail: 'WooCommerce: cart disabled', platform: 'woocommerce' }
      : { status: 'in',  detail: 'WooCommerce: cart active',   platform: 'woocommerce' };
  }

  return checkGenericKeywords($, 'woocommerce');
}

// ─── Generic keyword scan ─────────────────────────────────────────────────────
function checkGenericKeywords($, platform = 'generic') {
  $('script, style, noscript, nav, footer, header').remove();
  const body = $('body').text().replace(/\s+/g, ' ').toLowerCase();

  const outSignals = [
    'out of stock', 'sold out', 'currently unavailable', 'not available',
    'no longer available', 'item unavailable', 'temporarily out of stock',
    'notify me when available', 'email me when available', 'out-of-stock',
    'soldout', 'باہر از اسٹاک', // Urdu: out of stock
  ];

  const inSignals = [
    'add to cart', 'add to bag', 'add to basket', 'buy now',
    'in stock', 'available now', 'order now', 'purchase',
    'کارٹ میں شامل کریں', // Urdu: add to cart
  ];

  for (const s of outSignals) {
    if (body.includes(s)) return { status: 'out', detail: `Detected: "${s}"`, platform };
  }
  for (const s of inSignals) {
    if (body.includes(s)) return { status: 'in', detail: `Detected: "${s}"`, platform };
  }

  return { status: 'unknown', detail: 'Could not determine stock status', platform };
}

// ─── Main Check ───────────────────────────────────────────────────────────────
async function checkStock(product) {
  const { url } = product;

  try {
    const isShopify = product.platform === 'shopify' || url.includes('/products/');

    // 1. Try Shopify JSON first (fastest, most reliable)
    if (isShopify) {
      try {
        const result = await checkShopifyJson(url);
        if (result) return result;
      } catch (_) {}
    }

    // 2. Fetch full HTML page
    const res = await fetch(url, { headers: getHeaders(url) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const html = await res.text();
    const $    = cheerio.load(html);
    const platform = detectPlatform(url, html);

    // 3. Platform-specific HTML parsing
    if (platform === 'shopify')    return checkShopifyHtml($, url);
    if (platform === 'woocommerce') return checkWooCommerce($);

    return checkGenericKeywords($, platform);

  } catch (err) {
    return { status: 'error', detail: err.message, platform: product.platform || 'unknown' };
  }
}

module.exports = { checkStock, detectPlatform };
