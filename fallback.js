// fallback.js — run by GitHub Actions when the Cloudflare Worker cannot decide a product's stock.
// Uses the full HTML parser (cheerio) and reports results back to the Worker.
const { checkStock } = require('./src/checker');

async function main() {
  const products = JSON.parse(process.env.PRODUCTS || '[]');
  const { WORKER_URL, WEBHOOK_SECRET } = process.env;
  if (!WORKER_URL || !WEBHOOK_SECRET) throw new Error('Missing WORKER_URL / WEBHOOK_SECRET');

  const results = [];
  for (const p of products) {
    const r = await checkStock(p);
    const status = r.status === 'in' || r.status === 'out' ? r.status : 'unknown';
    console.log(`${p.url} → ${status} (${r.detail})`);
    results.push({ id: p.id, status, detail: r.detail, platform: r.platform });
  }

  const res = await fetch(`${WORKER_URL.replace(/\/$/, '')}/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Report-Secret': WEBHOOK_SECRET },
    body: JSON.stringify({ results }),
  });
  console.log('Report →', res.status);
  if (!res.ok) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
