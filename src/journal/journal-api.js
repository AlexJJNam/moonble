// 일지·회고 저장소(Supabase journal_entries · journal_attachments, 027). 본인 기록만 RLS로 읽고 쓴다.
// 저장하지 못한 내용은 이 기기에 남겨 두었다가(새로고침·네트워크 실패 대비) 다음에 다시 저장한다.
import { supabase } from '../supabase.js';
import { normalizeEntry, toRow } from './journal-model.js';

const TABLE = 'journal_entries';
const COLUMNS = 'id,kind,period_start,period_end,title,body,answers,mood,tags,created_at,updated_at';
const ATTEMPT_COLUMNS = 'id,attempted_at,paper_id,bank_id,group_id,paper_title,paper_description,score,correct_count,total_count,question_ids,wrong_ids,wrong_answers';

function journalError(error, fallback) {
  const code = error?.code || '';
  const message = String(error?.message || '');
  if (['PGRST205', '42P01', 'PGRST204', '42703'].includes(code)) return Object.assign(new Error('일지 저장소가 아직 준비되지 않았어요. 이 기기에 먼저 저장해 둘게요.'), { code: 'missing' });
  if (code === 'PGRST301' || code === 'PGRST303' || /jwt|token/i.test(message)) return Object.assign(new Error('로그인이 만료됐어요. 다시 로그인하면 이어서 저장돼요.'), { code: 'auth' });
  if (code === '42501') return Object.assign(new Error('이 기록을 저장할 권한이 없어요.'), { code: 'denied' });
  if (!navigator.onLine) return Object.assign(new Error('인터넷 연결이 끊겼어요. 연결되면 다시 저장할게요.'), { code: 'offline' });
  return Object.assign(new Error(fallback), { code: 'network' });
}
function client() {
  if (!supabase) throw Object.assign(new Error('일지 저장소에 연결할 수 없어요.'), { code: 'missing' });
  return supabase;
}
const escapeLike = value => value.replace(/[\\%_]/g, character => `\\${character}`);

export async function getEntry(kind, start) {
  const { data, error } = await client().from(TABLE).select(COLUMNS).eq('workspace', 'personal').eq('kind', kind).eq('period_start', start).maybeSingle();
  if (error) throw journalError(error, '일지를 불러오지 못했어요.');
  return data ? normalizeEntry(data) : null;
}

// 기간 안의 기록(최신 날짜순). kinds를 주면 그 종류만.
export async function listEntries({ from, to, kinds = null, limit = 500 } = {}) {
  let request = client().from(TABLE).select(COLUMNS).eq('workspace', 'personal').order('period_start', { ascending: false }).limit(limit);
  if (kinds?.length) request = request.in('kind', kinds);
  if (from) request = request.gte('period_start', from);
  if (to) request = request.lte('period_start', to);
  const { data, error } = await request;
  if (error) throw journalError(error, '기록을 불러오지 못했어요.');
  return (data || []).map(normalizeEntry).filter(Boolean);
}

// 제목·본문·질문 답변·태그 검색(서버의 search_text) + 태그·종류·기간 필터
export async function searchEntries({ query = '', tag = '', kind = '', from = '', to = '', limit = 60 } = {}) {
  let request = client().from(TABLE).select(COLUMNS).eq('workspace', 'personal').order('period_start', { ascending: false }).limit(limit + 1);
  const term = query.trim().toLowerCase();
  if (term) request = request.ilike('search_text', `%${escapeLike(term)}%`);
  if (tag) request = request.contains('tags', [tag]);
  if (kind) request = request.eq('kind', kind);
  if (from) request = request.gte('period_start', from);
  if (to) request = request.lte('period_start', to);
  const { data, error } = await request;
  if (error) throw journalError(error, '검색하지 못했어요.');
  const items = (data || []).map(normalizeEntry).filter(Boolean);
  return { items: items.slice(0, limit), more: items.length > limit };
}

// 내가 쓴 태그(많이 쓴 순)
export async function listTags() {
  const { data, error } = await client().from(TABLE).select('tags').eq('workspace', 'personal').eq('kind', 'daily').order('period_start', { ascending: false }).limit(400);
  if (error) throw journalError(error, '태그를 불러오지 못했어요.');
  const counts = new Map();
  (data || []).forEach(row => (row.tags || []).forEach(tag => counts.set(tag, (counts.get(tag) || 0) + 1)));
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([tag]) => tag);
}

// 같은 날짜(주·달)는 하나만: (사람, 워크스페이스, 종류, 시작일) 유니크에 upsert한다.
export async function saveEntry(userId, entry) {
  const { data, error } = await client().from(TABLE)
    .upsert({ ...toRow(entry), user_id: userId }, { onConflict: 'user_id,workspace,kind,period_start' })
    .select(COLUMNS).single();
  if (error) throw journalError(error, '저장하지 못했어요. 다시 시도해 주세요.');
  return normalizeEntry(data);
}

export async function deleteEntry(id) {
  const { error } = await client().from(TABLE).delete().eq('id', id);
  if (error) throw journalError(error, '삭제하지 못했어요. 다시 시도해 주세요.');
}

// ── 풀이 기록 첨부: 일지에는 풀이 기록 id만 연결하고, 내용은 원본(quiz_attempt_history)에서 읽는다.
export function attemptFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    date: row.attempted_at,
    paperId: row.paper_id,
    bankId: row.bank_id,
    groupId: row.group_id,
    paperTitle: row.paper_title || '문제지',
    paperDescription: row.paper_description || '',
    score: row.score,
    correct: row.correct_count,
    total: row.total_count,
    questionIds: Array.isArray(row.question_ids) ? row.question_ids : [],
    wrongIds: Array.isArray(row.wrong_ids) ? row.wrong_ids : [],
    wrongAnswers: row.wrong_answers && typeof row.wrong_answers === 'object' ? row.wrong_answers : null,
  };
}

export async function listAttachments(entryId) {
  const { data, error } = await client().from('journal_attachments')
    .select(`id,attempt_id,created_at,attempt:quiz_attempt_history(${ATTEMPT_COLUMNS})`)
    .eq('entry_id', entryId).order('created_at', { ascending: true });
  if (error) throw journalError(error, '첨부한 풀이 기록을 불러오지 못했어요.');
  return (data || []).map(row => ({ id: row.id, attemptId: row.attempt_id, attempt: attemptFromRow(row.attempt) }));
}

export async function attachAttempts(userId, entryId, attemptIds) {
  if (!attemptIds.length) return;
  const { error } = await client().from('journal_attachments')
    .upsert(attemptIds.map(attemptId => ({ entry_id: entryId, attempt_id: attemptId, user_id: userId })), { onConflict: 'entry_id,attempt_id', ignoreDuplicates: true });
  if (error) {
    if (error.code === '23503') throw Object.assign(new Error('아직 서버에 올라가지 않은 풀이 기록이 있어요. 잠시 후 다시 시도해 주세요.'), { code: 'missing-attempt' });
    throw journalError(error, '풀이 기록을 첨부하지 못했어요.');
  }
}

export async function detachAttachment(id) {
  const { error } = await client().from('journal_attachments').delete().eq('id', id);
  if (error) throw journalError(error, '첨부를 해제하지 못했어요.');
}

// 첨부한 풀이 기록의 재풀이(retry_of로 연결된 별도 회차)
export async function listRetries(attemptIds) {
  if (!attemptIds.length) return [];
  const { data, error } = await client().from('quiz_attempt_history')
    .select('id,retry_of,attempted_at,score,correct_count,total_count')
    .in('retry_of', attemptIds).order('attempted_at', { ascending: false }).limit(200);
  if (error) return [];
  return data || [];
}

// ── 이 기기 임시 저장: 저장이 끝나지 않은 내용만 남긴다(저장되면 지운다).
const draftKey = (userId, kind, start) => `moonble:user:${userId}:journal-draft:${kind}:${start}`;
export function readLocalDraft(userId, kind, start) {
  try {
    const value = JSON.parse(localStorage.getItem(draftKey(userId, kind, start)) || 'null');
    const entry = value && normalizeEntry({ ...value.entry, kind, period_start: start });
    return entry ? { entry, base: value.base || null, at: Number(value.at) || 0 } : null;
  } catch { return null; }
}
export function writeLocalDraft(userId, entry, base) {
  try { localStorage.setItem(draftKey(userId, entry.kind, entry.periodStart), JSON.stringify({ entry: { ...toRow(entry), id: entry.id }, base, at: Date.now() })); } catch { /* 저장 공간이 막히면 화면에만 남는다. */ }
}
export function clearLocalDraft(userId, kind, start) {
  try { localStorage.removeItem(draftKey(userId, kind, start)); } catch { /* 지우지 못해도 다음 저장 때 덮인다. */ }
}
