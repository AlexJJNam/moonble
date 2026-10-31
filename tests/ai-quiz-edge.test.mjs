import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { build } from 'esbuild';

const bundle = await build({
  entryPoints: ['supabase/functions/generate-quiz/index.ts'], bundle: true, write: false, format: 'cjs', platform: 'node',
  plugins: [{ name: 'mock-supabase', setup(builder) {
    builder.onResolve({ filter: /^npm:@supabase\/supabase-js@2$/ }, () => ({ path: 'mock', namespace: 'test' }));
    builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export const createClient = (...args) => globalThis.__createClient(...args)', loader: 'js' }));
  } }],
});
const payload = { prompt: '테스트 비공개 요청', requestId: '27d6e91d-8888-4d6f-bab8-3ba1d34e5c40' };
const quiz = { title: '문제지', description: '설명', questions: Array.from({ length: 20 }, (_, index) => ({ question: `문항 ${index}`, options: ['가', '나', '다', '라'], correct: index % 4 + 1, explain: '해설' })) };
function setup({ signedIn = true, free = true, quota = 'reserved', fetchResponse } = {}) {
  let handler; let calls = 0; const finished = []; const logs = [];
  const env = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service', GEMINI_API_KEY: 'secret-not-for-logs', GEMINI_FREE_TIER_CONFIRMED: free ? 'true' : 'false' };
  const context = {
    Deno: { env: { get: key => env[key] }, serve: fn => { handler = fn; } },
    __createClient: (_url, key) => key === 'anon' ? { auth: { getUser: async () => ({ data: { user: signedIn ? { id: 'user' } : null }, error: signedIn ? null : new Error('bad token') }) } } : { rpc: async (name, args) => name === 'moonble_reserve_ai_quiz_generation' ? { data: { status: quota, remaining: quota === 'user_limit' ? 0 : 4 }, error: null } : (finished.push(args.p_success), { data: true, error: null }) },
    fetch: async () => { calls += 1; if (fetchResponse instanceof Error) throw fetchResponse; return fetchResponse || new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(quiz) }] } }], usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 34 } }), { status: 200, headers: { 'content-type': 'application/json' } }); },
    console: { log: value => logs.push(String(value)) }, Request, Response, AbortController, TextDecoder, setTimeout, clearTimeout, URL, Date,
  };
  vm.runInNewContext(bundle.outputFiles[0].text, context);
  const run = (token = 'user-jwt', body = payload) => handler(new Request('https://example.supabase.co/functions/v1/generate-quiz', { method: 'POST', headers: { authorization: `Bearer ${token}`, origin: 'https://moonble.com', 'content-type': 'application/json' }, body: JSON.stringify(body) }));
  return { run, finished, logs, get calls() { return calls; } };
}

test('인증되지 않은 요청은 Gemini와 사용량 DB를 호출하지 않는다', async () => {
  const app = setup({ signedIn: false });
  const response = await app.run();
  assert.equal(response.status, 401); assert.equal(app.calls, 0); assert.deepEqual(app.finished, []);
});
test('무료 요금제 확인이 없으면 Gemini를 호출하지 않는다', async () => {
  const app = setup({ free: false });
  const response = await app.run();
  assert.equal(response.status, 503); assert.equal(app.calls, 0);
});
test('너무 긴 입력은 모델을 호출하기 전에 거절한다', async () => {
  const app = setup();
  const response = await app.run('user-jwt', { ...payload, prompt: 'a'.repeat(9000) });
  assert.equal(response.status, 400); assert.equal(app.calls, 0); assert.deepEqual(app.finished, []);
});
test('검증된 20문항만 반환하고 사용량을 한 번 확정한다', async () => {
  const app = setup(); const response = await app.run(); const body = await response.json();
  assert.equal(response.status, 200); assert.equal(body.quiz.questions.length, 20); assert.equal(body.remaining, 4);
  assert.deepEqual(app.finished, [true]); assert.equal(app.calls, 1);
  assert.equal(app.logs.join(' ').includes(payload.prompt), false); assert.equal(app.logs.join(' ').includes('secret-not-for-logs'), false);
});
test('회원 한도에 도달하면 Gemini를 호출하지 않는다', async () => {
  const app = setup({ quota: 'user_limit' }); const body = await (await app.run()).json();
  assert.equal(body.error, 'user_limit'); assert.equal(app.calls, 0); assert.deepEqual(app.finished, []);
});
test('Gemini 429와 네트워크 실패는 예약을 실패로 되돌린다', async () => {
  for (const failure of [new Response('{}', { status: 429, headers: { 'retry-after': '2' } }), new Error('network')]) {
    const app = setup({ fetchResponse: failure }); const body = await (await app.run()).json();
    assert.equal(body.error, failure instanceof Error ? 'unavailable' : 'rate_limit'); assert.deepEqual(app.finished, [false]);
  }
});
