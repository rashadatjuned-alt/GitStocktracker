const cheerio = require('cheerio');

// ─── Platform Detection ────────────────────────────────────────────────────────

function detectPlatform(url, html = '') {
  const u = url.toLowerCase();

  // Shopify signals
  if (
    html.includes('Shopify.theme') ||
    html.includes('cdn.shopify.com') ||
    html.includes('shopify-section') ||
    html.includes('"shop_id"')
  ) return 'shopify';

  // WooCommerce signals
  if (
    html.includes('woocommerce') ||
    html.includes('wc-add-to-cart') ||
    html.includes('class="product type-product')
  ) return 'woocommerce';

  // PrestaShop
  if (html.includes('prestashop') || html.includes('id="add_to_cart"')) return 'prestashop';

  // Magento
  if (html.includes('Magento') || html.includes('mage/') || html.includes('"mage-cache')) return 'magento';

  // BigCommerce
  if (html.includes('bigcommerce') || html.includes('data-cart-item-add')) return 'bigcommerce';

  // Squarespace
  if (html.includes('squarespace') || html.includes('sqs-block')) return 'squarespace';

  return 'generic';
}

// ─── Shopify ──────────────────────────────────────────────────────────────────

async function checkShopify(url) {
  // Convert product URL to .json endpoint
  // e.g. https://store.com/products/some-product → https://store.com/products/some-product.json
  let jsonUrl = url.replace(/\?.*$/, ''); // strip query params
  if (!jsonUrl.endsWith('.json')) jsonUrl = jsonUrl.replace(/\/$/, '') + '.json';

  const res = await fetch(jsonUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; StockTracker/1.0)' }
  });

  if (!res.ok) {
    // Fall back to HTML check if .json isn't accessible
    return checkGenericHtml(url);
  }

  const data = await res.json();
  const product = data.product;

  if (!product) return { status: 'unknown', detail: 'Could not parse Shopify JSON' };

  const title = product.title || '';
  const variants = product.variants || [];

  // Check if any variant has inventory
  const anyAvailable = variants.some(v => {
    if (v.inventory_management === null) return true; // not tracked = always available
    return v.available === true;
  });

  const totalInventory = variants.reduce((sum, v) => {
    return sum + (v.inventory_quantity > 0 ? v.inventory_quantity : 0);
  }, 0);

  return {
    status: anyAvailable ? 'in' : 'out',
    title,
    detail: anyAvailable
      ? `In stock (${totalInventory > 0 ? totalInventory + ' units across variants' : 'inventory not tracked'})`
      : `Out of stock (${variants.length} variant${variants.length !== 1 ? 's' : ''}, all unavailable)`,
    platform: 'shopify'
  };
}

// ─── WooCommerce ──────────────────────────────────────────────────────────────

function checkWooCommerce($, url) {
  // WooCommerce stock classes on the product page
  const stockEl = $('.stock');
  const stockText = stockEl.text().trim().toLowerCase();

  if (stockText.includes('out of stock') || stockText.includes('sold out')) {
    return { status: 'out', detail: 'WooCommerce: Out of stock', platform: 'woocommerce' };
  }
  if (stockText.includes('in stock') || stockText.includes('available')) {
    return { status: 'in', detail: `WooCommerce: ${stockEl.text().trim()}`, platform: 'woocommerce' };
  }

  // Check add-to-cart button
  const addToCart = $('button.single_add_to_cart_button, .add_to_cart_button');
  if (addToCart.hasClass('disabled') || addToCart.prop('disabled')) {
    return { status: 'out', detail: 'WooCommerce: Add to cart disabled', platform: 'woocommerce' };
  }
  if (addToCart.length > 0) {
    return { status: 'in', detail: 'WooCommerce: Add to cart available', platform: 'woocommerce' };
  }

  return { status: 'unknown', detail: 'WooCommerce: Could not determine stock', platform: 'woocommerce' };
}

// ─── Generic HTML ─────────────────────────────────────────────────────────────

async function checkGenericHtml(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    }
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);
  const platform = detectPlatform(url, html);

  // Remove scripts/styles from text analysis
  $('script, style, noscript').remove();

  // Platform-specific checks
  if (platform === 'woocommerce') return checkWooCommerce($, url);

  // --- Generic keyword checks ---
  const bodyText = $('body').text().replace(/\s+/g, ' ').toLowerCase();
  const title = $('title').text().trim() || $('h1').first().text().trim();

  // Out of stock signals (check first — more specific)
  const outSignals = [
    'out of stock', 'sold out', 'currently unavailable',
    'not available', 'no longer available', 'item unavailable',
    'temporarily out of stock', 'back soon', 'notify me when available',
    'email me when available', 'out-of-stock', 'soldout'
  ];
  const inSignals = [
    'add to cart', 'add to bag', 'buy now', 'in stock',
    'add to basket', 'purchase', 'order now', 'shop now',
    'available now', 'ready to ship'
  ];

  // Check for disabled/hidden add-to-cart as out-of-stock signal
  const addToCartBtn = $('button[name="add"], .add-to-cart, #add-to-cart, [data-action="add-to-cart"]');
  const btnDisabled = addToCartBtn.prop('disabled') || addToCartBtn.hasClass('disabled') || addToCartBtn.hasClass('sold-out');

  for (const signal of outSignals) {
    if (bodyText.includes(signal) || btnDisabled) {
      return { status: 'out', detail: `Detected: "${signal}"`, platform, title };
    }
  }

  for (const signal of inSignals) {
    if (bodyText.includes(signal)) {
      return { status: 'in', detail: `Detected: "${signal}"`, platform, title };
    }
  }

  return { status: 'unknown', detail: 'Could not determine stock status from page content', platform, title };
}

// ─── Main Check ───────────────────────────────────────────────────────────────

async function checkStock(product) {
  const { url } = product;

  try {
    // For Shopify, try the JSON API first (fast & reliable)
    // Detect Shopify by URL pattern or stored platform
    const isLikelyShopify =
      product.platform === 'shopify' ||
      url.includes('/products/') ||
      url.match(/myshopify\.com/);

    if (isLikelyShopify) {
      try {
        const result = await checkShopify(url);
        if (result.status !== 'unknown') return result;
      } catch (_) {
        // Fall through to generic check
      }
    }

    return await checkGenericHtml(url);
  } catch (err) {
    return { status: 'error', detail: err.message, platform: product.platform || 'unknown' };
  }
}

module.exports = { checkStock, detectPlatform };
