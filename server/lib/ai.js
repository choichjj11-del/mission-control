const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');
const config = require('../config');

// ===== Whisper STT =====
async function transcribeAudio(filePath) {
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));
  form.append('model', config.WHISPER_MODEL);
  form.append('language', 'ko');

  const resp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.OPENAI_API_KEY}` },
    body: form,
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Whisper API error: ${resp.status} ${err}`);
  }

  const result = await resp.json();
  return result.text;
}

// ===== Claude API call (shared helper) =====
async function callClaude(model, systemPrompt, userMessage, maxTokens = 300) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Claude API error: ${resp.status} ${err}`);
  }

  const result = await resp.json();
  return result.content[0].text;
}

// ===== Haiku Classifier (token-saving) =====
// Input: STT text + compressed task list (ID:name only)
// Output: JSON action {action, task_id, note}
async function classifyVoiceInput(transcript, compressedTasks) {
  const systemPrompt = `당신은 태스크 업데이트 분류기입니다.
유저의 음성 입력을 분석해서 JSON으로 반환하세요.

가능한 action:
- check: 태스크 완료 체크
- uncheck: 태스크 완료 해제
- add: 새 태스크 추가 (task_id는 null, new_task에 이름)
- update: 기존 태스크 설명/메모 수정
- note: 메모만 추가 (특정 태스크 없음)

현재 태스크 목록 (ID:이름):
${compressedTasks}

반드시 JSON만 반환하세요. 설명 없이.
여러 액션이면 배열로: [{"action":"check","task_id":1,"note":"완료"},{"action":"add","task_id":null,"new_task":"새작업","note":""}]
단일 액션이면 객체로: {"action":"check","task_id":1,"note":"3개 적용 완료"}`;

  const raw = await callClaude(config.AI.CLASSIFIER_MODEL, systemPrompt, transcript, 300);

  // Parse JSON from response (handle potential markdown wrapping)
  const jsonStr = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(jsonStr);
}

// ===== Sonnet Brain Dump Parser =====
// Input: long text + current task list (full names but no descriptions)
// Output: JSON with new/updated tasks
async function parseBrainDump(text, taskList) {
  const taskSummary = taskList
    .map(t => `${t.id}:${t.name}(${t.priority})`)
    .join(', ');

  const systemPrompt = `당신은 브레인덤프 파서입니다.
유저가 자유롭게 말한 아이디어/생각을 분석해서:
1. 기존 태스크에 대한 업데이트인지
2. 새로운 태스크를 추가해야 하는지
판단하고 JSON으로 반환하세요.

현재 태스크: ${taskSummary}

응답 형식 (JSON만, 설명 없이):
{
  "new_tasks": [
    {"name": "태스크명", "desc": "설명", "category": "content|auto|growth|infra", "priority": "즉시|단기|중기|장기", "section": "섹션명"}
  ],
  "updates": [
    {"task_id": 1, "field": "desc", "value": "업데이트된 설명"}
  ],
  "summary": "브레인덤프 요약 (1~2줄)"
}`;

  const raw = await callClaude(config.AI.BRAINDUMP_MODEL, systemPrompt, text, 1000);
  const jsonStr = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(jsonStr);
}

// ===== Haiku Report Generator =====
async function generateDailyReport(todayChanges, stats) {
  const systemPrompt = `당신은 데일리 리포트 생성기입니다.
오늘 변경된 태스크와 통계를 받아서 한국어 브리핑 텍스트를 생성하세요.
짧고 액셔너블하게. 이모지 사용 OK. 3~5줄.`;

  const userMsg = `오늘 변경사항:\n${todayChanges}\n\n통계:\n${stats}`;
  return callClaude(config.AI.REPORT_MODEL, systemPrompt, userMsg, 500);
}

async function generateWeeklyReport(weekSummary) {
  const systemPrompt = `당신은 주간 리포트 생성기입니다.
이번 주 완료/진행/미완료 태스크를 분석하고 한국어로 주간 리포트를 작성하세요.
섹션: 이번 주 성과, 미완료 항목, 다음 주 추천 액션. 마크다운 형식.`;

  return callClaude(config.AI.REPORT_MODEL, systemPrompt, weekSummary, 800);
}

module.exports = {
  transcribeAudio,
  classifyVoiceInput,
  parseBrainDump,
  generateDailyReport,
  generateWeeklyReport,
};
