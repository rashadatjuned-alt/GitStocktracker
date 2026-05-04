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
        let checkMethod = 'None';
        let apiSuccess = false; // Flag to prevent double-guessing

        try {
            // 1. SMART CHECK: Shopify .js endpoint (Highly accurate)
            if (p.url.includes('/products/')) {
                // Ensure we get the clean product URL ending in .js
                const cleanUrl = p.url.split('?')[0];
                const jsUrl = cleanUrl.endsWith('.js') ? cleanUrl : cleanUrl + '.js';
                
                try {
                    const jRes = await axios.get(jsUrl, { timeout: 8000 });
                    // Verify this is a valid Shopify product response
                    if (jRes.data && jRes.data.id && typeof jRes.data.available !== 'undefined') {
                        status = jRes.data.available ? 'in' : 'out';
                        checkMethod = 'Shopify API';
                        apiSuccess = true; // We got a definitive answer!
                    }
                } catch (e) { 
                    // Silent fail, will fallback to HTML
                }
            }

            // 2. FALLBACK CHECK: ONLY run this if the API failed entirely. 
            // Never run this if the API already told us it is 'out' of stock.
            if (!apiSuccess) {
                const response = await axios.get(p.url, { 
                    timeout: 10000,
                    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64 AppleWebKit/537.36)" }
                });
                const html = response.data;
                const htmlLower = html.toLowerCase();
                
                // STRICT HTML Checks (No generic "add to cart" text searches)
                if (htmlLower.includes('property="og:availability" content="instock"')) {
                    status = 'in';
                    checkMethod = 'Meta Tags';
                } 
                else if (/"availability"\s*:\s*"https?:\/\/schema\.org\/InStock"/i.test(html)) {
                    status = 'in';
                    checkMethod = 'Schema Tags';
                }
            }

            console.log(`   [${checkMethod}] Status: ${status === 'in' ? '✅' : '❌'}`);

            // Alert if status changed from OUT to IN
            if (status === 'in' && (!state[p.id] || state[p.id].status !== 'in')) {
                await sendTelegram(`✅ *IN STOCK:* ${p.name}\n${p.url}`);
            }

            // Update the state memory
            updateProductState(p.id, status, p.name, p.url);

        } catch (e) {
            console.log(`   ✗ Error checking ${p.name}: ${e.message}`);
            // If the website blocks us, keep the old status
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
