const express = require('express');
const router = express.Router();
const { readData } = require('../lib/dataStore');
const { generateDailyReport, generateWeeklyReport } = require('../lib/ai');

// GET /api/report/daily — 오늘 리포트
router.get('/daily', async (req, res) => {
  try {
    const data = readData();
    const today = new Date().toISOString().split('T')[0];

    // Find tasks modified today
    const todayDone = data.tasks.filter(t =>
      t.done_at && t.done_at.startsWith(today)
    );
    const todayAdded = data.tasks.filter(t =>
      t.created_at && t.created_at.startsWith(today)
    );

    const totalDone = data.tasks.filter(t => t.status === 'done').length;
    const totalTasks = data.tasks.length;
    const urgentRemaining = data.tasks.filter(t => t.priority === '즉시' && t.status !== 'done').length;

    const changesText = [
      todayDone.length > 0
        ? `완료: ${todayDone.map(t => t.name).join(', ')}`
        : '오늘 완료한 태스크 없음',
      todayAdded.length > 0
        ? `새로 추가: ${todayAdded.map(t => t.name).join(', ')}`
        : '',
    ].filter(Boolean).join('\n');

    const statsText = [
      `전체 진행률: ${totalDone}/${totalTasks} (${Math.round(totalDone / totalTasks * 100)}%)`,
      `즉시 실행 남은 것: ${urgentRemaining}개`,
    ].join('\n');

    const report = await generateDailyReport(changesText, statsText);

    res.json({
      date: today,
      report,
      stats: {
        total: totalTasks,
        done: totalDone,
        today_done: todayDone.length,
        today_added: todayAdded.length,
        urgent_remaining: urgentRemaining,
      },
    });
  } catch (err) {
    console.error('Daily report error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/report/weekly — 주간 리포트
router.get('/weekly', async (req, res) => {
  try {
    const data = readData();
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekAgoStr = weekAgo.toISOString();

    const weekDone = data.tasks.filter(t =>
      t.done_at && t.done_at >= weekAgoStr
    );
    const notDone = data.tasks.filter(t =>
      t.status !== 'done' && (t.priority === '즉시' || t.priority === '단기')
    );

    const totalDone = data.tasks.filter(t => t.status === 'done').length;
    const totalTasks = data.tasks.length;

    const summaryText = [
      `이번 주 완료 (${weekDone.length}개): ${weekDone.map(t => t.name).join(', ') || '없음'}`,
      `미완료 즉시/단기 (${notDone.length}개): ${notDone.map(t => `[${t.priority}] ${t.name}`).join(', ')}`,
      `전체 진행률: ${totalDone}/${totalTasks} (${Math.round(totalDone / totalTasks * 100)}%)`,
    ].join('\n');

    const report = await generateWeeklyReport(summaryText);

    res.json({
      week_start: weekAgo.toISOString().split('T')[0],
      week_end: now.toISOString().split('T')[0],
      report,
      stats: {
        total: totalTasks,
        done: totalDone,
        week_done: weekDone.length,
        urgent_not_done: notDone.filter(t => t.priority === '즉시').length,
      },
    });
  } catch (err) {
    console.error('Weekly report error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/report/stats — 통계만 (AI 호출 없음)
router.get('/stats', (req, res) => {
  const data = readData();
  const total = data.tasks.length;
  const done = data.tasks.filter(t => t.status === 'done').length;

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
    total,
    done,
    percent: Math.round(done / total * 100),
    by_priority: byPriority,
    by_category: byCategory,
    objectives: data.objectives,
  });
});

module.exports = router;
