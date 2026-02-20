const fs = require('fs');
const path = require('path');
const { readData } = require('./store');

const MD_PATH = path.join(__dirname, '../../../master_tasks.md');

const PRIORITY_ORDER = ['즉시', '단기', '중기', '장기'];
const PRIORITY_EMOJI = { '즉시': '🔴', '단기': '🟡', '중기': '🟢', '장기': '🔵' };
const PRIORITY_LABEL = { '즉시': '즉시 실행 (이번 주)', '단기': '이번 주~다음 주', '중기': '중기 프로젝트 (이번 달~다음 달)', '장기': '장기 프로젝트 (2~3개월+)' };

function generateMarkdown() {
  const data = readData();
  const today = new Date().toISOString().split('T')[0].replace(/-/g, '.');
  let md = `# Brian 태스크 현황 — ${today}\n\n---\n`;

  for (const pri of PRIORITY_ORDER) {
    const tasks = data.tasks.filter(t => t.priority === pri);
    if (tasks.length === 0) continue;

    md += `\n## ${PRIORITY_EMOJI[pri]} ${PRIORITY_LABEL[pri]}\n\n`;

    // Group by section
    const sections = {};
    tasks.forEach(t => {
      const key = t.section || '기타';
      if (!sections[key]) sections[key] = [];
      sections[key].push(t);
    });

    for (const [section, sectionTasks] of Object.entries(sections)) {
      if (pri === '즉시' || pri === '단기') {
        md += `### ${section}\n\n`;
        md += `| # | 항목 | 상태 | 비고 |\n`;
        md += `|---|------|------|------|\n`;
        sectionTasks.forEach(t => {
          const status = t.status === 'done' ? '✅' : '⬜';
          md += `| ${t.id} | ${t.name} | ${status} | ${t.desc || ''} |\n`;
        });
        md += '\n';
      } else {
        md += `| # | 프로젝트 | 설명 | 우선순위 |\n`;
        md += `|---|---------|------|--------|\n`;
        sectionTasks.forEach(t => {
          const highlight = t.tags?.includes('highlight') ? '🔴 높음' : '';
          md += `| ${t.id} | ${t.name} | ${t.desc || ''} | ${highlight} |\n`;
        });
        md += '\n';
        break; // Only one table for 중기/장기
      }
    }
  }

  return md;
}

function writeMarkdown() {
  const md = generateMarkdown();
  fs.writeFileSync(MD_PATH, md, 'utf-8');
  return md;
}

module.exports = { generateMarkdown, writeMarkdown };
