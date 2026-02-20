const express = require('express');
const { execSync } = require('child_process');
const path = require('path');
const { writeMarkdown } = require('../utils/markdown');

const router = express.Router();

const REPO_ROOT = path.join(__dirname, '../../..');

/**
 * POST /api/sync/github — MD 재생성 + GitHub push
 */
router.post('/github', async (req, res) => {
  try {
    // Step 1: Regenerate markdown
    writeMarkdown();

    // Step 2: Git commit & push
    const opts = { cwd: REPO_ROOT, encoding: 'utf-8', timeout: 30000 };

    execSync('git add master_tasks.md server/data/tasks.json', opts);

    const status = execSync('git status --porcelain', opts).trim();
    if (!status) {
      return res.json({ synced: false, message: 'No changes to sync' });
    }

    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    execSync(`git commit -m "auto-sync: ${timestamp}"`, opts);
    execSync('git push', opts);

    res.json({ synced: true, message: `Pushed at ${timestamp}` });
  } catch (err) {
    console.error('[Sync] Error:', err.message);
    res.status(500).json({ error: 'GitHub sync failed', detail: err.message });
  }
});

module.exports = router;
