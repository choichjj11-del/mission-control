const express = require('express');
const { readData, writeData } = require('../utils/store');

const router = express.Router();

// GET /api/objectives
router.get('/', (req, res) => {
  const data = readData();
  res.json({ objectives: data.objectives });
});

// PATCH /api/objectives/:id
router.patch('/:id', (req, res) => {
  const data = readData();
  const idx = data.objectives.findIndex(o => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Objective not found' });

  const allowed = ['title', 'target', 'current', 'unit'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) data.objectives[idx][key] = req.body[key];
  }

  writeData(data);
  res.json(data.objectives[idx]);
});

module.exports = router;
