// 문제지 공개 범위와 공개 문제 검색 RPC(016_public_quizzes.sql).
import { supabase } from './supabase.js';

export const PUBLIC_PAGE_SIZE = 20;
const missing = error => error?.code === 'PGRST202' || error?.code === '42883';

function requireSupabase() {
  if (!supabase) throw new Error('연결할 수 없어요. 잠시 후 다시 시도해주세요.');
  return supabase;
}

// tokens: 스크랩(하트)한 공개 문제만 불러올 때의 공유 토큰 목록(020). 020 적용 전에는 받은 목록에서 걸러낸다.
export async function listPublicQuizzes({ query = '', sort = 'popular', offset = 0, category = null, tokens = null } = {}) {
  if (Array.isArray(tokens) && !tokens.length) return { items: [], total: 0 };
  // 카테고리 필터(018)는 고른 경우에만 보낸다. 018 적용 전에도 전체 목록은 그대로 동작한다.
  const args = { p_query: query || null, p_sort: sort, p_offset: offset, p_limit: PUBLIC_PAGE_SIZE };
  if (category) args.p_category = category;
  if (Array.isArray(tokens)) args.p_tokens = tokens.slice(0, 300);
  let { data, error } = await requireSupabase().rpc('moonble_list_public_quizzes', args);
  if (error && Array.isArray(tokens) && missing(error)) {
    const fallback = { ...args, p_offset: 0, p_limit: 50 };
    delete fallback.p_tokens;
    ({ data, error } = await requireSupabase().rpc('moonble_list_public_quizzes', fallback));
    if (!error) {
      const wanted = new Set(tokens);
      const items = (Array.isArray(data?.items) ? data.items : []).filter(item => wanted.has(item.token));
      return { items: offset ? [] : items, total: items.length };
    }
  }
  if (error) {
    const result = new Error(missing(error) ? '공개 문제 검색을 준비하고 있어요.' : '잠시 후 다시 시도해주세요.');
    result.unavailable = missing(error);
    throw result;
  }
  return { items: Array.isArray(data?.items) ? data.items : [], total: Number.isInteger(data?.total) ? data.total : 0 };
}

// 이벤트의 종류와 대상은 서버가 공개 토큰에서 검증하고, 횟수·점수는 클라이언트가 전달하지 않습니다.
export async function trackPublicQuizActivity(token, kind) {
  if (!supabase || !/^[A-Za-z0-9_-]{40,50}$/.test(String(token || '')) || !['view', 'start'].includes(kind)) return false;
  try {
    const { data, error } = await supabase.rpc('moonble_track_public_quiz_activity', { p_token: token, p_kind: kind });
    return !error && data === true;
  } catch { return false; }
}

// 검색어 자동완성: 검색어가 들어간 공개 문제 제목을 인기순으로 몇 개 돌려준다.
export async function suggestPublicQuizTitles(term, limit = 8) {
  const { data, error } = await requireSupabase().rpc('moonble_list_public_quizzes', { p_query: term, p_sort: 'popular', p_offset: 0, p_limit: limit });
  if (error) return [];
  const items = Array.isArray(data?.items) ? data.items : [];
  return [...new Set(items.map(item => String(item.title || '').trim()).filter(Boolean))];
}

// { bankId: 'public' | 'unlisted' }. 016 적용 전이거나 실패하면 null(기존 방식으로 표시).
export async function getMyShareVisibilities() {
  try {
    const { data, error } = await requireSupabase().rpc('moonble_my_quiz_share_visibility');
    if (error || !data || typeof data !== 'object') return null;
    return data;
  } catch { return null; }
}

// visibility: 'public' | 'unlisted'. 016 적용 전에는 일부 공개(기존 동작)만 조용히 통과한다.
export async function setShareVisibility(bankId, visibility, token) {
  const { error } = await requireSupabase().rpc('moonble_set_quiz_share_visibility', { p_bank_id: bankId, p_visibility: visibility, p_token: visibility === 'public' ? token : null });
  if (!error) return;
  if (missing(error)) {
    if (visibility === 'unlisted') return;
    throw new Error('공개 기능을 준비하고 있어요. 잠시 후 다시 시도해주세요.');
  }
  throw new Error('공개 범위를 바꾸지 못했어요. 잠시 후 다시 시도해주세요.');
}

// 공개 문제의 작성자를 차단하면 이후 문제 찾기 목록에서 해당 작성자의 문제가 제외됩니다.
export async function blockPublicQuizAuthor(token) {
  const { data, error } = await requireSupabase().rpc('moonble_block_public_quiz_author', { p_token: token });
  if (!error && data === true) return true;
  if (missing(error)) throw new Error('사용자 차단 기능을 준비하고 있어요. 데이터베이스 설정을 먼저 적용해주세요.');
  throw new Error('사용자를 차단하지 못했어요. 잠시 후 다시 시도해주세요.');
}
