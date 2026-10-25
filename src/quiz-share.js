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

export function quizShareUrl(token, tint = '#e8f3ff', groupName = '미분류') {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{40,50}$/.test(token)) {
    throw new Error('공유 링크가 올바르지 않거나 만료됐어요.');
  }
  // Kakao caches Open Graph cards by URL; version this preview so each thumbnail refreshes.
  const query = new URLSearchParams({ preview: '3', tint, group: groupName.slice(0, 80) });
  return `https://share.moonble.com/${encodeURIComponent(token)}?${query.toString()}`;
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

export async function submitQuizShareAttempt(token, answers) {
  if (!Array.isArray(answers) || !answers.length || answers.length > 20) {
    throw new Error('풀이 결과를 저장하지 못했어요.');
  }
  const tokenHash = await hashQuizShareToken(token);
  const submissionId = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
      const random = crypto.getRandomValues(new Uint8Array(1))[0] & 15;
      return (char === 'x' ? random : (random & 3) | 8).toString(16);
    });
  const { data, error } = await requireSupabase().rpc('moonble_submit_shared_quiz', {
    p_token_hash: tokenHash,
    p_submission_id: submissionId,
    p_answers: answers,
  });
  if (error || !data?.saved) throw new Error('공유한 사람에게 풀이 결과를 알리지 못했어요.');

  let rankData = null;
  let rankAvailable = false;
  try {
    const participantId = getQuizShareParticipantId(tokenHash);
    const rankResult = await requireSupabase().rpc('moonble_get_quiz_share_rank', {
      p_token_hash: tokenHash,
      p_submission_id: submissionId,
      p_participant_id: participantId,
    });
    if (!rankResult.error && rankResult.data && Number.isInteger(rankResult.data.rank) && Number.isInteger(rankResult.data.participants)) {
      rankData = rankResult.data;
      rankAvailable = true;
    }
  } catch { /* 순위 조회 실패와 풀이 결과 저장은 분리한다. */ }
  return { ...data, rankAvailable, rank: rankData?.rank ?? null, participants: rankData?.participants ?? null, bestScore: rankData?.best_score ?? null };
}

function getQuizShareParticipantId(tokenHash) {
  const key = `moonble:quiz-share-participant:${tokenHash}`;
  try {
    const existing = localStorage.getItem(key);
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(existing || '')) return existing;
  } catch { /* 저장소 제한 환경에서는 이번 제출의 참가자로 기록한다. */ }
  const participantId = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
      const random = crypto.getRandomValues(new Uint8Array(1))[0] & 15;
      return (char === 'x' ? random : (random & 3) | 8).toString(16);
    });
  try { localStorage.setItem(key, participantId); } catch { /* 브라우저 저장이 막혀도 결과와 순위는 표시한다. */ }
  return participantId;
}

export async function getNextQuizShareNotification() {
  const { data, error } = await requireSupabase().rpc('moonble_take_next_quiz_share_notification');
  if (error) throw error;
  return data && typeof data === 'object' ? data : null;
}

export async function revokeQuizShare(bankId) {
  const { error } = await requireSupabase().rpc('moonble_revoke_quiz_share', { p_bank_id: bankId });
  if (error) throw new Error('공유 링크를 중지하지 못했어요. 잠시 후 다시 시도해주세요.');
}
