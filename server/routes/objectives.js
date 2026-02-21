const express = require('express');
const router = express.Router();
const { readData, writeData } = require('../lib/dataStore');

// GET /api/objectives — 목표 목록
router.get('/', (req, res) => {
  const data = readData(req.user.uid);
  res.json({ objectives: data.objectives });
});

// PATCH /api/objectives/:id — 목표 업데이트
router.patch('/:id', (req, res) => {
  const data = readData(req.user.uid);
  const idx = data.objectives.findIndex(o => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Objective not found' });

  const allowedFields = ['title', 'desc', 'target', 'current', 'unit'];
  const updates = req.body;

  for (const key of Object.keys(updates)) {
    if (allowedFields.includes(key)) {
      data.objectives[idx][key] = updates[key];
    }
  }

  writeData(data, req.user.uid);
  res.json(data.objectives[idx]);
});

module.exports = router;
