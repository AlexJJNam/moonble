// 내 캘린더에 저장: iPhone·기본 캘린더는 share.moonble.com/calendar.ics(.ics 파일),
// Google 캘린더는 날짜(매주 일정이면 반복 요일까지)를 채운 일정 추가 화면으로 연다.
import { fromDateKey, paperUrl } from './schedule-model.js';

const CALENDAR_FILE_ENDPOINT = 'https://share.moonble.com/calendar.ics';
const APP_ORIGIN = 'https://moonble.com/';
const RRULE_DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

function base64Url(text) {
  let binary = '';
  new TextEncoder().encode(text).forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function absolutePaperUrl(schedule) {
  return schedule.paper ? new URL(paperUrl(schedule.paper), APP_ORIGIN).href : '';
}

export function calendarFileUrl(schedule) {
  const payload = {
    t: schedule.title, m: schedule.memo.slice(0, 300), d: schedule.days, s: schedule.start, e: schedule.end,
    n: schedule.notify ? schedule.notifyBefore : null, u: absolutePaperUrl(schedule), p: schedule.paper?.title || '',
    z: schedule.timezone, i: schedule.id, w: schedule.repeatWeekly === false ? 0 : 1, f: schedule.date || '',
  };
  return `${CALENDAR_FILE_ENDPOINT}?e=${base64Url(JSON.stringify(payload))}`;
}

// 오늘(시작 날짜가 뒤면 그날)부터 처음 오는 반복 요일
function firstOccurrence(days, from) {
  for (let offset = 0; offset < 7; offset += 1) {
    const date = new Date(from);
    date.setDate(from.getDate() + offset);
    if (days.includes(date.getDay())) return date;
  }
  return from;
}

function eventDate(schedule, today = new Date()) {
  if (schedule.repeatWeekly === false) return fromDateKey(schedule.date);
  const start = schedule.date ? fromDateKey(schedule.date) : null;
  return firstOccurrence(schedule.days, start && start > today ? start : today);
}

export function googleCalendarUrl(schedule) {
  const date = eventDate(schedule);
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const link = absolutePaperUrl(schedule);
  const details = [schedule.memo, schedule.paper?.title && `예약한 문제지: ${schedule.paper.title}`, link, '문블 시간표에서 만든 일정이에요.'].filter(Boolean).join('\n');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: schedule.title,
    dates: `${ymd}T${schedule.start.replace(':', '')}00/${ymd}T${schedule.end.replace(':', '')}00`,
    details,
    ctz: schedule.timezone,
  });
  if (schedule.repeatWeekly !== false) params.set('recur', `RRULE:FREQ=WEEKLY;BYDAY=${[...schedule.days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map(day => RRULE_DAYS[day]).join(',')}`);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
