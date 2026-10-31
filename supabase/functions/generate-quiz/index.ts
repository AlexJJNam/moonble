import { createClient } from 'npm:@supabase/supabase-js@2';
import { MODEL, geminiPayload, executeGeneration, rateLimitDetails } from './core.mjs';

const allowedOrigin = (origin: string) => /^https:\/\/(www\.)?moonble\.com$/.test(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
const headersFor = (request: Request) => {
  const origin = request.headers.get('origin') || '';
  return { 'content-type': 'application/json; charset=utf-8', 'vary': 'Origin', ...(allowedOrigin(origin) ? { 'access-control-allow-origin': origin, 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type', 'access-control-allow-methods': 'POST, OPTIONS' } : {}) };
};
const response = (request: Request, status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: headersFor(request) });
async function readInput(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('missing_body');
  const decoder = new TextDecoder();
  let length = 0;
  let raw = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 8192) { await reader.cancel(); throw new Error('body_too_large'); }
    raw += decoder.decode(value, { stream: true });
  }
  return JSON.parse(raw + decoder.decode());
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: headersFor(request) });
  if (request.method !== 'POST') return response(request, 405, { error: 'method' });
  const url = Deno.env.get('SUPABASE_URL') || '';
  const anon = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const geminiKey = Deno.env.get('GEMINI_API_KEY') || '';
  const token = (request.headers.get('Authorization') || '').match(/^Bearer\s+(.+)$/i)?.[1] || '';
  if (!url || !anon || !serviceKey || !token) return response(request, 401, { error: 'auth' });
  const auth = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await auth.auth.getUser(token);
  if (authError || !authData.user?.id) return response(request, 401, { error: 'auth' });
  let input: { prompt?: unknown; requestId?: unknown };
  try {
    input = await readInput(request);
  } catch { return response(request, 400, { error: 'invalid_request' }); }
  const prompt = typeof input?.prompt === 'string' ? input.prompt.trim() : '';
  const requestId = typeof input?.requestId === 'string' ? input.requestId : '';
  if (!prompt || prompt.length > 1200 || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) return response(request, 400, { error: 'invalid_request' });
  // 프로젝트가 무료 요금제임을 운영자가 확인한 경우에만 호출합니다.
  if (!geminiKey || Deno.env.get('GEMINI_FREE_TIER_CONFIRMED') !== 'true') return response(request, 503, { error: 'unavailable' });
  const limitText = Deno.env.get('GEMINI_GLOBAL_DAILY_LIMIT')?.trim() || '';
  const globalLimit = limitText ? Number(limitText) : null;
  if (globalLimit !== null && (!Number.isInteger(globalLimit) || globalLimit < 1 || globalLimit > 1000000)) return response(request, 503, { error: 'unavailable' });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const userId = authData.user.id;
  let inputTokens = 0;
  let outputTokens = 0;
  let thinkingTokens = 0;
  let httpStatus = 0;
  const result = await executeGeneration({
    reserve: async () => {
      const reservation = await admin.rpc('moonble_reserve_ai_quiz_generation', { p_user_id: userId, p_request_id: requestId, p_global_limit: globalLimit });
      if (reservation.error) throw Object.assign(new Error('reserve_failed'), { dbCode: reservation.error.code });
      return reservation.data;
    },
    finish: async (completed: boolean) => {
      const finished = await admin.rpc('moonble_finish_ai_quiz_generation', { p_user_id: userId, p_request_id: requestId, p_success: completed });
      if (finished.error) throw Object.assign(new Error('database_error'), { dbCode: finished.error.code });
      return finished.data === true;
    },
    generate: async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000);
      try {
        const api = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
          method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': geminiKey },
          body: JSON.stringify(geminiPayload(prompt)), signal: controller.signal,
        });
        httpStatus = api.status;
        if (!api.ok) {
          // 제공된 quotaId와 Retry-After만 분류하고 오류 원문은 기록하지 않습니다.
          const detail = api.status === 429 ? await api.json().catch(() => null) : null;
          console.log(JSON.stringify({ event: 'gemini_quiz_api_error', status: api.status, ...rateLimitDetails(detail, api.headers.get('retry-after')) }));
          throw Object.assign(new Error('generation_failed'), { code: api.status === 429 ? 'rate_limit' : 'unavailable' });
        }
        const body = await api.json();
        inputTokens = Number(body?.usageMetadata?.promptTokenCount) || 0;
        outputTokens = Number(body?.usageMetadata?.candidatesTokenCount) || 0;
        thinkingTokens = Number(body?.usageMetadata?.thoughtsTokenCount) || 0;
        return body;
      } finally { clearTimeout(timeout); }
    },
  });
  const { diagnostic, ...publicResult } = result;
  console.log(JSON.stringify({ event: 'gemini_quiz_generation', outcome: result.error || 'success', stage: diagnostic?.stage || null, code: diagnostic?.code || null, http_status: httpStatus || null, input_tokens: inputTokens, output_tokens: outputTokens, thinking_tokens: thinkingTokens }));
  return response(request, 200, publicResult);
});
