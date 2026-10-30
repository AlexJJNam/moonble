import { supabase } from './supabase.js';
import { hashQuizShareToken } from './quiz-share.js';

// 공유 토큰 또는 내 문제지 ID만 사용한다. 이름이 같은 다른 문제지는 조회하지 않는다.
export async function getQuizPreviewComment(solveHref) {
  if (!supabase || !solveHref) return null;
  let url;
  try { url = new URL(solveHref, window.location.href); } catch { return null; }
  if (url.origin !== window.location.origin || !url.pathname.endsWith('/solve.html')) return null;

  const token = new URLSearchParams(url.hash.slice(1)).get('share');
  const bankId = url.searchParams.get('paper') === 'custom' ? url.searchParams.get('bank') : null;
  let args;
  if (token && /^[A-Za-z0-9_-]{40,50}$/.test(token)) {
    args = { p_token_hash: await hashQuizShareToken(token), p_bank_id: null };
  } else if (bankId && bankId.length <= 160) {
    args = { p_token_hash: null, p_bank_id: bankId };
  } else {
    return null;
  }
  const { data, error } = await supabase.rpc('moonble_quiz_preview_comment', args);
  if (error || !data || typeof data !== 'object' || (!data.body && !data.gif)) return null;
  return data;
}
