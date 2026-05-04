const TELEGRAM_API = 'https://api.telegram.org';

async function sendTelegram(text, retries = 3) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId   = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.warn('[Notifier] Telegram not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env');
    return false;
  }

  const url = `${TELEGRAM_API}/bot${botToken}/sendMessage`;
  const payload = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: false
  };

  for (let i = 0; i < retries; i++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      const data = await res.json();

      if (data.ok) return true;

      // Handle Telegram Rate Limiting
      if (res.status === 429 && data.parameters && data.parameters.retry_after) {
        const waitTimeMs = (data.parameters.retry_after * 1000) + 500; 
        console.warn(`[Notifier] Telegram rate limit hit. Waiting ${waitTimeMs/1000}s before retrying...`);
        await new Promise(resolve => setTimeout(resolve, waitTimeMs));
        continue; 
      }

      console.error(`[Notifier] Telegram API error: ${data.description}`);
      return false;

    } catch (err) {
      clearTimeout(timeoutId);
      if (i === retries - 1) {
        console.error(`[Notifier] Failed to send after ${retries} attempts: ${err.message}`);
        return false;
      }
      console.warn(`[Notifier] Network error: ${err.message}. Retrying...`);
      await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
    }
  }
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
