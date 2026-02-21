const cron = require('node-cron');
const config = require('../config');
const { readData } = require('./dataStore');
const { generateDailyReport, generateWeeklyReport } = require('./ai');
const { sendTelegram } = require('./telegram');
const { getDueReminders } = require('./reminders');

function startCronJobs() {
  console.log('[Cron] Starting scheduled jobs...');

  // Dynamic Reminder Check — Every minute
  cron.schedule(config.CRON.REMINDER_CHECK, async () => {
    try {
      const due = getDueReminders();
      for (const rem of due) {
        await sendTelegram(`⏰ *리마인더*\n\n${rem.message}`);
        console.log(`[Cron] Reminder sent: ${rem.message}`);
      }
    } catch (err) {
      console.error('[Cron] Reminder check error:', err);
    }
  });

  // Morning Briefing — 07:00 KST (22:00 UTC prev day)
  cron.schedule(config.CRON.MORNING_BRIEFING, async () => {
    console.log('[Cron] Running morning briefing...');
    try {
      const data = readData();
      const urgentTodo = data.tasks.filter(t => t.priority === '즉시' && t.status !== 'done');
      const totalDone = data.tasks.filter(t => t.status === 'done').length;

      const changesText = `오늘 즉시 실행할 태스크 ${urgentTodo.length}개:\n${urgentTodo.map(t => `- ${t.name}`).join('\n')}`;
      const statsText = `전체 진행률: ${totalDone}/${data.tasks.length} (${Math.round(totalDone / data.tasks.length * 100)}%)`;

      const report = await generateDailyReport(changesText, statsText);
      await sendTelegram(`🌅 *모닝 브리핑*\n\n${report}`);
      console.log('[Cron] Morning briefing sent');
    } catch (err) {
      console.error('[Cron] Morning briefing error:', err);
    }
  });

  // Night Review — 22:00 KST (13:00 UTC)
  cron.schedule(config.CRON.NIGHT_REVIEW, async () => {
    console.log('[Cron] Running night review...');
    try {
      const data = readData();
      const today = new Date().toISOString().split('T')[0];
      const todayDone = data.tasks.filter(t => t.done_at && t.done_at.startsWith(today));
      const totalDone = data.tasks.filter(t => t.status === 'done').length;

      const changesText = todayDone.length > 0
        ? `오늘 완료: ${todayDone.map(t => t.name).join(', ')}`
        : '오늘 완료한 태스크 없음';
      const statsText = `전체: ${totalDone}/${data.tasks.length}`;

      const report = await generateDailyReport(changesText, statsText);
      await sendTelegram(`🌙 *나이트 리뷰*\n\n${report}`);
      console.log('[Cron] Night review sent');
    } catch (err) {
      console.error('[Cron] Night review error:', err);
    }
  });

  // Weekly Report — Sunday 10:00 KST (01:00 UTC)
  cron.schedule(config.CRON.WEEKLY_REPORT, async () => {
    console.log('[Cron] Running weekly report...');
    try {
      const data = readData();
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const weekAgoStr = weekAgo.toISOString();

      const weekDone = data.tasks.filter(t => t.done_at && t.done_at >= weekAgoStr);
      const notDone = data.tasks.filter(t => t.status !== 'done' && (t.priority === '즉시' || t.priority === '단기'));
      const totalDone = data.tasks.filter(t => t.status === 'done').length;

      const summaryText = [
        `이번 주 완료 (${weekDone.length}개): ${weekDone.map(t => t.name).join(', ') || '없음'}`,
        `미완료 즉시/단기 (${notDone.length}개): ${notDone.slice(0, 10).map(t => `[${t.priority}] ${t.name}`).join(', ')}`,
        `전체: ${totalDone}/${data.tasks.length} (${Math.round(totalDone / data.tasks.length * 100)}%)`,
      ].join('\n');

      const report = await generateWeeklyReport(summaryText);
      await sendTelegram(`📊 *주간 리포트*\n\n${report}`);
      console.log('[Cron] Weekly report sent');
    } catch (err) {
      console.error('[Cron] Weekly report error:', err);
    }
  });

  console.log('[Cron] Scheduled:');
  console.log(`  - Reminder check: every minute`);
  console.log(`  - Morning briefing: ${config.CRON.MORNING_BRIEFING} (07:00 KST)`);
  console.log(`  - Night review: ${config.CRON.NIGHT_REVIEW} (22:00 KST)`);
  console.log(`  - Weekly report: ${config.CRON.WEEKLY_REPORT} (Sunday 10:00 KST)`);
}

module.exports = { startCronJobs };
