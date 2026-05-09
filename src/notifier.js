// Telegram notifier — 100% free, no credit card, no limits

const TELEGRAM_API = 'https://api.telegram.org';

async function sendTelegram(text) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId   = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.warn('[Notifier] Telegram not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env');
    return false;
  }

  const url = `${TELEGRAM_API}/bot${botToken}/sendMessage`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: false
    })
  });

  const data = await res.json();

  if (!data.ok) {
    console.error(`[Notifier] Telegram error: ${data.description}`);
    return false;
  }

  return true;
}

function buildMessage(product, checkResult) {
  const now = new Date().toLocaleString('en-SG', {
    timeZone: 'Asia/Singapore',
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  return [
    `✅ <b>Back in stock!</b>`,
    ``,
    `<b>${escapeHtml(product.name || 'Tracked product')}</b>`,
    ``,
    `📦 ${escapeHtml(checkResult.detail || 'Now available')}`,
    `🛒 Platform: ${checkResult.platform || 'unknown'}`,
    `🕐 Checked: ${now} (SGT)`,
    ``,
    `🔗 <a href="${product.url}">View product →</a>`
  ].join('\n');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function sendStockAlert(product, checkResult) {
  const message = buildMessage(product, checkResult);
  try {
    const sent = await sendTelegram(message);
    if (sent) console.log(`[Notifier] Telegram alert sent for "${product.name}"`);
    return sent;
  } catch (err) {
    console.error(`[Notifier] Failed to send Telegram alert: ${err.message}`);
    return false;
  }
}

async function sendInfo(text) {
  try { return await sendTelegram(text); } catch { return false; }
}

module.exports = { sendStockAlert, sendInfo };
