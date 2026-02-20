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
  return data;
}

function getNextTaskId(data) {
  if (data.tasks.length === 0) return 1;
  return Math.max(...data.tasks.map(t => t.id)) + 1;
}

// Generate compressed task list for AI classifier (token-saving)
// Format: "1:트렌딩뮤직 2:포스팅빈도 3:영상길이 ..."
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

    // Group by section
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

module.exports = { readData, writeData, getNextTaskId, compressedTaskList, generateMarkdown, DATA_PATH };
