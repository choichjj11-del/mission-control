const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const tasksRouter = require('./routes/tasks');
const objectivesRouter = require('./routes/objectives');
const voiceRouter = require('./routes/voice');
const braindumpRouter = require('./routes/braindump');
const reportRouter = require('./routes/report');
const syncRouter = require('./routes/sync');
const { generateDailyReport } = require('./services/report');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/tasks', tasksRouter);
app.use('/api/objectives', objectivesRouter);
app.use('/api/voice', voiceRouter);
app.use('/api/braindump', braindumpRouter);
app.use('/api/report', reportRouter);
app.use('/api/sync', syncRouter);

// Cron: Morning briefing 07:00 KST (22:00 UTC previous day)
cron.schedule('0 22 * * *', async () => {
  console.log('[Cron] Generating morning briefing...');
  try {
    await generateDailyReport('morning');
    console.log('[Cron] Morning briefing generated.');
  } catch (err) {
    console.error('[Cron] Morning briefing failed:', err.message);
  }
});

// Cron: Night review 22:00 KST (13:00 UTC)
cron.schedule('0 13 * * *', async () => {
  console.log('[Cron] Generating night review...');
  try {
    await generateDailyReport('night');
    console.log('[Cron] Night review generated.');
  } catch (err) {
    console.error('[Cron] Night review failed:', err.message);
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Mission Control API running on port ${PORT}`);
});
