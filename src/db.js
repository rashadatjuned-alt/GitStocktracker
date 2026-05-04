const fs = require('fs');
const path = require('path');

const productsPath = path.join(__dirname, '../data/products.json');
const statePath = path.join(__dirname, '../data/state.json');

function getAllProducts() {
  // Read the static configuration (the links you want to track)
  let products = [];
  if (fs.existsSync(productsPath)) {
    products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
  } else {
    console.warn('[DB] data/products.json not found!');
  }

  // Read the dynamic state (what the bot has tracked so far)
  let state = {};
  if (fs.existsSync(statePath)) {
    state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  }

  // Merge them together for the checker
  return products.map(p => {
    const productState = state[p.id] || {};
    return { ...p, ...productState };
  });
}

function updateProduct(id, updates) {
  let state = {};
  if (fs.existsSync(statePath)) {
    state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  }
  
  // Merge the new status updates into the existing state for this ID
  state[id] = { ...(state[id] || {}), ...updates };
  
  // Save ONLY to state.json
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

module.exports = { getAllProducts, updateProduct };
