const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');
const LEGACY_DATA_PATH = path.join(DATA_DIR, 'tasks.json');

// Default template for new users
const DEFAULT_DATA = {
  tasks: [],
  objectives: [],
  brain_dumps: [],
  reminders: [],
  updated_at: new Date().toISOString(),
};

function getUserDataPath(uid) {
  if (!uid || uid === 'default') return LEGACY_DATA_PATH;
  return path.join(DATA_DIR, 'users', uid, 'tasks.json');
}

function ensureUserDir(uid) {
  if (!uid || uid === 'default') return;
  const userDir = path.join(DATA_DIR, 'users', uid);
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
    // Copy from legacy or create template
    if (fs.existsSync(LEGACY_DATA_PATH)) {
      // Don't copy legacy data to new users — start fresh
    }
    fs.writeFileSync(
      path.join(userDir, 'tasks.json'),
      JSON.stringify(DEFAULT_DATA, null, 2),
      'utf-8'
    );
  }
}

function readData(uid) {
  const dataPath = getUserDataPath(uid);
  if (!fs.existsSync(dataPath)) {
    ensureUserDir(uid);
    // If still doesn't exist (default user, first run), return template
    if (!fs.existsSync(dataPath)) {
      return JSON.parse(JSON.stringify(DEFAULT_DATA));
    }
  }
  const raw = fs.readFileSync(dataPath, 'utf-8');
  return JSON.parse(raw);
}

function writeData(data, uid) {
  const dataPath = getUserDataPath(uid);
  ensureUserDir(uid);
  data.updated_at = new Date().toISOString();
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf-8');
  return data;
}

function getNextTaskId(data) {
  if (data.tasks.length === 0) return 1;
  return Math.max(...data.tasks.map(t => t.id)) + 1;
}

// Generate compressed task list for AI classifier (token-saving)
function compressedTaskList(data) {
  return data.tasks
    .filter(t => t.status !== 'done')
    .map(t => `${t.id}:${t.name.substring(0, 8)}`)
    .join(' ');
}

// Generate MD from tasks.json for GitHub backup
function generateMarkdown(data) {
  const now = new Date().toISOString().split('T')[0];
  let md = `# Brian 태스크 현황 — ${now}\n\n---\n\n`;

  const priorityOrder = ['즉시', '단기', '중기', '장기'];
  const priorityLabels = {
    '즉시': '🔴 즉시 실행 (이번 주)',
    '단기': '🟡 이번 주~다음 주',
    '중기': '🟢 중기 프로젝트 (이번 달~다음 달)',
    '장기': '🔵 장기 프로젝트 (2~3개월+)'
  };

  for (const pri of priorityOrder) {
    const tasks = data.tasks.filter(t => t.priority === pri);
    if (tasks.length === 0) continue;

    md += `## ${priorityLabels[pri]}\n\n`;

    const sections = {};
    for (const t of tasks) {
      const sec = t.section || '기타';
      if (!sections[sec]) sections[sec] = [];
      sections[sec].push(t);
    }

    for (const [section, sectionTasks] of Object.entries(sections)) {
      if (section !== '기타') {
        md += `### ${section}\n\n`;
      }

      md += '| # | 항목 | 상태 | 비고 |\n';
      md += '|---|------|------|------|\n';

      for (const t of sectionTasks) {
        const status = t.status === 'done' ? '✅' : '⬜';
        md += `| ${t.id} | ${t.name} | ${status} | ${t.desc || ''} |\n`;
      }

      md += '\n';
    }

    md += '---\n\n';
  }

  return md;
}

// For backward compat: DATA_PATH alias
const DATA_PATH = LEGACY_DATA_PATH;

module.exports = { readData, writeData, getNextTaskId, compressedTaskList, generateMarkdown, DATA_PATH };
