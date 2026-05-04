const fs = require('fs');
const path = require('path');

const PRODUCTS_FILE = path.join(__dirname, '../data/products.json');

/**
 * Combined Logic: Reads products and handles various JSON formats
 * to prevent "products.map is not a function" errors.
 */
function getAllProducts() {
  try {
    if (!fs.existsSync(PRODUCTS_FILE)) {
      return [];
    }
    
    const rawData = fs.readFileSync(PRODUCTS_FILE, 'utf8');
    const products = JSON.parse(rawData);
    
    // This handles both the [{}, {}] and {"products": [{}, {}]} formats
    // which ensures compatibility between Dashboard and Telegram updates.
    const productsArray = products.products || (Array.isArray(products) ? products : []);
    
    return productsArray;
  } catch (error) {
    console.error("Fatal error reading products.json:", error);
    return [];
  }
}

/**
 * Optional: Helper to save products back in the standard format
 */
function saveProducts(productsArray) {
  try {
    const data = JSON.stringify({ products: productsArray }, null, 2);
    fs.writeFileSync(PRODUCTS_FILE, data);
  } catch (error) {
    console.error("Error saving products:", error);
  }
}

module.exports = {
  getAllProducts,
  saveProducts
};
