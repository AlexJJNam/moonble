export const MODEL = 'gemini-3.5-flash-lite';
export const QUESTION_COUNT = 20;

const questionSchema = {
  type: 'object',
  properties: {
    question: { type: 'string' },
    options: { type: 'array', items: { type: 'string' }, minItems: 4, maxItems: 4 },
    correct: { type: 'integer', minimum: 1, maximum: 4 },
    explain: { type: 'string' },
  },
  required: ['question', 'options', 'correct', 'explain'],
};
export const responseSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    questions: { type: 'array', items: questionSchema, minItems: QUESTION_COUNT, maxItems: QUESTION_COUNT },
  },
  required: ['title', 'description', 'questions'],
};

export function geminiPayload(prompt) {
  return {
    contents: [{ role: 'user', parts: [{ text: `다음 요청에 맞는 한국어 객관식 문제지 20문항을 만드세요.\n요청: ${prompt}\n\n각 문항은 서로 달라야 하며 보기 4개도 서로 달라야 합니다. 정답 번호는 1~4로 골고루 분배하고, 정답과 짧은 해설이 일치하는지 확인하세요. 제목과 한 문장 설명도 작성하세요. 정확하지 않거나 모호한 문제는 피하세요.` }] }],
    generationConfig: { maxOutputTokens: 8192, responseFormat: { text: { mimeType: 'APPLICATION_JSON', schema: responseSchema } } },
  };
}

const clean = (value, max) => typeof value === 'string' && value.trim() && value.trim().length <= max ? value.trim() : null;
const normalized = value => value.normalize('NFKC').replace(/\s+/g, '').toLowerCase();
export function validateQuiz(value) {
  const title = clean(value?.title, 80);
  const description = clean(value?.description, 160);
  if (!title || !description || !Array.isArray(value?.questions) || value.questions.length !== QUESTION_COUNT) throw new Error('invalid_quiz');
  const seen = new Set();
  const questions = value.questions.map((item, index) => {
    const q = clean(item?.question, 2000);
    const explain = clean(item?.explain, 2000);
    if (!q || !explain || !Array.isArray(item?.options) || item.options.length !== 4 || !Number.isInteger(item?.correct) || item.correct < 1 || item.correct > 4) throw new Error('invalid_quiz');
    const options = item.options.map(option => clean(option, 500));
    const key = normalized(q);
    if (options.some(option => !option) || new Set(options.map(normalized)).size !== 4 || seen.has(key)) throw new Error('invalid_quiz');
    seen.add(key);
    return { id: 100001 + index, q, options, correct: [item.correct - 1], explain, multi: false };
  });
  return { title, description, questions };
}

export function parseGeminiResponse(body) {
  const candidate = body?.candidates?.[0];
  if (candidate?.finishReason !== 'STOP') throw new Error('invalid_response');
  const text = candidate?.content?.parts?.filter(part => typeof part.text === 'string' && !part.thought).map(part => part.text).join('');
  if (!text || text.length > 150000) throw new Error('invalid_response');
  return validateQuiz(JSON.parse(text));
}

export function quotaMessage(status) {
  if (status === 'user_limit') return 'user_limit';
  if (status === 'global_limit' || status === 'rate_limit') return 'rate_limit';
  return 'unavailable';
}

export function rateLimitDetails(body, retryAfter, now = Date.now()) {
  const details = Array.isArray(body?.error?.details) ? body.error.details : [];
  const ids = details.flatMap(detail => Array.isArray(detail?.violations) ? detail.violations.map(item => typeof item?.quotaId === 'string' ? item.quotaId : '') : []);
  const day = ids.some(id => /perday|per_day/i.test(id));
  const minute = ids.some(id => /perminute|per_minute/i.test(id));
  const header = typeof retryAfter === 'string' ? retryAfter.trim() : '';
  let seconds = header && /^\d+(?:\.\d+)?$/.test(header) ? Number(header) : null;
  if (seconds === null && header) { const date = Date.parse(header); if (Number.isFinite(date)) seconds = Math.max(0, (date - now) / 1000); }
  if (seconds === null) {
    const retryInfo = details.find(detail => typeof detail?.retryDelay === 'string' && /^\d+(?:\.\d+)?s$/.test(detail.retryDelay));
    if (retryInfo) seconds = Number(retryInfo.retryDelay.slice(0, -1));
  }
  return { scope: day && minute ? 'multiple' : day ? 'day' : minute ? 'minute' : 'unknown', retry_after_seconds: Number.isFinite(seconds) ? seconds : null };
}

// 예약이 확정되기 전에는 결과를 반환하지 않고, 실패하면 예약을 해제합니다.
export async function executeGeneration({ reserve, generate, finish }) {
  let reservation;
  try { reservation = await reserve(); }
  catch { return { error: 'unavailable' }; }
  if (!reservation || reservation.status !== 'reserved') return { error: quotaMessage(reservation?.status), remaining: reservation?.remaining ?? null };
  let success = false;
  try {
    const quiz = parseGeminiResponse(await generate());
    if (await finish(true) !== true) throw new Error('finalize_failed');
    success = true;
    return { quiz, remaining: reservation.remaining };
  } catch (error) {
    return { error: error?.code === 'rate_limit' ? 'rate_limit' : 'unavailable' };
  } finally {
    if (!success) { try { await finish(false); } catch { /* 만료된 예약은 다음 요청에서 해제합니다. */ } }
  }
}
