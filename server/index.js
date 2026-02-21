const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const { startCronJobs } = require('./lib/cron');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Bearer token auth (protects /api routes, allows static files)
app.use('/api', (req, res, next) => {
  // Health check is public
  if (req.path === '/health') return next();

  // If AUTH_TOKEN is not set, skip auth (dev mode)
  if (!config.AUTH_TOKEN) return next();

  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${config.AUTH_TOKEN}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

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
