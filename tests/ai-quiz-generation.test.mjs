import test from 'node:test';
import assert from 'node:assert/strict';
import { MODEL, geminiPayload, parseGeminiResponse, executeGeneration, rateLimitDetails } from '../supabase/functions/generate-quiz/core.mjs';
import { validateAiDraft } from '../src/ai-quiz-draft-validation.js';

const quiz = () => ({ title: '데이터 분석', description: '핵심 개념 문제', questions: Array.from({ length: 20 }, (_, index) => ({ question: `질문 ${index + 1}`, options: ['첫 번째', '두 번째', '세 번째', '네 번째'], correct: index % 4 + 1, explain: '정답에 대한 설명입니다.' })) });
const result = value => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(value) }] } }] });

test('구조화 결과를 기존 문제지 형식으로 변환하고 수정 내용을 확인한다', () => {
  const draft = parseGeminiResponse(result(quiz()));
  assert.equal(draft.questions.length, 20);
  assert.deepEqual(draft.questions[0].correct, [0]);
  assert.equal(draft.questions[19].id, 100020);
  assert.equal(validateAiDraft(draft), '');
  draft.questions[1].options[0] = '';
  assert.match(validateAiDraft(draft), /2번/);
});
test('문항 수, 중복 질문, 중복 보기와 정답 범위를 검증한다', () => {
  for (const change of [q => q.questions.pop(), q => { q.questions[1].question = q.questions[0].question; }, q => { q.questions[0].options[1] = q.questions[0].options[0]; }, q => { q.questions[0].correct = 5; }]) {
    const value = quiz(); change(value); assert.throws(() => parseGeminiResponse(result(value)));
  }
  assert.throws(() => parseGeminiResponse({ candidates: [{ finishReason: 'MAX_TOKENS' }] }));
});
test('성공한 생성만 예약을 확정한다', async () => {
  const transitions = [];
  const outcome = await executeGeneration({ reserve: async () => ({ status: 'reserved', remaining: 4 }), generate: async () => result(quiz()), finish: async success => { transitions.push(success); return true; } });
  assert.equal(outcome.quiz.questions.length, 20);
  assert.deepEqual(transitions, [true]);
});
test('429, 네트워크 장애와 잘못된 응답은 예약을 해제한다', async () => {
  for (const [generate, expected] of [[async () => { throw Object.assign(new Error('limited'), { code: 'rate_limit' }); }, 'rate_limit'], [async () => { throw new Error('network'); }, 'unavailable'], [async () => result({}), 'unavailable']]) {
    const transitions = [];
    const outcome = await executeGeneration({ reserve: async () => ({ status: 'reserved', remaining: 4 }), generate, finish: async success => { transitions.push(success); return true; } });
    assert.equal(outcome.error, expected);
    assert.deepEqual(transitions, [false]);
  }
});
test('사용량 확정에 실패하면 결과를 반환하지 않고 예약 해제를 시도한다', async () => {
  const transitions = [];
  const outcome = await executeGeneration({ reserve: async () => ({ status: 'reserved', remaining: 4 }), generate: async () => result(quiz()), finish: async success => { transitions.push(success); return !success; } });
  assert.equal(outcome.error, 'unavailable');
  assert.equal(outcome.diagnostic.stage, 'finalize');
  assert.equal(outcome.quiz, undefined);
  assert.deepEqual(transitions, [true, false]);
});
test('실패 원인은 입력 내용 없이 단계와 안전한 코드만 기록한다', async () => {
  const value = quiz(); value.questions[1].question = value.questions[0].question;
  const outcome = await executeGeneration({ reserve: async () => ({ status: 'reserved', remaining: 4 }), generate: async () => result(value), finish: async () => true });
  assert.deepEqual(outcome.diagnostic, { stage: 'validate', code: 'duplicate_question' });
  assert.equal(JSON.stringify(outcome).includes(value.questions[0].question), false);
});
test('회원 또는 전체 한도에 도달하면 모델을 호출하지 않는다', async () => {
  for (const [status, expected] of [['user_limit', 'user_limit'], ['global_limit', 'rate_limit'], ['in_progress', 'unavailable'], ['already_done', 'unavailable']]) {
    let called = false;
    const outcome = await executeGeneration({ reserve: async () => ({ status }), generate: async () => { called = true; }, finish: async () => true });
    assert.equal(outcome.error, expected);
    assert.equal(called, false);
  }
});
test('모델과 구조화 출력 설정을 사용한다', () => {
  assert.equal(MODEL, 'gemini-3.5-flash-lite');
  const payload = geminiPayload('SQL 문제');
  assert.equal(payload.generationConfig.responseFormat.text.mimeType, 'APPLICATION_JSON');
  assert.equal(payload.generationConfig.responseFormat.text.schema.properties.questions.minItems, 20);
  assert.match(payload.contents[0].parts[0].text, /SQL 문제/);
});
test('429는 제공된 제한 정보가 있을 때만 범위를 분류한다', () => {
  assert.deepEqual(rateLimitDetails({}, null), { scope: 'unknown', retry_after_seconds: null });
  assert.deepEqual(rateLimitDetails({ error: { details: [{ violations: [{ quotaId: 'GenerateRequestsPerDayPerProject' }] }, { retryDelay: '2s' }] } }, null), { scope: 'day', retry_after_seconds: 2 });
  assert.deepEqual(rateLimitDetails({ error: { details: [{ violations: [{ quotaId: 'RequestsPerDay' }, { quotaId: 'RequestsPerMinute' }] }] } }, '3'), { scope: 'multiple', retry_after_seconds: 3 });
});
