import { supabase } from './supabase.js';

const TOKEN_CACHE_PREFIX = 'moonble:user:';
const TOKEN_CACHE_SUFFIX = ':quiz-share-links-v1';

function makeToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = '';
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export async function hashQuizShareToken(token) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{40,50}$/.test(token)) {
    throw new Error('공유 링크가 올바르지 않거나 만료됐어요.');
  }
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function tokenCacheKey(userId) {
  return userId ? `${TOKEN_CACHE_PREFIX}${userId}${TOKEN_CACHE_SUFFIX}` : null;
}

function readTokenCache(userId) {
  try { return JSON.parse(localStorage.getItem(tokenCacheKey(userId)) || '{}'); }
  catch { return {}; }
}

export function getCachedQuizShareToken(userId, bankId) {
  return readTokenCache(userId)[bankId] || null;
}

export function cacheQuizShareToken(userId, bankId, token) {
  const key = tokenCacheKey(userId);
  if (!key) return;
  try {
    const cache = readTokenCache(userId);
    cache[bankId] = token;
    localStorage.setItem(key, JSON.stringify(cache));
  } catch { /* 저장 공간이 제한되어도 생성된 링크는 현재 화면에서 복사할 수 있다. */ }
}

export function clearCachedQuizShareToken(userId, bankId) {
  const key = tokenCacheKey(userId);
  if (!key) return;
  try {
    const cache = readTokenCache(userId);
    delete cache[bankId];
    localStorage.setItem(key, JSON.stringify(cache));
  } catch { /* 서버 공유 중지는 저장 공간 제한과 무관하게 처리한다. */ }
}

export function quizShareUrl(token, baseUrl = window.location.href) {
  const url = new URL('./solve.html', baseUrl);
  // Fragment는 서버 요청·Referer·Analytics page_path에 포함되지 않는다.
  url.search = '';
  url.hash = `share=${token}`;
  return url.href;
}

function requireSupabase() {
  if (!supabase) throw new Error('공유 기능에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.');
  return supabase;
}

export async function createQuizShare(userId, bank) {
  const token = makeToken();
  const tokenHash = await hashQuizShareToken(token);
  const { error } = await requireSupabase().rpc('moonble_create_quiz_share', {
    p_bank_id: bank.id,
    p_token_hash: tokenHash,
  });
  if (error) throw new Error('공유 링크를 만들지 못했어요. DB 설정을 확인한 뒤 다시 시도해주세요.');
  cacheQuizShareToken(userId, bank.id, token);
  return token;
}

export async function getQuizShare(token) {
  const tokenHash = await hashQuizShareToken(token);
  const { data, error } = await requireSupabase().rpc('moonble_get_quiz_share', { p_token_hash: tokenHash });
  if (error) throw new Error('공유 문제를 불러오지 못했어요. 링크를 만든 사람에게 새 링크를 요청해주세요.');
  if (!data || typeof data !== 'object' || typeof data.title !== 'string' || !Array.isArray(data.questions)) {
    throw new Error('공유 링크가 중지됐어요. 링크를 만든 사람에게 새 링크를 요청해주세요.');
  }
  const questions = data.questions.filter(question => question
    && Number.isInteger(question.id)
    && typeof question.q === 'string'
    && Array.isArray(question.options)
    && question.options.length >= 2
    && question.options.every(option => typeof option === 'string')
    && Array.isArray(question.correct)
    && question.correct.length > 0
    && question.correct.every(index => Number.isInteger(index) && index >= 0 && index < question.options.length));
  if (questions.length !== data.questions.length || !questions.length) {
    throw new Error('공유 문제 형식이 올바르지 않습니다. 링크를 만든 사람에게 알려주세요.');
  }
  return {
    title: data.title.slice(0, 100),
    description: typeof data.description === 'string' ? data.description.slice(0, 300) : '',
    questions: questions.map(question => ({ ...question, explain: typeof question.explain === 'string' ? question.explain : '' })),
  };
}

export async function revokeQuizShare(bankId) {
  const { error } = await requireSupabase().rpc('moonble_revoke_quiz_share', { p_bank_id: bankId });
  if (error) throw new Error('공유 링크를 중지하지 못했어요. 잠시 후 다시 시도해주세요.');
}
