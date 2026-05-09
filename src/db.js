// db.js — reads and writes products.json
// In GitHub Actions, the repo is checked out so we read/write the local file
// Then the workflow commits the updated file back to the repo

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/products.json');

function readDb() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch {
    return { products: [] };
  }
}

function writeDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
}

function getAllProducts() {
  return readDb().products;
}

function addProduct({ url, name = '' }) {
  const db = readDb();
  const existing = db.products.find(p => p.url === url);
  if (existing) return { product: existing, added: false };

  const product = {
    id: Date.now().toString(),
    url,
    name: name || extractNameFromUrl(url),
    status: 'out',
    platform: null,
    lastChecked: null,
    lastStatus: null,
    lastDetail: null,
    addedAt: new Date().toISOString(),
    alertsSent: 0
  };

  db.products.push(product);
  writeDb(db);
  return { product, added: true };
}

function updateProduct(id, updates) {
  const db = readDb();
  const idx = db.products.findIndex(p => p.id === id);
  if (idx === -1) return null;
  db.products[idx] = { ...db.products[idx], ...updates };
  writeDb(db);
  return db.products[idx];
}

function removeProduct(id) {
  const db = readDb();
  const filtered = db.products.filter(p => p.id !== id);
  if (filtered.length === db.products.length) return false;
  writeDb({ ...db, products: filtered });
  return true;
}

function extractNameFromUrl(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    const last = parts[parts.length - 1] || '';
    return last.replace(/[-_]/g, ' ').replace(/\.html?$/, '').trim() || 'Unnamed product';
  } catch {
    return 'Unnamed product';
  }
}

module.exports = { getAllProducts, addProduct, updateProduct, removeProduct };
