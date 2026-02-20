const express = require('express');
const router = express.Router();
const { readData, generateMarkdown } = require('../lib/dataStore');
const fetch = require('node-fetch');
const config = require('../config');

// POST /api/sync/github — Generate MD from tasks.json and push to GitHub
router.post('/github', async (req, res) => {
  try {
    const data = readData();
    const md = generateMarkdown(data);
    const filePath = 'master_tasks.md';

    // Get current file SHA (needed for update)
    const getResp = await fetch(
      `https://api.github.com/repos/${config.GITHUB_REPO}/contents/${filePath}`,
      {
        headers: {
          Authorization: `Bearer ${config.GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    let sha = null;
    if (getResp.ok) {
      const existing = await getResp.json();
      sha = existing.sha;
    }

    // Create or update file
    const body = {
      message: `[auto] Update master_tasks.md — ${new Date().toISOString().split('T')[0]}`,
      content: Buffer.from(md).toString('base64'),
      branch: 'main',
    };
    if (sha) body.sha = sha;

    const putResp = await fetch(
      `https://api.github.com/repos/${config.GITHUB_REPO}/contents/${filePath}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${config.GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (!putResp.ok) {
      const err = await putResp.text();
      throw new Error(`GitHub API error: ${putResp.status} ${err}`);
    }

    const result = await putResp.json();
    res.json({
      success: true,
      commit_sha: result.commit.sha,
      html_url: result.content.html_url,
    });
  } catch (err) {
    console.error('GitHub sync error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
