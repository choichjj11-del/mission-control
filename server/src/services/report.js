const { readData } = require('../utils/store');
const { generateBriefing } = require('./ai');

async function generateDailyReport(type) {
  const data = readData();

  const doneTasks = data.tasks.filter(t => t.status === 'done');
  const todoTasks = data.tasks.filter(t => t.status === 'todo');
  const urgentTasks = todoTasks.filter(t => t.priority === '즉시');

  const stats = {
    total: data.tasks.length,
    done: doneTasks.length,
    todo: todoTasks.length,
    urgent: urgentTasks.length,
    completion_pct: Math.round((doneTasks.length / data.tasks.length) * 100),
  };

  // 최근 변경된 태스크만 전송 (토큰 절약)
  const recentDone = doneTasks
    .filter(t => t.done_at)
    .sort((a, b) => new Date(b.done_at) - new Date(a.done_at))
    .slice(0, 5)
    .map(t => ({ id: t.id, name: t.name, done_at: t.done_at }));

  const upNext = urgentTasks
    .slice(0, 5)
    .map(t => ({ id: t.id, name: t.name, day: t.day }));

  const changes = { recently_done: recentDone, up_next: upNext };

  const briefing = await generateBriefing(type, changes, stats);

  return { type, briefing, stats, generated_at: new Date().toISOString() };
}

module.exports = { generateDailyReport };
