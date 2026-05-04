const fs = require('fs');
const axios = require('axios');

// Load configurations from GitHub Secrets
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// File paths
const productsPath = './data/products.json';
const statePath = './data/state.json';

// Load Data
let productsData = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
const products = productsData.products || productsData;
let state = {};
if (fs.existsSync(statePath)) {
    state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
}

// --- Helper: Send Telegram Message ---
async function sendTelegram(message) {
    if (!BOT_TOKEN || !CHAT_ID) return;
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    try {
        await axios.post(url, { chat_id: CHAT_ID, text: message, parse_mode: 'Markdown' });
    } catch (e) { console.error("Telegram Error:", e.message); }
}

// --- Helper: Update State ---
function updateProductState(id, status, name, url) {
    state[id] = {
        id: id,
        name: name,
        status: status,
        url: url,
        lastChecked: new Date().toISOString()
    };
}

// --- Main Checker ---
async function main() {
    console.log("====================================");
    console.log(`Stock Tracker — ${new Date().toLocaleString()}`);
    console.log(`Checking ${products.length} product(s)...`);
    console.log("====================================");

    for (const p of products) {
        console.log(`→ ${p.name}`);
        let status = 'out';

        try {
            let isShopify = false;
            
            // 1. SMART CHECK: Try Shopify's hidden JSON database first
            if (p.url.includes('/products/')) {
                const jsonUrl = p.url.split('?')[0] + '.json';
                try {
                    const jRes = await axios.get(jsonUrl, { timeout: 8000 });
                    if (jRes.data && jRes.data.product && jRes.data.product.variants) {
                        isShopify = true;
                        // Check if ANY variant (size/color) is available
                        const isAvail = jRes.data.product.variants.some(v => v.available === true || v.inventory_quantity > 0);
                        status = isAvail ? 'in' : 'out';
                        console.log(`   [Shopify API] Status: ${status === 'in' ? '✅' : '❌'}`);
                    }
                } catch (e) { 
                    // JSON failed, move to HTML fallback 
                }
            }

            // 2. FALLBACK CHECK: Look for developer Schema tags in the HTML
            if (!isShopify) {
                const response = await axios.get(p.url, { 
                    timeout: 10000,
                    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64 AppleWebKit/537.36)" }
                });
                const html = response.data;
                const htmlLower = html.toLowerCase();
                
                // Look for strict, hidden inventory tags to avoid "Related Products" false positives
                if (html.includes('"availability":"http://schema.org/InStock"') || 
                    html.includes('content="instock"') || 
                    html.includes('content="InStock"')) {
                    status = 'in';
                } 
                // Absolute last resort: Button text
                else if (htmlLower.includes('add to cart') && !htmlLower.includes('sold out')) {
                    status = 'in';
                }
                console.log(`   [HTML Scan] Status: ${status === 'in' ? '✅' : '❌'}`);
            }

            // Alert if status changed from OUT to IN
            if (status === 'in' && (!state[p.id] || state[p.id].status !== 'in')) {
                await sendTelegram(`✅ *IN STOCK:* ${p.name}\n${p.url}`);
            }

            // Update the state memory
            updateProductState(p.id, status, p.name, p.url);

        } catch (e) {
            console.log(`   ✗ Error checking ${p.name}: ${e.message}`);
            // If the website blocks us, keep the old status so it doesn't trigger fake alerts
            if (state[p.id]) {
                updateProductState(p.id, state[p.id].status, p.name, p.url);
            }
        }
    }

    // Save final results
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
    console.log("====================================");
    console.log("Done.");
}

main();
