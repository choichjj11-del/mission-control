const fetch = require('node-fetch');
const config = require('../config');

async function sendTelegram(text) {
  if (!config.TELEGRAM_BOT_TOKEN || !config.TELEGRAM_CHAT_ID) {
    console.log('[Telegram] No token/chat_id configured, skipping notification');
    return null;
  }

  const url = `https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}/sendMessage`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: config.TELEGRAM_CHAT_ID,
      text,
      parse_mode: 'Markdown',
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    console.error('[Telegram] Send error:', err);
    return null;
  }

  return resp.json();
}

module.exports = { sendTelegram };
