require('dotenv').config();
const { checkStock } = require('./src/checker');
const { sendStockAlert, sendInfo } = require('./src/notifier');
const { getAllProducts, updateProduct } = require('./src/db');

// Helper function to create randomized delays (Jitter)
const sleep = (minMs, maxMs) => {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise(resolve => setTimeout(resolve, ms));
};

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
      const newStatus = result.status;

      let errorCount = product.errorCount || 0;
      if (newStatus === 'error') {
        errorCount += 1;
        if (errorCount === 3) {
          await sendInfo(`⚠️ Tracker failing for ${product.name}. Might be blocked or site changed layout.`);
        }
      } else {
        errorCount = 0; 
      }

      updateProduct(product.id, {
        status: newStatus,
        platform: result.platform || product.platform,
        lastChecked: new Date().toISOString(),
        lastStatus: prevStatus,
        lastDetail: result.detail,
        errorCount: errorCount 
      });

      const icon = newStatus === 'in' ? '✅' : newStatus === 'out' ? '❌' : (newStatus === 'error' ? '⚠️' : '❓');
      console.log(`  Status: ${icon} ${newStatus} — ${result.detail}`);

      // Only alert if it was explicitly 'out' before
      if (prevStatus === 'out' && newStatus === 'in') {
        console.log(`  🔔 BACK IN STOCK! Sending alert...`);
        const sent = await sendStockAlert(product, result);
        if (sent) {
          updateProduct(product.id, { alertsSent: (product.alertsSent || 0) + 1 });
          backInStock.push(product.name);
        }
      }

      console.log();
      
      // Jitter delay: Wait 2.5 to 5 seconds between checks to avoid IP bans
      await sleep(2500, 5000); 

    } catch (err) {
      console.error(`  ✗ Error: ${err.message}\n`);
      
      const currentErrors = (product.errorCount || 0) + 1;
      updateProduct(product.id, {
        status: 'error',
        lastChecked: new Date().toISOString(),
        lastDetail: err.message,
        errorCount: currentErrors
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
