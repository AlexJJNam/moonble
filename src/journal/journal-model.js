// 일지·회고 모양과 날짜 계산. 날짜는 서울 기준 'YYYY-MM-DD' 키로만 다루고(기기 시간대와 무관),
// 실제 저장 시각(created_at·updated_at)과 섞지 않는다. 주는 월요일 시작, 달은 1일 시작.
export const JOURNAL_KINDS = [
  { value: 'daily', label: '일간 일지', short: '일간' },
  { value: 'weekly', label: '주간 회고', short: '주간' },
  { value: 'monthly', label: '월간 회고', short: '월간' },
];
export const MOODS = [
  { value: 5, emoji: '😄', label: '매우 좋음' },
  { value: 4, emoji: '🙂', label: '좋음' },
  { value: 3, emoji: '😐', label: '보통' },
  { value: 2, emoji: '😔', label: '좋지 않음' },
  { value: 1, emoji: '😣', label: '매우 좋지 않음' },
];
export const BODY_COPY = {
  daily: { label: '오늘 있었던 일', prompt: '오늘 하루를 자유롭게 기록해 보세요.' },
  weekly: { label: '자유롭게 남기기', prompt: '이번 주를 돌아보며 떠오르는 생각을 적어 보세요.' },
  monthly: { label: '자유롭게 남기기', prompt: '이번 달을 돌아보며 떠오르는 생각을 적어 보세요.' },
};
export const QUESTIONS = {
  daily: [
    { key: 'good', label: '오늘 잘한 일', prompt: '오늘 가장 잘한 일은 무엇인가요?' },
    { key: 'learned', label: '새롭게 배운 것', prompt: '오늘 새롭게 알게 되거나 배운 것은 무엇인가요?' },
    { key: 'regret', label: '아쉬웠던 점', prompt: '오늘 아쉬웠거나 어려웠던 점은 무엇인가요?' },
    { key: 'tomorrow', label: '내일 할 일', prompt: '내일은 무엇을 할 계획인가요?' },
  ],
  weekly: [
    { key: 'achieved', label: '이번 주에 달성한 것', prompt: '이번 주에 해낸 일을 적어 보세요.' },
    { key: 'meaningful', label: '가장 의미 있었던 경험', prompt: '이번 주 가장 의미 있었던 순간은 언제였나요?' },
    { key: 'hard', label: '이번 주 어려웠던 점', prompt: '이번 주 어렵거나 막혔던 일은 무엇인가요?' },
    { key: 'learned', label: '새롭게 배운 것', prompt: '이번 주 새롭게 알게 된 것은 무엇인가요?' },
    { key: 'next', label: '다음 주의 목표', prompt: '다음 주에는 무엇을 이루고 싶나요?' },
  ],
  monthly: [
    { key: 'achievements', label: '이번 달의 주요 성취', prompt: '이번 달 이룬 것들을 돌아보세요.' },
    { key: 'memorable', label: '가장 기억에 남는 경험', prompt: '이번 달 가장 기억에 남는 일은 무엇인가요?' },
    { key: 'learned', label: '이번 달 새롭게 알게 된 것', prompt: '이번 달 새롭게 배운 것은 무엇인가요?' },
    { key: 'improve', label: '개선하고 싶은 부분', prompt: '다음에는 무엇을 바꿔 보고 싶나요?' },
    { key: 'next', label: '다음 달의 목표', prompt: '다음 달에 이루고 싶은 목표를 적어 보세요.' },
  ],
};
export const LIMITS = { title: 100, body: 20000, answer: 5000, tags: 20, tag: 20 };
const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

// ── 날짜 키(서울 기준). 계산은 UTC 자정 Date로 해서 기기 시간대·서머타임 영향을 받지 않는다.
export function seoulDateKey(at = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(at));
}
export function seoulTimeLabel(at) {
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: 'numeric', minute: '2-digit' }).format(new Date(at));
}
function utc(key) {
  const [year, month, day] = String(key).split('-').map(Number);
  return new Date(Date.UTC(year, (month || 1) - 1, day || 1));
}
const keyOf = date => date.toISOString().slice(0, 10);
export function isDateKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const date = utc(value);
  return !Number.isNaN(date.getTime()) && keyOf(date) === value;
}
export function addDays(key, amount) { const date = utc(key); date.setUTCDate(date.getUTCDate() + amount); return keyOf(date); }
export function weekStart(key) { const date = utc(key); date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7)); return keyOf(date); }
export function monthStart(key) { return `${String(key).slice(0, 7)}-01`; }
export function addMonths(key, amount) { const date = utc(monthStart(key)); date.setUTCMonth(date.getUTCMonth() + amount); return keyOf(date); }
export function monthEnd(key) { const date = utc(monthStart(key)); date.setUTCMonth(date.getUTCMonth() + 1); date.setUTCDate(0); return keyOf(date); }
export function weekdayOf(key) { return utc(key).getUTCDay(); }
export function periodStart(kind, key) { return kind === 'weekly' ? weekStart(key) : kind === 'monthly' ? monthStart(key) : key; }
export function periodEnd(kind, start) { return kind === 'weekly' ? addDays(start, 6) : kind === 'monthly' ? monthEnd(start) : start; }
export function stepPeriod(kind, start, step) { return kind === 'weekly' ? addDays(start, step * 7) : kind === 'monthly' ? addMonths(start, step) : addDays(start, step); }

// ── 표시용 라벨
export function dayLabel(key, today = seoulDateKey()) {
  const [year, month, day] = key.split('-').map(Number);
  return `${key.slice(0, 4) !== today.slice(0, 4) ? `${year}년 ` : ''}${month}월 ${day}일 (${WEEKDAY_LABELS[weekdayOf(key)]})`;
}
export function weekdayLabel(key) { return WEEKDAY_LABELS[weekdayOf(key)]; }
export function monthLabel(key) { const [year, month] = key.split('-').map(Number); return `${year}년 ${month}월`; }
export function periodLabel(kind, start, { short = false, today = seoulDateKey() } = {}) {
  if (kind === 'daily') return dayLabel(start, today);
  if (kind === 'monthly') return monthLabel(start);
  const end = addDays(start, 6);
  const [, m1, d1] = start.split('-').map(Number);
  const [, m2, d2] = end.split('-').map(Number);
  if (short) return `${m1}.${d1} ~ ${m2}.${d2}`;
  return `${start.slice(0, 4) !== today.slice(0, 4) ? `${start.slice(0, 4)}년 ` : ''}${m1}월 ${d1}일 ~ ${m1 === m2 ? '' : `${m2}월 `}${d2}일`;
}
// 달력: 월요일 시작 주(날짜 키 7개씩)
export function monthGrid(key) {
  const last = monthEnd(key);
  const weeks = [];
  let cursor = weekStart(monthStart(key));
  while (cursor <= last) {
    const week = [];
    for (let index = 0; index < 7; index += 1) { week.push(cursor); cursor = addDays(cursor, 1); }
    weeks.push(week);
  }
  return weeks;
}

// ── 일지 모양
export function emptyEntry(kind, start) {
  return { id: null, kind, periodStart: start, title: '', body: '', answers: {}, mood: null, tags: [], createdAt: null, updatedAt: null };
}
export function normalizeTag(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().replace(/^#+/, '').slice(0, LIMITS.tag);
}
export function normalizeEntry(row) {
  if (!row || !JOURNAL_KINDS.some(kind => kind.value === row.kind) || !isDateKey(String(row.period_start || row.periodStart || '').slice(0, 10))) return null;
  const answers = {};
  Object.entries(row.answers && typeof row.answers === 'object' ? row.answers : {}).forEach(([key, value]) => {
    if (typeof value === 'string' && /^[a-z]{1,20}$/.test(key)) answers[key] = value.slice(0, LIMITS.answer);
  });
  const mood = Number(row.mood);
  return {
    id: row.id || null,
    kind: row.kind,
    periodStart: String(row.period_start || row.periodStart).slice(0, 10),
    title: String(row.title || '').slice(0, LIMITS.title),
    body: String(row.body || '').slice(0, LIMITS.body),
    answers,
    mood: Number.isInteger(mood) && mood >= 1 && mood <= 5 ? mood : null,
    tags: [...new Set((Array.isArray(row.tags) ? row.tags : []).map(normalizeTag).filter(Boolean))].slice(0, LIMITS.tags),
    createdAt: row.created_at || row.createdAt || null,
    updatedAt: row.updated_at || row.updatedAt || null,
  };
}
export function toRow(entry) {
  const answers = {};
  (QUESTIONS[entry.kind] || []).forEach(question => {
    const value = String(entry.answers?.[question.key] || '');
    if (value.trim()) answers[question.key] = value.slice(0, LIMITS.answer);
  });
  return {
    workspace: 'personal',
    kind: entry.kind,
    period_start: entry.periodStart,
    period_end: periodEnd(entry.kind, entry.periodStart),
    title: entry.title.slice(0, LIMITS.title),
    body: entry.body.slice(0, LIMITS.body),
    answers,
    mood: entry.kind === 'daily' ? entry.mood : null,
    tags: entry.kind === 'daily' ? entry.tags.slice(0, LIMITS.tags) : [],
  };
}
// 실제로 쓴 내용이 있는지(빈 일지는 만들지 않고, 달력·목록에도 쓴 날로 치지 않는다)
export function hasContent(entry) {
  if (!entry) return false;
  return Boolean(entry.title.trim() || entry.body.trim() || Object.values(entry.answers || {}).some(value => String(value).trim()) || entry.mood || entry.tags.length);
}
export function previewText(entry) {
  const parts = [entry.body, ...(QUESTIONS[entry.kind] || []).map(question => entry.answers?.[question.key])].map(value => String(value || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
  return parts[0] || '';
}
export function moodOf(value) { return MOODS.find(mood => mood.value === value) || null; }
