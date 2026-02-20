const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '../../data/tasks.json');

function readData() {
  const raw = fs.readFileSync(DATA_PATH, 'utf-8');
  return JSON.parse(raw);
}

function writeData(data) {
  data.updated_at = new Date().toISOString();
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

function getNextTaskId(data) {
  const maxId = data.tasks.reduce((max, t) => Math.max(max, t.id), 0);
  return maxId + 1;
}

module.exports = { readData, writeData, getNextTaskId };
