const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { readData } = require('../lib/dataStore');

const SHARED_DIR = path.join(__dirname, '../../data/shared');

function ensureSharedDir() {
  if (!fs.existsSync(SHARED_DIR)) fs.mkdirSync(SHARED_DIR, { recursive: true });
}

function getShares() {
  ensureSharedDir();
  const files = fs.readdirSync(SHARED_DIR).filter(f => f.endsWith('.json'));
  return files.map(f => JSON.parse(fs.readFileSync(path.join(SHARED_DIR, f), 'utf-8')));
}

// POST /api/sharing/invite — owner shares with target email
router.post('/invite', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email is required' });

  ensureSharedDir();
  const shareId = `share-${Date.now()}`;
  const record = {
    id: shareId,
    owner_uid: req.user.uid,
    owner_email: req.user.email,
    target_email: email,
    created_at: new Date().toISOString(),
  };

  fs.writeFileSync(
    path.join(SHARED_DIR, `${shareId}.json`),
    JSON.stringify(record, null, 2),
    'utf-8'
  );

  res.status(201).json(record);
});

// GET /api/sharing/shared-with-me — list boards shared with current user
router.get('/shared-with-me', (req, res) => {
  const shares = getShares().filter(s => s.target_email === req.user.email);
  res.json({ shares });
});

// GET /api/sharing/view/:owner_uid — read-only view of shared user's tasks
router.get('/view/:owner_uid', (req, res) => {
  const shares = getShares();
  const allowed = shares.some(
    s => s.owner_uid === req.params.owner_uid && s.target_email === req.user.email
  );
  if (!allowed) return res.status(403).json({ error: 'Not shared with you' });

  const data = readData(req.params.owner_uid);
  res.json({ tasks: data.tasks, objectives: data.objectives });
});

module.exports = router;
