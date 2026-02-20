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

// Health check
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
  console.log(`   Health:    http://localhost:${config.PORT}/api/health\n`);

  // Start cron jobs
  if (config.ANTHROPIC_API_KEY) {
    startCronJobs();
  } else {
    console.log('[Cron] ANTHROPIC_API_KEY not set — cron jobs disabled (AI features require API key)');
  }
});
