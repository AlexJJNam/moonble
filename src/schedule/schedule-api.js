// 시간표 저장소: 서버(study_schedules, 024)를 먼저 쓰고, 표가 아직 없으면 이 기기에 저장한다.
// 서버가 준비되면 기기에 있던 일정을 서버로 옮긴다.
import { supabase } from '../supabase.js';
import { normalizeSchedule, toRow } from './schedule-model.js';

const COLUMNS = 'id,title,memo,days,start_time,end_time,color,notify,notify_before,paper_kind,paper_ref,paper_title,timezone,updated_at';
const MISSING_SKIP_MS = 10 * 60 * 1000;
const CACHE_MS = 2 * 60 * 1000;

const localKey = userId => `moonble:user:${userId}:study-schedules-v1`;
const cacheKey = userId => `moonble:user:${userId}:study-schedules-cache`;
const MISSING_KEY = 'moonble:study-schedules-server-missing';

function readLocal(userId) {
  try {
    const value = JSON.parse(localStorage.getItem(localKey(userId)) || '[]');
    return Array.isArray(value) ? value.map(normalizeSchedule).filter(Boolean) : [];
  } catch { return []; }
}
function writeLocal(userId, items) {
  try { localStorage.setItem(localKey(userId), JSON.stringify(items)); } catch { /* 저장 공간이 없으면 화면에만 남는다. */ }
}
function isMissingTable(error) {
  return ['PGRST205', '42P01', 'PGRST204'].includes(error?.code) || /study_schedules/.test(error?.message || '') && /(does not exist|could not find)/i.test(error?.message || '');
}
function serverRecentlyMissing() {
  try { return Date.now() - Number(sessionStorage.getItem(MISSING_KEY) || 0) < MISSING_SKIP_MS; } catch { return false; }
}
function markServerMissing() {
  try { sessionStorage.setItem(MISSING_KEY, String(Date.now())); } catch { /* 표시만 못 한다. */ }
}
function writeCache(userId, value) {
  try { sessionStorage.setItem(cacheKey(userId), JSON.stringify({ at: Date.now(), ...value })); } catch { /* 캐시는 없어도 된다. */ }
}
export function readCachedSchedules(userId) {
  try {
    const value = JSON.parse(sessionStorage.getItem(cacheKey(userId)) || 'null');
    if (value && Date.now() - value.at < CACHE_MS && Array.isArray(value.items)) return { items: value.items.map(normalizeSchedule).filter(Boolean), server: Boolean(value.server) };
  } catch { /* 다시 불러온다. */ }
  return null;
}
function announce(userId) {
  window.dispatchEvent(new CustomEvent('moonble:schedules-changed', { detail: { userId } }));
}
function makeLocalId() {
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// { items, server }: server=false면 이 기기 저장(024 적용 전)
export async function listSchedules(userId, { fresh = false } = {}) {
  if (!userId) return { items: [], server: false };
  if (!fresh) { const cached = readCachedSchedules(userId); if (cached) return cached; }
  if (!supabase || serverRecentlyMissing()) {
    const result = { items: readLocal(userId), server: false };
    writeCache(userId, result);
    return result;
  }
  const { data, error } = await supabase.from('study_schedules').select(COLUMNS).order('start_time', { ascending: true });
  if (error) {
    if (isMissingTable(error)) {
      markServerMissing();
      const result = { items: readLocal(userId), server: false };
      writeCache(userId, result);
      return result;
    }
    throw new Error('시간표를 불러오지 못했어요. 잠시 후 다시 시도해주세요.');
  }
  let items = (data || []).map(normalizeSchedule).filter(Boolean);
  // 024 적용 전에 이 기기에 저장한 일정을 서버로 옮긴다.
  const local = readLocal(userId);
  if (local.length) {
    const { data: moved, error: moveError } = await supabase.from('study_schedules').insert(local.map(toRow)).select(COLUMNS);
    if (!moveError) {
      writeLocal(userId, []);
      items = [...items, ...(moved || []).map(normalizeSchedule).filter(Boolean)];
    }
  }
  const result = { items, server: true };
  writeCache(userId, result);
  return result;
}

export async function saveSchedule(userId, schedule) {
  const current = await listSchedules(userId);
  let saved;
  if (current.server) {
    const row = toRow(schedule);
    const isNew = !schedule.id || String(schedule.id).startsWith('local-');
    const request = isNew
      ? supabase.from('study_schedules').insert(row).select(COLUMNS).single()
      : supabase.from('study_schedules').update(row).eq('id', schedule.id).select(COLUMNS).single();
    const { data, error } = await request;
    if (error) throw new Error(error.code === '54000' ? '일정은 100개까지 만들 수 있어요.' : '일정을 저장하지 못했어요. 잠시 후 다시 시도해주세요.');
    saved = normalizeSchedule(data);
  } else {
    saved = normalizeSchedule({ ...toRow(schedule), id: schedule.id || makeLocalId(), updated_at: new Date().toISOString() });
    const items = readLocal(userId).filter(item => item.id !== saved.id);
    if (!schedule.id && items.length >= 100) throw new Error('일정은 100개까지 만들 수 있어요.');
    writeLocal(userId, [...items, saved]);
  }
  const items = [...current.items.filter(item => item.id !== saved.id), saved];
  writeCache(userId, { items, server: current.server });
  announce(userId);
  return saved;
}

export async function deleteSchedule(userId, scheduleId) {
  const current = await listSchedules(userId);
  if (current.server && !String(scheduleId).startsWith('local-')) {
    const { error } = await supabase.from('study_schedules').delete().eq('id', scheduleId);
    if (error) throw new Error('일정을 삭제하지 못했어요. 잠시 후 다시 시도해주세요.');
  } else {
    writeLocal(userId, readLocal(userId).filter(item => item.id !== scheduleId));
  }
  writeCache(userId, { items: current.items.filter(item => item.id !== scheduleId), server: current.server });
  announce(userId);
}
