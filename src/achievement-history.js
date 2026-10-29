import { supabase } from './supabase.js';

const STORAGE_PREFIX = 'moonble:user:';
const STORAGE_VERSION = 'history-v3';
const TABLE = 'quiz_attempt_history';
const LIMIT = 200;

function storageKey(userId) {
  return userId ? `${STORAGE_PREFIX}${userId}:${STORAGE_VERSION}` : null;
}

function makeId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, character => {
    const random = Math.random() * 16 | 0;
    return (character === 'x' ? random : (random & 0x3 | 0x8)).toString(16);
  });
}

function normalizeRecord(item) {
  return {
    ...item,
    id: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item?.id || '') ? item.id : makeId(),
    date: item?.date || new Date().toISOString(),
    questionIds: Array.isArray(item?.questionIds) ? item.questionIds : [],
    wrongIds: Array.isArray(item?.wrongIds) ? item.wrongIds : [],
  };
}

export function readAchievementHistory(userId) {
  try {
    const key = storageKey(userId);
    const value = key ? JSON.parse(localStorage.getItem(key) || '[]') : [];
    return Array.isArray(value) ? value.slice(0, LIMIT).map(normalizeRecord) : [];
  } catch {
    return [];
  }
}

export function writeAchievementHistoryCache(userId, history) {
  try {
    const key = storageKey(userId);
    if (!key) return [];
    const normalized = (Array.isArray(history) ? history : []).slice(0, LIMIT).map(normalizeRecord);
    localStorage.setItem(key, JSON.stringify(normalized));
    return normalized;
  } catch {
    return Array.isArray(history) ? history.slice(0, LIMIT) : [];
  }
}

function toRow(userId, item) {
  const record = normalizeRecord(item);
  return {
    id: record.id,
    user_id: userId,
    attempted_at: record.date,
    paper_id: String(record.paperId || 'random'),
    bank_id: record.bankId ? String(record.bankId) : null,
    group_id: record.groupId ? String(record.groupId) : null,
    paper_title: String(record.paperTitle || '문제지').slice(0, 160),
    paper_description: String(record.paperDescription || '').slice(0, 2000),
    score: Math.max(0, Math.min(100, Math.round(Number(record.score) || 0))),
    correct_count: Math.max(0, Math.round(Number(record.correct) || 0)),
    total_count: Math.max(1, Math.round(Number(record.total) || 1)),
    question_ids: record.questionIds,
    wrong_ids: record.wrongIds,
  };
}

function fromRow(row) {
  return {
    id: row.id,
    date: row.attempted_at,
    paperId: row.paper_id,
    bankId: row.bank_id,
    groupId: row.group_id,
    paperTitle: row.paper_title,
    paperDescription: row.paper_description,
    score: row.score,
    correct: row.correct_count,
    total: row.total_count,
    questionIds: Array.isArray(row.question_ids) ? row.question_ids : [],
    wrongIds: Array.isArray(row.wrong_ids) ? row.wrong_ids : [],
  };
}

function newestFirst(records) {
  return records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, LIMIT);
}

async function uploadRecords(userId, records) {
  if (!supabase || !userId || !records.length) return;
  const { error } = await supabase.from(TABLE).upsert(records.map(item => toRow(userId, item)), {
    onConflict: 'id',
    ignoreDuplicates: true,
  });
  if (error) throw error;
}

// 기존 기기 기록을 한 번에 올린 뒤 서버 기록을 캐시에 맞춘다.
// DB 마이그레이션 전이거나 오프라인이면 캐시 기록으로 계속 동작한다.
export async function syncAchievementHistory(userId) {
  const localRecords = writeAchievementHistoryCache(userId, readAchievementHistory(userId));
  if (!supabase || !userId) return localRecords;
  try {
    await uploadRecords(userId, localRecords);
    const { data, error } = await supabase.from(TABLE)
      .select('id,attempted_at,paper_id,bank_id,group_id,paper_title,paper_description,score,correct_count,total_count,question_ids,wrong_ids')
      .eq('user_id', userId)
      .order('attempted_at', { ascending: false })
      .limit(LIMIT);
    if (error) throw error;
    const merged = new Map();
    (data || []).map(fromRow).forEach(item => merged.set(item.id, item));
    // 새 기록이 동기화 도중 추가되어도 화면과 캐시에 남도록 다시 합친다.
    readAchievementHistory(userId).forEach(item => { if (!merged.has(item.id)) merged.set(item.id, item); });
    const result = newestFirst([...merged.values()]);
    writeAchievementHistoryCache(userId, result);
    window.dispatchEvent(new CustomEvent('moonble:achievement-history-updated', { detail: { userId } }));
    return result;
  } catch {
    return localRecords;
  }
}

export async function saveAchievementAttempt(userId, item) {
  if (!userId || !supabase) return;
  await uploadRecords(userId, [item]);
}

export async function replaceAchievementHistory(userId, history) {
  const normalized = writeAchievementHistoryCache(userId, history);
  if (!supabase || !userId) return normalized;
  if (!normalized.length) {
    const { error } = await supabase.from(TABLE).delete().eq('user_id', userId);
    if (error) throw error;
    return normalized;
  }
  await uploadRecords(userId, normalized);
  return normalized;
}

if (typeof window !== 'undefined') {
  window.moonbleAchievementHistory = { save: saveAchievementAttempt };
}
