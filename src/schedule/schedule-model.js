// 시간표 일정 모양과 계산(날짜·요일·시간·알림 시각·예약 문제지 주소). 화면과 알림이 함께 쓴다.
// 일정은 그날 한 번(repeatWeekly=false, date=그날)이거나, date(시작 날짜)부터 고른 요일마다 매주 반복한다.
// 시작 날짜가 없는 매주 일정(날짜 기능 전 일정)은 언제나 보인다.
export const WEEKDAYS = [
  { value: 1, label: '월' }, { value: 2, label: '화' }, { value: 3, label: '수' }, { value: 4, label: '목' },
  { value: 5, label: '금' }, { value: 6, label: '토' }, { value: 0, label: '일' },
];
export const NOTIFY_OPTIONS = [
  { value: 0, label: '정시' }, { value: 5, label: '5분 전' }, { value: 10, label: '10분 전' },
  { value: 15, label: '15분 전' }, { value: 30, label: '30분 전' }, { value: 60, label: '1시간 전' },
];
export const SCHEDULE_COLORS = ['blue', 'green', 'orange', 'purple', 'pink', 'gray'];
export const SCHEDULE_COLOR_LABELS = { blue: '파랑', green: '초록', orange: '주황', purple: '보라', pink: '분홍', gray: '회색' };
export const SCHEDULE_LIMIT = 500;
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

// 날짜 키 'YYYY-MM-DD'(기기 시간대 기준) ↔ 그날 0시
export function toDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function fromDateKey(key) {
  const [year, month, day] = String(key || '').split('-').map(Number);
  return new Date(year, month - 1, day);
}
export function isDateKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const date = fromDateKey(value);
  return !Number.isNaN(date.getTime()) && toDateKey(date) === value;
}
export function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

// 그 날짜에 일정이 있는지
export function occursOn(schedule, date) {
  const key = toDateKey(date);
  if (!schedule.repeatWeekly) return schedule.date === key;
  if (schedule.date && key < schedule.date) return false;
  return schedule.days.includes(date.getDay());
}

export function localTimezone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Seoul'; } catch { return 'Asia/Seoul'; }
}

// 서버 행(또는 기기 저장 값) → 화면에서 쓰는 모양
export function normalizeSchedule(row) {
  if (!row || typeof row !== 'object') return null;
  const repeatWeekly = (row.repeat_weekly ?? row.repeatWeekly) !== false;
  const rawDate = String(row.start_date ?? row.date ?? '').slice(0, 10);
  const date = isDateKey(rawDate) ? rawDate : null;
  if (!repeatWeekly && !date) return null;
  const days = repeatWeekly
    ? (Array.isArray(row.days) ? row.days : []).map(Number).filter(day => Number.isInteger(day) && day >= 0 && day <= 6)
    : [fromDateKey(date).getDay()];
  const start = String(row.start_time ?? row.start ?? '').slice(0, 5);
  const end = String(row.end_time ?? row.end ?? '').slice(0, 5);
  if (!row.id || !days.length || !/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return null;
  const kind = row.paper_kind ?? row.paper?.kind ?? null;
  const ref = row.paper_ref ?? row.paper?.ref ?? null;
  return {
    id: String(row.id),
    title: String(row.title || '').slice(0, TITLE_LIMIT),
    memo: String(row.memo || '').slice(0, MEMO_LIMIT),
    repeatWeekly,
    date,
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
  const repeatWeekly = schedule.repeatWeekly !== false;
  return {
    title: schedule.title.trim().slice(0, TITLE_LIMIT),
    memo: schedule.memo.slice(0, MEMO_LIMIT),
    repeat_weekly: repeatWeekly,
    start_date: schedule.date || null,
    days: repeatWeekly ? schedule.days : [fromDateKey(schedule.date).getDay()],
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
      if (!occursOn(schedule, day)) continue;
      const startsAt = new Date(day.getTime() + toMinutes(schedule.start) * 60000);
      const remindAt = new Date(startsAt.getTime() - schedule.notifyBefore * 60000);
      const passed = now.getTime() - remindAt.getTime();
      if (passed >= 0 && passed < windowMs) result.push({ schedule, remindAt, startsAt });
    }
  });
  return result;
}

// anchor가 있는 주(월요일 시작)의 날짜들
export function weekDates(anchor = new Date(), today = new Date()) {
  const monday = new Date(anchor);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const todayKey = toDateKey(today);
  return WEEKDAYS.map((weekday, index) => {
    const date = addDays(monday, index);
    const key = toDateKey(date);
    return { ...weekday, date, key, isToday: key === todayKey };
  });
}

// 달력에 그릴 주들(월요일 시작). 앞뒤 달 날짜로 첫 주·마지막 주를 채운다.
export function monthWeeks(month) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  let cursor = addDays(first, -((first.getDay() + 6) % 7));
  const weeks = [];
  while (cursor <= last) {
    const week = [];
    for (let index = 0; index < 7; index += 1) { week.push(cursor); cursor = addDays(cursor, 1); }
    weeks.push(week);
  }
  return weeks;
}

export function monthLabel(date) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}
// '10월 30일 (금)', 올해가 아니면 연도를 붙인다.
export function dateLabel(key, today = new Date()) {
  const date = fromDateKey(key);
  const year = date.getFullYear() !== today.getFullYear() ? `${date.getFullYear()}년 ` : '';
  return `${year}${date.getMonth() + 1}월 ${date.getDate()}일 (${weekdayLabel(date.getDay())})`;
}
// '10월 26일 ~ 11월 1일' / 같은 달이면 '11월 2일 ~ 8일' / short(모바일): '10.26 ~ 11.1'
export function weekRangeLabel(week, { short = false, today = new Date() } = {}) {
  const first = week[0].date;
  const last = week[week.length - 1].date;
  if (short) return `${first.getFullYear() !== today.getFullYear() ? `${first.getFullYear()}.` : ''}${first.getMonth() + 1}.${first.getDate()} ~ ${last.getMonth() + 1}.${last.getDate()}`;
  const year = first.getFullYear() !== today.getFullYear() ? `${first.getFullYear()}년 ` : '';
  const end = first.getMonth() === last.getMonth() ? `${last.getDate()}일` : `${last.getMonth() + 1}월 ${last.getDate()}일`;
  return `${year}${first.getMonth() + 1}월 ${first.getDate()}일 ~ ${end}`;
}
