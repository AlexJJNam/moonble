// 커뮤니티 RPC. 테이블은 직접 읽지 않고 012_community.sql 의 함수만 호출한다.
import { supabase } from './supabase.js';
import { hashQuizShareToken, readQuizShareParticipantId } from './quiz-share.js';

export const COMMUNITY_TOPICS = [
  { value: 'question', label: '질문' },
  { value: 'review', label: '풀이 후기' },
  { value: 'tip', label: '공부 팁' },
  { value: 'error', label: '오류 제보' },
];
export const POST_TITLE_LIMIT = 60;
export const POST_BODY_LIMIT = 2000;
export const COMMENT_BODY_LIMIT = 500;
export const COMMUNITY_PAGE_SIZE = 20;
const SOLVED_SHARES_KEY = 'moonble:solved-shares-v1';
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{40,50}$/;

export class CommunityUnavailableError extends Error {}

function requireSupabase() {
  if (!supabase) throw new CommunityUnavailableError('커뮤니티에 연결할 수 없어요.');
  return supabase;
}

// 마이그레이션 전(함수 없음)에는 영역 전체를 숨기고, 그 밖의 오류는 사용자에게 알린다.
function failure(error, fallback) {
  if (error?.code === 'PGRST202' || error?.code === '42883') return new CommunityUnavailableError('커뮤니티가 아직 준비되지 않았어요.');
  const message = error?.code === '54000' ? '잠시 후 다시 남겨주세요. 짧은 시간에 너무 많이 작성했어요.'
    : error?.code === '42501' ? '로그인한 뒤 이용할 수 있어요.'
      : error?.code === 'P0002' ? '글이나 문제지를 찾지 못했어요. 삭제됐거나 공유가 중지됐을 수 있어요.'
        : fallback;
  const result = new Error(message);
  result.code = error?.code || '';
  return result;
}

const hashCache = new Map();
export function communityTokenHash(token) {
  if (!hashCache.has(token)) hashCache.set(token, hashQuizShareToken(token));
  return hashCache.get(token);
}

// 이 기기에서 해당 공유 문제를 제출한 기록(참가자 ID)이 있어야 점수·순위를 붙일 수 있다.
export async function canAttachRecord(token) {
  if (!TOKEN_PATTERN.test(token || '')) return false;
  return Boolean(readQuizShareParticipantId(await communityTokenHash(token)));
}

export function solveHref(token) {
  return `./solve.html#share=${encodeURIComponent(token)}`;
}

export function externalShareUrl(token) {
  return `https://share.moonble.com/${encodeURIComponent(token)}?preview=3`;
}

// 첨부할 수 있게 이 기기에서 푼 공유 문제를 기억한다(최대 30개).
export function rememberSolvedShare({ token, title, questionCount }) {
  if (!TOKEN_PATTERN.test(token || '')) return;
  try {
    const items = getSolvedShares().filter(item => item.token !== token);
    items.unshift({ token, title: String(title || '공유 문제').slice(0, 100), questionCount: Number(questionCount) || 0, solvedAt: new Date().toISOString() });
    localStorage.setItem(SOLVED_SHARES_KEY, JSON.stringify(items.slice(0, 30)));
  } catch { /* 저장이 막히면 첨부 목록에만 나오지 않는다. */ }
}

export function getSolvedShares() {
  try {
    const items = JSON.parse(localStorage.getItem(SOLVED_SHARES_KEY) || '[]');
    return Array.isArray(items) ? items.filter(item => TOKEN_PATTERN.test(item?.token || '')) : [];
  } catch { return []; }
}

export async function listPosts({ scope = 'all', token = null, sort = 'popular', offset = 0 } = {}) {
  const { data, error } = await requireSupabase().rpc('moonble_list_community_posts', {
    p_scope: scope,
    p_token_hash: scope === 'share' ? await communityTokenHash(token) : null,
    p_sort: sort,
    p_offset: offset,
    p_limit: COMMUNITY_PAGE_SIZE,
  });
  if (error) throw failure(error, '글을 불러오지 못했어요.');
  return {
    posts: Array.isArray(data?.posts) ? data.posts : [],
    total: Number.isInteger(data?.total) ? data.total : 0,
    viewer: data?.viewer || {},
  };
}

export async function createPost({ topic, title, body, shareToken = null, showRecord = false, gif = null }) {
  const participantId = shareToken && showRecord ? readQuizShareParticipantId(await communityTokenHash(shareToken)) : null;
  const { data, error } = await requireSupabase().rpc('moonble_create_community_post', {
    p_topic: topic || null,
    p_title: title?.trim() || null,
    p_body: body.trim(),
    p_share_token: shareToken || null,
    p_participant_id: participantId,
    p_show_record: Boolean(participantId),
    // GIF가 있을 때만 보낸다. 013 적용 전 DB에서도 GIF 없는 글쓰기는 그대로 동작한다.
    ...(gif ? { p_gif: gif } : {}),
  });
  if (error) throw failure(error, '글을 남기지 못했어요. 잠시 후 다시 시도해주세요.');
  return data;
}

export async function deletePost(postId) {
  const { error } = await requireSupabase().rpc('moonble_delete_community_post', { p_post_id: postId });
  if (error) throw failure(error, '글을 삭제하지 못했어요.');
}

export async function toggleLike(postId) {
  const { data, error } = await requireSupabase().rpc('moonble_toggle_community_post_like', { p_post_id: postId });
  if (error) throw failure(error, '좋아요를 반영하지 못했어요.');
  return { liked: Boolean(data?.liked), likeCount: Number.isInteger(data?.like_count) ? data.like_count : 0 };
}

// 014 적용 전 DB(정렬·좋아요 없음)에서는 p_sort 없이 다시 불러오고 likes=false로 돌려준다.
export async function listComments(postId, sort = 'popular') {
  const client = requireSupabase();
  let { data, error } = await client.rpc('moonble_list_community_post_comments', { p_post_id: postId, p_sort: sort });
  let likes = true;
  if (error && (error.code === 'PGRST202' || error.code === '42883')) {
    likes = false;
    ({ data, error } = await client.rpc('moonble_list_community_post_comments', { p_post_id: postId }));
  }
  if (error) throw failure(error, '댓글을 불러오지 못했어요.');
  return { comments: Array.isArray(data) ? data : [], likes };
}

export async function toggleCommentLike(commentId) {
  const { data, error } = await requireSupabase().rpc('moonble_toggle_community_comment_like', { p_comment_id: commentId });
  if (error) throw failure(error, '좋아요를 반영하지 못했어요.');
  return { liked: Boolean(data?.liked), likeCount: Number.isInteger(data?.like_count) ? data.like_count : 0 };
}

export async function updatePost(postId, { topic, title, body, gif = null }) {
  const { data, error } = await requireSupabase().rpc('moonble_update_community_post', {
    p_post_id: postId, p_topic: topic || null, p_title: title?.trim() || null, p_body: body.trim(), ...(gif ? { p_gif: gif } : {}),
  });
  if (error) {
    if (error.code === 'PGRST202' || error.code === '42883') throw new Error('글 편집 기능을 준비하고 있어요. 잠시 후 다시 시도해주세요.');
    throw failure(error, '글을 수정하지 못했어요. 잠시 후 다시 시도해주세요.');
  }
  return data;
}

export async function createComment(postId, body, gif = null) {
  const { data, error } = await requireSupabase().rpc('moonble_create_community_post_comment', {
    p_post_id: postId, p_body: body.trim(), ...(gif ? { p_gif: gif } : {}),
  });
  if (error) throw failure(error, '댓글을 남기지 못했어요.');
  return data;
}

export async function deleteComment(commentId) {
  const { error } = await requireSupabase().rpc('moonble_delete_community_post_comment', { p_comment_id: commentId });
  if (error) throw failure(error, '댓글을 삭제하지 못했어요.');
}

export async function reportPost(postId, reason) {
  const { error } = await requireSupabase().rpc('moonble_report_community_post', { p_post_id: postId, p_reason: reason });
  if (error) throw failure(error, '신고를 접수하지 못했어요.');
}

// 마이페이지 커뮤니티 활동. 015 적용 전 DB에서는 null을 돌려줘 화면에서 섹션을 숨긴다.
export async function getMyCommunitySummary() {
  const { data, error } = await requireSupabase().rpc('moonble_my_community_summary');
  if (error) {
    if (error.code === 'PGRST202' || error.code === '42883') return null;
    throw failure(error, '커뮤니티 활동을 불러오지 못했어요.');
  }
  return { posts: Number(data?.posts) || 0, comments: Number(data?.comments) || 0, likes: Number(data?.likes) || 0 };
}

export async function listMyComments(offset = 0) {
  const { data, error } = await requireSupabase().rpc('moonble_list_my_community_comments', { p_offset: offset, p_limit: COMMUNITY_PAGE_SIZE });
  if (error) throw failure(error, '내가 쓴 댓글을 불러오지 못했어요.');
  return { comments: Array.isArray(data?.comments) ? data.comments : [], total: Number.isInteger(data?.total) ? data.total : 0 };
}
