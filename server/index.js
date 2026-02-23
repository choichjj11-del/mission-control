require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const { startCronJobs } = require('./lib/cron');
const { authMiddleware } = require('./lib/auth');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// 마이크/카메라 등 브라우저 API 명시적 허용
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'microphone=(self), camera=(self)');
  next();
});

// Auth middleware (supports Bearer token + Firebase tokens)
app.use('/api', authMiddleware);

// Serve static files (index.html dashboard)
app.use(express.static(path.join(__dirname, '..')));

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../data/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Routes
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/objectives', require('./routes/objectives'));
app.use('/api/voice', require('./routes/voice'));
app.use('/api/braindump', require('./routes/braindump'));
app.use('/api/report', require('./routes/report'));
app.use('/api/sync', require('./routes/sync'));
app.use('/api/sharing', require('./routes/sharing'));
app.use('/api/push', require('./routes/push'));

// Health check (public)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Start server (bind to 0.0.0.0 for IPv4 access)
app.listen(config.PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Mission Control API running on port ${config.PORT}`);
  console.log(`   Dashboard: http://localhost:${config.PORT}`);
  console.log(`   API:       http://localhost:${config.PORT}/api/tasks`);
  console.log(`   Health:    http://localhost:${config.PORT}/api/health`);
  console.log(`   Auth:      ${config.AUTH_TOKEN ? 'ENABLED' : 'DISABLED (dev mode)'}\n`);

  // Start cron jobs (reminders always run, AI reports need API key)
  startCronJobs();

  if (!config.OPENAI_API_KEY) {
    console.log('[Warning] OPENAI_API_KEY not set — AI features disabled');
  }
  if (!config.ELEVENLABS_API_KEY) {
    console.log('[Warning] ELEVENLABS_API_KEY not set — voice STT disabled');
  }
});
