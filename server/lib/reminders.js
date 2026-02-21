const fs = require('fs');
const path = require('path');

const REMINDERS_PATH = path.join(__dirname, '../../data/reminders.json');

function readReminders() {
  if (!fs.existsSync(REMINDERS_PATH)) {
    fs.writeFileSync(REMINDERS_PATH, JSON.stringify([], null, 2), 'utf-8');
    return [];
  }
  return JSON.parse(fs.readFileSync(REMINDERS_PATH, 'utf-8'));
}

function writeReminders(reminders) {
  fs.writeFileSync(REMINDERS_PATH, JSON.stringify(reminders, null, 2), 'utf-8');
}

function addReminder({ message, remind_at, created_at }) {
  const reminders = readReminders();
  reminders.push({
    id: `rem-${Date.now()}`,
    message,
    remind_at,
    created_at,
    sent: false,
  });
  writeReminders(reminders);
}

// Called every minute by cron — check for due reminders
function getDueReminders() {
  const reminders = readReminders();
  const now = new Date();
  const due = [];

  for (const rem of reminders) {
    if (rem.sent) continue;
    const remTime = new Date(rem.remind_at);
    if (remTime <= now) {
      rem.sent = true;
      due.push(rem);
    }
  }

  if (due.length > 0) {
    writeReminders(reminders);
  }

  return due;
}

module.exports = { addReminder, getDueReminders, readReminders };
