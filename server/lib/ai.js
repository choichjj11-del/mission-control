const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');
const config = require('../config');

// ===== ElevenLabs Scribe v2 STT =====
// Pro plan includes ~25hrs/month free. Korean WER 3.1% (vs Whisper ~8-12%)
async function transcribeAudio(filePath) {
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));
  form.append('model_id', config.STT.MODEL);
  form.append('language_code', config.STT.LANGUAGE);
  form.append('tag_audio_events', 'false');

  const resp = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: {
      'xi-api-key': config.ELEVENLABS_API_KEY,
      ...form.getHeaders(),
    },
    body: form,
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`ElevenLabs Scribe error: ${resp.status} ${err}`);
  }

  const result = await resp.json();
  return result.text;
}

// ===== OpenAI GPT API call (shared helper) =====
async function callGPT(model, systemPrompt, userMessage, maxTokens = 500) {
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature: 0.3,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`OpenAI API error: ${resp.status} ${err}`);
  }

  const result = await resp.json();
  return result.choices[0].message.content;
}

// ===== GPT-4o-mini Smart Agent =====
// Full agent: check, uncheck, add, update, note, schedule, remind, query, report, prioritize
async function agentProcess(transcript, compressedTasks, todayDate) {
  const systemPrompt = `당신은 Brian의 개인 비서 에이전트입니다. 음성 입력을 분석해서 JSON으로 반환하세요.

가능한 action:
- check: 태스크 완료 {"action":"check","task_id":1,"note":"완료"}
- uncheck: 완료 해제 {"action":"uncheck","task_id":1}
- add: 새 태스크 추가 {"action":"add","new_task":"이름","desc":"설명","priority":"즉시|단기|중기|장기","category":"content|auto|growth|infra"}
- update: 태스크 수정 {"action":"update","task_id":1,"note":"추가 메모"}
- schedule: 태스크 날짜 변경 {"action":"schedule","task_id":1,"day":5}
- prioritize: 우선순위 변경 {"action":"prioritize","task_id":1,"priority":"즉시"}
- remind: 리마인더 설정 {"action":"remind","message":"알림 내용","remind_at":"2026-02-22T06:00:00+09:00"}
- query: 질문에 대한 답변 {"action":"query","response":"오늘 할 일은 3개입니다: ..."}
- report: 즉석 리포트 {"action":"report","response":"오늘 2개 완료, 즉시 실행 4개 남음"}
- note: 메모 저장 {"action":"note","note":"메모 내용"}

현재 태스크 (ID:이름):
${compressedTasks}

오늘 날짜: ${todayDate}
타임존: KST (UTC+9)

규칙:
- 반드시 JSON만 반환. 설명 없이.
- 여러 액션이면 배열: [action1, action2]
- 단일 액션이면 객체: {action}
- remind의 remind_at은 반드시 ISO 8601 형식 (KST +09:00)
- "내일 6시" → 내일 06:00 KST
- query/report의 response는 한국어로 간결하게`;

  const raw = await callGPT(config.AI.AGENT_MODEL, systemPrompt, transcript, 500);
  const jsonStr = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(jsonStr);
}

// ===== Brain Dump Parser =====
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

  const raw = await callGPT(config.AI.AGENT_MODEL, systemPrompt, text, 1000);
  const jsonStr = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(jsonStr);
}

// ===== Report Generators =====
async function generateDailyReport(todayChanges, stats) {
  const systemPrompt = `당신은 데일리 리포트 생성기입니다.
오늘 변경된 태스크와 통계를 받아서 한국어 브리핑 텍스트를 생성하세요.
짧고 액셔너블하게. 이모지 사용 OK. 3~5줄.`;

  const userMsg = `오늘 변경사항:\n${todayChanges}\n\n통계:\n${stats}`;
  return callGPT(config.AI.REPORT_MODEL, systemPrompt, userMsg, 500);
}

async function generateWeeklyReport(weekSummary) {
  const systemPrompt = `당신은 주간 리포트 생성기입니다.
이번 주 완료/진행/미완료 태스크를 분석하고 한국어로 주간 리포트를 작성하세요.
섹션: 이번 주 성과, 미완료 항목, 다음 주 추천 액션. 마크다운 형식.`;

  return callGPT(config.AI.REPORT_MODEL, systemPrompt, weekSummary, 800);
}

// ===== Voice To-Do Parser =====
async function parseVoiceTodos(transcript) {
  const systemPrompt = `당신은 할 일 정리 도우미입니다.
유저가 음성으로 말한 내용에서 할 일(To-Do) 항목들을 추출하세요.

규칙:
- 할 일이 아닌 일반 대화/인사는 무시
- 중복 항목은 하나로 합치기
- 각 항목은 15자 이내로 간결하게
- 반드시 JSON 배열만 반환: ["할일1", "할일2", "할일3"]
- 할 일이 없으면 빈 배열: []`;

  const raw = await callGPT(config.AI.AGENT_MODEL, systemPrompt, transcript, 300);
  const jsonStr = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(jsonStr);
}

module.exports = {
  transcribeAudio,
  callGPT,
  agentProcess,
  parseBrainDump,
  generateDailyReport,
  generateWeeklyReport,
  parseVoiceTodos,
};
