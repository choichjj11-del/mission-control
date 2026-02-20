const express = require('express');
const { generateDailyReport } = require('../services/report');
const { readData } = require('../utils/store');

const router = express.Router();

// GET /api/report/daily
router.get('/daily', async (req, res) => {
  try {
    const report = await generateDailyReport('morning');
    res.json(report);
  } catch (err) {
    console.error('[Report] Error:', err.message);
    res.status(500).json({ error: 'Report generation failed', detail: err.message });
  }
});

// GET /api/report/weekly
router.get('/weekly', (req, res) => {
  const data = readData();

  const doneTasks = data.tasks.filter(t => t.status === 'done');
  const todoTasks = data.tasks.filter(t => t.status === 'todo');

  const byPriority = {};
  for (const t of data.tasks) {
    if (!byPriority[t.priority]) byPriority[t.priority] = { total: 0, done: 0 };
    byPriority[t.priority].total++;
    if (t.status === 'done') byPriority[t.priority].done++;
  }

  const byCategory = {};
  for (const t of data.tasks) {
    if (!byCategory[t.category]) byCategory[t.category] = { total: 0, done: 0 };
    byCategory[t.category].total++;
    if (t.status === 'done') byCategory[t.category].done++;
  }

  res.json({
    summary: {
      total: data.tasks.length,
      done: doneTasks.length,
      todo: todoTasks.length,
      completion_pct: Math.round((doneTasks.length / data.tasks.length) * 100),
    },
    by_priority: byPriority,
    by_category: byCategory,
    objectives: data.objectives,
    generated_at: new Date().toISOString(),
  });
});

// GET /api/report/stats — 간단 통계 (AI 호출 없음)
router.get('/stats', (req, res) => {
  const data = readData();
  const done = data.tasks.filter(t => t.status === 'done').length;
  const total = data.tasks.length;
  const urgent = data.tasks.filter(t => t.priority === '즉시' && t.status === 'todo').length;

  res.json({
    total,
    done,
    todo: total - done,
    urgent,
    completion_pct: Math.round((done / total) * 100),
  });
});

module.exports = router;
