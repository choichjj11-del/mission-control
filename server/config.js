module.exports = {
  PORT: process.env.PORT || 3000,

  // Auth (Bearer token for API protection)
  AUTH_TOKEN: process.env.AUTH_TOKEN || '',

  // AI API Keys
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY || '',

  // Telegram notifications
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || '7853728816',

  // GitHub sync
  GITHUB_REPO: 'choichjj11-del/mission-control',
  GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',

  // AI model selection — GPT-4o-mini for everything (cheapest agent-capable model)
  AI: {
    AGENT_MODEL: 'gpt-4o-mini',       // $0.15/$0.60 per M tokens — all agent tasks
    REPORT_MODEL: 'gpt-4o-mini',      // Reports
  },

  // ElevenLabs Scribe v2 (STT — included in Pro plan ~25hrs/month free)
  STT: {
    MODEL: 'scribe_v2',
    LANGUAGE: 'kor',
  },

  // Cron schedules (KST = UTC+9)
  CRON: {
    MORNING_BRIEFING: '0 22 * * *',   // 07:00 KST = 22:00 UTC (prev day)
    NIGHT_REVIEW: '0 13 * * *',       // 22:00 KST = 13:00 UTC
    WEEKLY_REPORT: '0 1 * * 0',       // Sunday 10:00 KST = 01:00 UTC
    REMINDER_CHECK: '* * * * *',       // Every minute — check dynamic reminders
  },
};
