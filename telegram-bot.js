// telegram-bot.js — polls Telegram for commands (no webhook, no server, free).
// Commands: /add <url> [name], /remove <number|url>, /list, /check, /help
// Only messages from TELEGRAM_CHAT_ID are obeyed.

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { checkStock } = require('./src/checker');
const { getAllProducts, addProduct, updateProduct, removeProduct } = require('./src/db');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT  = String(process.env.TELEGRAM_CHAT_ID || '');
const API   = `https://api.telegram.org/bot${TOKEN}`;
const OFFSET_FILE = path.join(__dirname, 'data/telegram-offset.json');

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const icon = s => (s === 'in' ? '✅' : s === 'out' ? '❌' : '❓');

async function tg(method, body) {
  const res = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`${method}: ${data.description}`);
  return data.result;
}

const reply = text => tg('sendMessage', {
  chat_id: CHAT, text, parse_mode: 'HTML', disable_web_page_preview: true
}).catch(e => console.error('[bot] send failed:', e.message));

function readOffset() {
  try { return JSON.parse(fs.readFileSync(OFFSET_FILE, 'utf8')).offset || 0; } catch { return 0; }
}
function writeOffset(offset) {
  fs.writeFileSync(OFFSET_FILE, JSON.stringify({ offset }, null, 2));
}

function listText() {
  const items = getAllProducts();
  if (!items.length) return 'No products tracked yet. Use /add &lt;url&gt;';
  return '<b>Tracked products</b>\n\n' + items.map((p, i) =>
    `${i + 1}. ${icon(p.status)} ${esc(p.name)} — <i>${esc(p.status || 'pending')}</i>\n${esc(p.url)}`
  ).join('\n\n');
}

function validUrl(s) {
  try { const u = new URL(s); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; }
}

async function handle(text) {
  const [cmdRaw, ...rest] = text.trim().split(/\s+/);
  const cmd = cmdRaw.toLowerCase().replace(/@\w+$/, '');
  const arg = rest.join(' ').trim();

  if (cmd === '/add') {
    const [url, ...nameParts] = arg.split(/\s+/);
    if (!validUrl(url)) return reply('Usage: /add &lt;product url&gt; [name]');
    const { product, added } = addProduct({ url, name: nameParts.join(' ') });
    if (!added) return reply(`Already tracking:\n${esc(product.name)}`);
    let line;
    try {
      const r = await checkStock(product);
      // Set the real status directly so a product that is already in stock does not trigger a false "back in stock" alert.
      updateProduct(product.id, {
        status: r.status, platform: r.platform || null,
        lastChecked: new Date().toISOString(), lastStatus: r.status, lastDetail: r.detail
      });
      line = `${icon(r.status)} ${esc(r.status)} — ${esc(r.detail)}`;
    } catch (e) {
      line = `❓ first check failed: ${esc(e.message)} (will retry hourly)`;
    }
    return reply(`➕ Added <b>${esc(product.name)}</b>\n${line}`);
  }

  if (cmd === '/remove') {
    if (!arg) return reply('Usage: /remove &lt;number from /list or url&gt;');
    const items = getAllProducts();
    const target = /^\d+$/.test(arg) ? items[parseInt(arg, 10) - 1] : items.find(p => p.url === arg);
    if (!target) return reply('Not found. Use /list to see numbers.');
    removeProduct(target.id);
    return reply(`🗑 Removed <b>${esc(target.name)}</b>`);
  }

  if (cmd === '/list') return reply(listText());

  if (cmd === '/check') {
    await reply('🔄 Checking all products…');
    try { execFileSync('node', ['check.js'], { stdio: 'inherit' }); } catch (e) { console.error(e.message); }
    return reply(listText());
  }

  if (cmd === '/start' || cmd === '/help') {
    return reply('<b>Commands</b>\n/add &lt;url&gt; [name]\n/remove &lt;number|url&gt;\n/list\n/check');
  }
}

async function main() {
  if (!TOKEN || !CHAT) { console.error('Missing TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID'); process.exit(1); }

  let offset = readOffset();
  const updates = await tg('getUpdates', { offset, timeout: 0, allowed_updates: ['message'] });
  console.log(`[bot] ${updates.length} new update(s)`);

  for (const u of updates) {
    offset = u.update_id + 1;
    const m = u.message;
    if (!m || !m.text || !m.text.startsWith('/')) continue;
    if (String(m.chat.id) !== CHAT) { console.log('[bot] ignored message from other chat'); continue; }
    try { await handle(m.text); }
    catch (e) { console.error('[bot] handler error:', e); await reply(`⚠️ Error: ${esc(e.message)}`); }
  }

  writeOffset(offset);
}

main().catch(e => { console.error(e); process.exit(1); });
