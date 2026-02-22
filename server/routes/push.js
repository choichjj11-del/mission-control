const express = require('express');
const router = express.Router();
const webpush = require('web-push');
const fs = require('fs');
const path = require('path');
const config = require('../config');

const SUBS_DIR = path.join(__dirname, '../../data/push-subs');

function ensureSubsDir() {
  if (!fs.existsSync(SUBS_DIR)) fs.mkdirSync(SUBS_DIR, { recursive: true });
}

function getSubscriptions(uid) {
  ensureSubsDir();
  const file = path.join(SUBS_DIR, `${uid || 'default'}.json`);
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

function saveSubscriptions(uid, subs) {
  ensureSubsDir();
  const file = path.join(SUBS_DIR, `${uid || 'default'}.json`);
  fs.writeFileSync(file, JSON.stringify(subs, null, 2), 'utf-8');
}

// Configure VAPID
if (config.VAPID_PUBLIC_KEY && config.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:brian@lucyhome.ai',
    config.VAPID_PUBLIC_KEY,
    config.VAPID_PRIVATE_KEY
  );
}

// GET /api/push/vapid-key — public key for client
router.get('/vapid-key', (req, res) => {
  if (!config.VAPID_PUBLIC_KEY) {
    return res.status(500).json({ error: 'VAPID keys not configured. Run: npx web-push generate-vapid-keys' });
  }
  res.json({ publicKey: config.VAPID_PUBLIC_KEY });
});

// POST /api/push/subscribe — save push subscription
router.post('/subscribe', (req, res) => {
  const subscription = req.body;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Invalid subscription' });
  }

  const uid = req.user.uid;
  const subs = getSubscriptions(uid);

  // Avoid duplicates
  const exists = subs.some(s => s.endpoint === subscription.endpoint);
  if (!exists) {
    subs.push(subscription);
    saveSubscriptions(uid, subs);
  }

  res.json({ ok: true, total: subs.length });
});

// POST /api/push/unsubscribe — remove push subscription
router.post('/unsubscribe', (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) return res.status(400).json({ error: 'endpoint required' });

  const uid = req.user.uid;
  let subs = getSubscriptions(uid);
  subs = subs.filter(s => s.endpoint !== endpoint);
  saveSubscriptions(uid, subs);

  res.json({ ok: true, remaining: subs.length });
});

// POST /api/push/test — send test notification
router.post('/test', async (req, res) => {
  if (!config.VAPID_PUBLIC_KEY) {
    return res.status(500).json({ error: 'VAPID keys not configured' });
  }

  const uid = req.user.uid;
  const subs = getSubscriptions(uid);
  if (subs.length === 0) {
    return res.status(404).json({ error: 'No push subscriptions found. Enable notifications first.' });
  }

  const payload = JSON.stringify({
    title: 'Mission Control',
    body: 'Push notifications are working!',
    icon: '/icon.svg',
    tag: 'test',
  });

  const results = await sendToAll(uid, payload);
  res.json({ sent: results.sent, failed: results.failed });
});

// Shared function: send push to all user's subscriptions
async function sendToAll(uid, payload) {
  const subs = getSubscriptions(uid);
  let sent = 0;
  let failed = 0;
  const validSubs = [];

  for (const sub of subs) {
    try {
      await webpush.sendNotification(sub, payload);
      validSubs.push(sub);
      sent++;
    } catch (err) {
      failed++;
      // Remove expired/invalid subscriptions (410 Gone or 404)
      if (err.statusCode === 410 || err.statusCode === 404) {
        console.log('[Push] Removing expired subscription');
      } else {
        validSubs.push(sub); // Keep for retry
        console.error('[Push] Send error:', err.statusCode || err.message);
      }
    }
  }

  // Update stored subscriptions (remove expired)
  if (validSubs.length !== subs.length) {
    saveSubscriptions(uid, validSubs);
  }

  return { sent, failed };
}

// Export sendToAll for cron usage
router.sendPushToUser = sendToAll;
router.getSubscriptions = getSubscriptions;

module.exports = router;
