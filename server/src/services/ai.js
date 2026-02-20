const Anthropic = require('@anthropic-ai/sdk');

let _anthropic;
function getClient() {
  if (!_anthropic) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set');
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}

/**
 * Haiku 분류기: 음성 텍스트 → 태스크 액션 판단
 * 토큰 절약: 태스크 목록을 ID+이름만 압축 전송 (~200 tokens)
 */
async function classifyVoiceInput(transcript, tasks) {
  // 토큰 절약: ID:이름 형태로 압축
  const taskList = tasks.map(t => `${t.id}:${t.name}`).join(' ');

  const response = await getClient().messages.create({
    model: 'claude-haiku-4-20250414',
    max_tokens: 300,
    system: `당신은 태스크 업데이트 분류기입니다.
유저의 음성 입력을 분석해서 JSON 배열로 반환하세요.

가능한 action:
- check: 태스크 완료 처리
- uncheck: 완료 취소
- update: 태스크 내용 수정
- add: 새 태스크 추가
- note: 메모만 추가 (태스크 변경 없음)

태스크 목록(ID:이름): ${taskList}

반드시 아래 JSON 형식으로만 응답하세요:
{"actions":[{"action":"check","task_id":1,"note":"완료 메모"},{"action":"add","name":"새 태스크 이름","category":"content","priority":"단기"}]}`,
    messages: [
      { role: 'user', content: transcript }
    ],
  });

  const text = response.content[0].text;

  // Extract JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Failed to parse classifier response');

  return JSON.parse(jsonMatch[0]);
}

/**
 * Sonnet 브레인덤프 파서: 긴 텍스트 → 새 태스크 추출
 * 호출 빈도: 하루 1~3번 (토큰 ~1,000)
 */
async function parseBrainDump(text, tasks) {
  const taskList = tasks.map(t => `${t.id}:${t.name}(${t.priority})`).join(', ');

  const response = await getClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    system: `당신은 브레인덤프 파서입니다. 유저의 자유 형식 메모에서 실행 가능한 태스크를 추출하세요.

현재 태스크 목록: ${taskList}

규칙:
1. 기존 태스크와 겹치면 update로 처리 (task_id 포함)
2. 새로운 아이디어면 add로 처리
3. category: content, auto, growth, infra 중 선택
4. priority: 즉시, 단기, 중기, 장기 중 선택

JSON으로만 응답:
{"new_tasks":[{"name":"...","desc":"...","category":"content","priority":"단기","section":"..."}],"updates":[{"task_id":1,"field":"desc","value":"새 설명"}],"summary":"한 줄 요약"}`,
    messages: [
      { role: 'user', content: text }
    ],
  });

  const responseText = response.content[0].text;
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Failed to parse brain dump response');

  return JSON.parse(jsonMatch[0]);
}

/**
 * Haiku 데일리 리포트: 변경 사항(diff)만 전송
 * 호출 빈도: 하루 1~2번 (토큰 ~500)
 */
async function generateBriefing(type, todayChanges, stats) {
  const prompt = type === 'morning'
    ? `어제 변경사항과 오늘 할 일을 요약하세요. 간결하게 3~5줄로.`
    : `오늘 완료한 것과 내일 추천 태스크 3개를 알려주세요. 간결하게.`;

  const response = await getClient().messages.create({
    model: 'claude-haiku-4-20250414',
    max_tokens: 500,
    system: `당신은 Brian의 프로젝트 매니저입니다. ${prompt}
통계: ${JSON.stringify(stats)}`,
    messages: [
      { role: 'user', content: `변경사항: ${JSON.stringify(todayChanges)}` }
    ],
  });

  return response.content[0].text;
}

module.exports = { classifyVoiceInput, parseBrainDump, generateBriefing };
