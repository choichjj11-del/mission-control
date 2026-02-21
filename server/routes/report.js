const express = require('express');
const router = express.Router();
const { readData } = require('../lib/dataStore');
const { generateDailyReport, generateWeeklyReport, callGPT } = require('../lib/ai');
const config = require('../config');

// GET /api/report/daily — 오늘 리포트
router.get('/daily', async (req, res) => {
  try {
    const data = readData(req.user.uid);
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
    const data = readData(req.user.uid);
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
  const data = readData(req.user.uid);
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

// GET /api/report/insights — AI-powered insights (costs tokens, call on demand)
router.get('/insights', async (req, res) => {
  try {
    const data = readData(req.user.uid);
    const total = data.tasks.length;
    const done = data.tasks.filter(t => t.status === 'done').length;
    const urgent = data.tasks.filter(t => t.priority === '즉시' && t.status !== 'done');
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();

    // Stale tasks: created >3 days ago, still undone
    const stale = data.tasks.filter(t =>
      t.status !== 'done' && t.created_at && t.created_at < threeDaysAgo
    );

    const byCategory = {};
    for (const t of data.tasks) {
      if (!byCategory[t.category]) byCategory[t.category] = { total: 0, done: 0 };
      byCategory[t.category].total++;
      if (t.status === 'done') byCategory[t.category].done++;
    }

    const analysisText = [
      `전체: ${done}/${total} 완료 (${Math.round(done / total * 100)}%)`,
      `즉시 실행 미완료 (${urgent.length}개): ${urgent.map(t => t.name).join(', ')}`,
      `3일 이상 방치 (${stale.length}개): ${stale.slice(0, 5).map(t => `${t.name}(${t.priority})`).join(', ')}`,
      `카테고리별: ${Object.entries(byCategory).map(([k, v]) => `${k}: ${v.done}/${v.total}`).join(', ')}`,
    ].join('\n');

    const systemPrompt = `당신은 생산성 코치입니다. 태스크 데이터를 분석해서 3-4개의 짧고 실행 가능한 인사이트를 JSON으로 반환하세요.
응답 형식 (JSON만, 설명 없이):
[
  {"icon": "이모지", "title": "제목", "body": "1-2문장 설명"},
  ...
]
자율성 지지적 언어 사용 ("~해보는 건 어때요?" not "~해야 합니다").`;

    const raw = await callGPT(config.AI.AGENT_MODEL, systemPrompt, analysisText, 500);
    const jsonStr = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const insights = JSON.parse(jsonStr);

    res.json({ insights });
  } catch (err) {
    console.error('Insights error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
