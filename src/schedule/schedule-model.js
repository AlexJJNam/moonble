// 시간표 일정 모양과 계산(요일·시간·알림 시각·예약 문제지 주소). 화면과 알림이 함께 쓴다.
export const WEEKDAYS = [
  { value: 1, label: '월' }, { value: 2, label: '화' }, { value: 3, label: '수' }, { value: 4, label: '목' },
  { value: 5, label: '금' }, { value: 6, label: '토' }, { value: 0, label: '일' },
];
export const NOTIFY_OPTIONS = [
  { value: 0, label: '정시' }, { value: 5, label: '5분 전' }, { value: 10, label: '10분 전' },
  { value: 15, label: '15분 전' }, { value: 30, label: '30분 전' }, { value: 60, label: '1시간 전' },
];
export const SCHEDULE_COLORS = ['blue', 'green', 'orange', 'purple', 'pink', 'gray'];
export const TITLE_LIMIT = 40;
export const MEMO_LIMIT = 500;

export function weekdayLabel(day) {
  return WEEKDAYS.find(item => item.value === day)?.label || '';
}

export function toMinutes(time) {
  const [hour, minute] = String(time || '0:0').split(':').map(Number);
  return (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0);
}

export function formatMinutes(total) {
  const value = Math.max(0, Math.min(24 * 60 - 1, Math.round(total)));
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

export function localTimezone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Seoul'; } catch { return 'Asia/Seoul'; }
}

// 서버 행(또는 기기 저장 값) → 화면에서 쓰는 모양
export function normalizeSchedule(row) {
  if (!row || typeof row !== 'object') return null;
  const days = (Array.isArray(row.days) ? row.days : []).map(Number).filter(day => Number.isInteger(day) && day >= 0 && day <= 6);
  const start = String(row.start_time ?? row.start ?? '').slice(0, 5);
  const end = String(row.end_time ?? row.end ?? '').slice(0, 5);
  if (!row.id || !days.length || !/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return null;
  const kind = row.paper_kind ?? row.paper?.kind ?? null;
  const ref = row.paper_ref ?? row.paper?.ref ?? null;
  return {
    id: String(row.id),
    title: String(row.title || '').slice(0, TITLE_LIMIT),
    memo: String(row.memo || '').slice(0, MEMO_LIMIT),
    days: [...new Set(days)],
    start,
    end,
    color: SCHEDULE_COLORS.includes(row.color) ? row.color : 'blue',
    notify: row.notify !== false,
    notifyBefore: NOTIFY_OPTIONS.some(option => option.value === Number(row.notify_before ?? row.notifyBefore)) ? Number(row.notify_before ?? row.notifyBefore) : 10,
    paper: kind && ref ? { kind, ref: String(ref), title: String(row.paper_title ?? row.paper?.title ?? '') } : null,
    timezone: String(row.timezone || localTimezone()),
    updatedAt: row.updated_at || row.updatedAt || null,
  };
}

// 화면 모양 → 서버 열
export function toRow(schedule) {
  return {
    title: schedule.title.trim().slice(0, TITLE_LIMIT),
    memo: schedule.memo.slice(0, MEMO_LIMIT),
    days: schedule.days,
    start_time: schedule.start,
    end_time: schedule.end,
    color: schedule.color,
    notify: schedule.notify,
    notify_before: schedule.notifyBefore,
    paper_kind: schedule.paper?.kind || null,
    paper_ref: schedule.paper?.ref || null,
    paper_title: schedule.paper ? (schedule.paper.title || '').slice(0, 100) : null,
    timezone: schedule.timezone || localTimezone(),
  };
}

// 예약한 문제지를 여는 주소(알림을 누르면 이동)
export function paperUrl(paper) {
  if (!paper?.ref) return './prd.html#/schedule';
  const ref = encodeURIComponent(paper.ref);
  if (paper.kind === 'custom') return `./solve.html?paper=custom&bank=${ref}#quiz`;
  if (paper.kind === 'builtin') return `./solve.html?paper=${ref}#quiz`;
  if (paper.kind === 'share') return `./solve.html#share=${ref}`;
  return './prd.html#/schedule';
}

export function sortByStart(items) {
  return [...items].sort((a, b) => toMinutes(a.start) - toMinutes(b.start) || toMinutes(a.end) - toMinutes(b.end) || a.title.localeCompare(b.title));
}

// 알림 시각: 일정이 있는 날의 시작 시각에서 미리 알림 분을 뺀 때. 어제·오늘·내일 중 now 바로 전(2분 이내)에 지난 것.
export function dueReminders(items, now = new Date(), windowMs = 2 * 60 * 1000) {
  const result = [];
  items.forEach(schedule => {
    if (!schedule.notify) return;
    for (const offset of [-1, 0, 1]) {
      const day = new Date(now);
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() + offset);
      if (!schedule.days.includes(day.getDay())) continue;
      const startsAt = new Date(day.getTime() + toMinutes(schedule.start) * 60000);
      const remindAt = new Date(startsAt.getTime() - schedule.notifyBefore * 60000);
      const passed = now.getTime() - remindAt.getTime();
      if (passed >= 0 && passed < windowMs) result.push({ schedule, remindAt, startsAt });
    }
  });
  return result;
}

// 이번 주(월요일 시작) 날짜들
export function currentWeek(today = new Date()) {
  const monday = new Date(today);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return WEEKDAYS.map((weekday, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return { ...weekday, date, isToday: date.toDateString() === today.toDateString() };
  });
}
