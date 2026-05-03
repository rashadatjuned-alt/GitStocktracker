// check.js — run by GitHub Actions every hour
require('dotenv').config();
const { checkStock } = require('./src/checker');
const { sendStockAlert, sendInfo } = require('./src/notifier');
const { getAllProducts, updateProduct } = require('./src/db');

async function main() {
  const products = getAllProducts();

  console.log(`\n====================================`);
  console.log(`Stock Tracker — ${new Date().toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })} SGT`);
  console.log(`Checking ${products.length} product(s)...`);
  console.log(`====================================\n`);

  if (products.length === 0) {
    console.log('No products tracked.');
    return;
  }

  let backInStock = [];

  for (const product of products) {
    try {
      console.log(`→ ${product.name}`);
      console.log(`  URL: ${product.url}`);

      const result = await checkStock(product);
      const prevStatus = product.status;
      const newStatus  = result.status;

      updateProduct(product.id, {
        status:      newStatus,
        platform:    result.platform || product.platform,
        lastChecked: new Date().toISOString(),
        lastStatus:  prevStatus,
        lastDetail:  result.detail
      });

      const icon = newStatus === 'in' ? '✅' : newStatus === 'out' ? '❌' : '❓';
      console.log(`  Status: ${icon} ${newStatus} — ${result.detail}`);

      if (prevStatus === 'out' && newStatus === 'in') {
        console.log(`  🔔 BACK IN STOCK! Sending alert...`);
        const sent = await sendStockAlert(product, result);
        if (sent) {
          updateProduct(product.id, { alertsSent: (product.alertsSent || 0) + 1 });
          backInStock.push(product.name);
        }
      }

      console.log();
    } catch (err) {
      console.error(`  ✗ Error: ${err.message}\n`);
      updateProduct(product.id, {
        status: 'error',
        lastChecked: new Date().toISOString(),
        lastDetail: err.message
      });
    }
  }

  console.log(`====================================`);
  console.log(`Done. ${backInStock.length > 0 ? `Alerts sent: ${backInStock.join(', ')}` : 'No stock changes.'}`);
  console.log(`====================================\n`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
