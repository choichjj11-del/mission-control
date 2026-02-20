module.exports = {
  PORT: process.env.PORT || 3000,

  // AI API Keys (set via environment variables on VPS)
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',

  // Telegram notifications (backup)
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || '7853728816',

  // GitHub sync
  GITHUB_REPO: 'choichjj11-del/mission-control',
  GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',

  // AI model selection (token-saving architecture)
  AI: {
    CLASSIFIER_MODEL: 'claude-3-5-haiku-20241022',   // Cheapest — task classifier
    BRAINDUMP_MODEL: 'claude-sonnet-4-20250514',    // Mid — brain dump parsing only
    REPORT_MODEL: 'claude-3-5-haiku-20241022',       // Cheapest — daily/weekly reports
  },

  // Whisper STT
  WHISPER_MODEL: 'whisper-1',

  // Cron schedules (KST = UTC+9)
  CRON: {
    MORNING_BRIEFING: '0 22 * * *',  // 07:00 KST = 22:00 UTC (prev day)
    NIGHT_REVIEW: '0 13 * * *',       // 22:00 KST = 13:00 UTC
    WEEKLY_REPORT: '0 1 * * 0',       // Sunday 10:00 KST = 01:00 UTC
  },
};
