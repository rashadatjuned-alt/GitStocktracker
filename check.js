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
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    try {
        await axios.post(url, { chat_id: CHAT_ID, text: message, parse_mode: 'Markdown' });
    } catch (e) { console.error("Telegram Error:", e.message); }
}

// --- Helper: Update State ---
function updateProductState(id, status, name) {
    state[id] = {
        id: id,
        name: name,
        status: status,
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
            // Logic to check stock (Simplified for global use)
            const response = await axios.get(p.url, { timeout: 10000 });
            const html = response.data.toLowerCase();
            
            // Check for "In Stock" indicators
            if (html.includes('in stock') || html.includes('add to cart') || html.includes('available')) {
                status = 'in';
            }

            // Alert if status changed to 'in'
            if (status === 'in' && (!state[p.id] || state[p.id].status !== 'in')) {
                await sendTelegram(`✅ *IN STOCK:* ${p.name}\n${p.url}`);
            }

            // Update the local state variable
            updateProductState(p.id, status, p.name);
            console.log(`   Status: ${status === 'in' ? '✅' : '❌'}`);

        } catch (e) {
            console.log(`   ✗ Error checking ${p.name}: ${e.message}`);
        }
    }

    // Save final state
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
    console.log("====================================");
    console.log("Done.");
}

main();
