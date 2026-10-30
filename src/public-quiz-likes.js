// 공개 문제지 좋아요는 문제지와 계정 기준으로 서버에 저장합니다.
import { supabase } from './supabase.js';

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{40,50}$/;
const TOKEN_LIMIT = 300;

function requireSupabase() {
  if (!supabase) throw new Error('좋아요를 연결할 수 없어요. 잠시 후 다시 시도해주세요.');
  return supabase;
}

function failure(error, fallback) {
  const unavailable = error?.code === 'PGRST202' || error?.code === '42883';
  const result = new Error(unavailable ? '좋아요 기능을 준비하고 있어요.'
    : error?.code === '42501' ? '로그인한 뒤 이용할 수 있어요.'
      : error?.code === 'P0002' ? '공개가 중지된 문제지예요.' : fallback);
  result.code = error?.code || '';
  result.unavailable = unavailable;
  return result;
}

function cleanTokens(tokens) {
  if (!Array.isArray(tokens) || tokens.some(token => typeof token !== 'string' || !TOKEN_PATTERN.test(token))) {
    throw new Error('공개 문제지 정보를 확인할 수 없어요.');
  }
  const unique = [...new Set(tokens)];
  if (unique.length > TOKEN_LIMIT) throw new Error('한 번에 조회할 수 있는 문제지가 너무 많아요.');
  return unique;
}

// { [공개 토큰]: { liked, likeCount } }. 공개되지 않은 토큰은 결과에서 제외됩니다.
export async function getPublicQuizLikeStates(tokens) {
  const unique = cleanTokens(tokens);
  if (!unique.length) return {};
  const { data, error } = await requireSupabase().rpc('moonble_get_public_quiz_likes', { p_tokens: unique });
  if (error) throw failure(error, '좋아요 수를 불러오지 못했어요.');
  if (!Array.isArray(data)) throw new Error('좋아요 수를 불러오지 못했어요.');
  const result = {};
  for (const item of data) {
    if (!TOKEN_PATTERN.test(item?.token || '') || !unique.includes(item.token)
      || typeof item.liked !== 'boolean' || !Number.isInteger(item.like_count) || item.like_count < 0) continue;
    result[item.token] = { liked: item.liked, likeCount: item.like_count };
  }
  return result;
}

// 목표 상태를 명시하므로 같은 요청을 재시도해도 좋아요가 뒤집히지 않습니다.
export async function setPublicQuizLike(token, liked) {
  if (!TOKEN_PATTERN.test(token || '') || typeof liked !== 'boolean') throw new Error('공개 문제지 정보를 확인할 수 없어요.');
  const { data, error } = await requireSupabase().rpc('moonble_set_public_quiz_like', { p_token: token, p_liked: liked });
  if (error) throw failure(error, '좋아요를 반영하지 못했어요. 잠시 후 다시 시도해주세요.');
  if (typeof data?.liked !== 'boolean' || !Number.isInteger(data?.like_count) || data.like_count < 0) {
    throw new Error('좋아요 결과를 확인하지 못했어요.');
  }
  return { liked: data.liked, likeCount: data.like_count };
}

// 로컬 스크랩을 가져올 때만 호출합니다. 같은 토큰을 다시 보내도 중복되지 않습니다.
export async function importPublicQuizLikes(tokens) {
  const unique = cleanTokens(tokens);
  if (!unique.length) return 0;
  const { data, error } = await requireSupabase().rpc('moonble_import_public_quiz_likes', { p_tokens: unique });
  if (error) throw failure(error, '기존 스크랩을 가져오지 못했어요.');
  return Number.isInteger(data?.imported) && data.imported >= 0 ? data.imported : 0;
}

// 서버에 저장된 좋아요 중 현재 공개된 문제의 최신 공유 토큰(최대 300개).
export async function getMyPublicQuizLikedTokens() {
  const { data, error } = await requireSupabase().rpc('moonble_my_public_quiz_likes');
  if (error) throw failure(error, '스크랩한 문제지를 불러오지 못했어요.');
  if (!Array.isArray(data)) throw new Error('스크랩한 문제지를 불러오지 못했어요.');
  return [...new Set(data.filter(token => typeof token === 'string' && TOKEN_PATTERN.test(token)))];
}
