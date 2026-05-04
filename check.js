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

        try {
            let isShopify = false;
            
            // 1. SMART CHECK: Shopify .js endpoint (Highly accurate)
            if (p.url.includes('/products/')) {
                const jsUrl = p.url.split('?')[0] + '.js'; 
                try {
                    const jRes = await axios.get(jsUrl, { timeout: 8000 });
                    if (jRes.data && jRes.data.available !== undefined) {
                        isShopify = true;
                        status = jRes.data.available ? 'in' : 'out';
                        checkMethod = 'Shopify API';
                    }
                } catch (e) { 
                    // Silent fail, will fallback to HTML
                }
            }

            // 2. FALLBACK CHECK: Scan the HTML if Shopify API fails or item shows out
            // (Sometimes APIs are cached, but the page HTML is fresh)
            if (!isShopify || status === 'out') {
                const response = await axios.get(p.url, { 
                    timeout: 10000,
                    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64 AppleWebKit/537.36)" }
                });
                const html = response.data;
                const htmlLower = html.toLowerCase();
                
                // A. Check for standard Meta Tags (Facebook/Google uses these to verify stock)
                if (htmlLower.includes('property="og:availability" content="instock"')) {
                    status = 'in';
                    checkMethod = 'Meta Tags';
                } 
                // B. Check for Schema.org developer tags (Regex allows spaces)
                else if (/"availability"\s*:\s*"https?:\/\/schema\.org\/InStock"/i.test(html)) {
                    status = 'in';
                    checkMethod = 'Schema Tags';
                }
                // C. Check raw Shopify Javascript objects loaded on the page
                else if (htmlLower.includes('"available":true') || htmlLower.includes('"available": true')) {
                    status = 'in';
                    checkMethod = 'Page Script';
                }
                // D. Last resort: The actual button (Without the 'Sold Out' trap!)
                else if (htmlLower.includes('add to cart') || htmlLower.includes('add to bag')) {
                    // We only check for disabled buttons if we are relying purely on text
                    if (!htmlLower.includes('disabled="disabled"')) {
                        status = 'in';
                        checkMethod = 'Button Text';
                    }
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
