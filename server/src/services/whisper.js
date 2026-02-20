const OpenAI = require('openai');
const fs = require('fs');

let _openai;
function getClient() {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

/**
 * Whisper STT: 음성 파일 → 텍스트
 * 비용: $0.006/분 × 평균 0.5분 = $0.003/call
 */
async function transcribeAudio(filePath) {
  const file = fs.createReadStream(filePath);

  const transcription = await getClient().audio.transcriptions.create({
    file,
    model: 'whisper-1',
    language: 'ko',
    response_format: 'text',
  });

  return transcription;
}

module.exports = { transcribeAudio };
