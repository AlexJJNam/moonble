// 워크스페이스 시간표: 날짜에 한 번 있는 일정과 매주 반복 일정(시간·메모·색상·알림·예약 문제지).
// 주 보기는 에브리타임처럼 시간축 주간표, 월 보기는 달력 + 고른 날의 일정 목록. ‹ ›로 주·달을 옮기고 빈 칸·날짜를 눌러 그날 일정을 만든다(Google Calendar).
// 일정에 문제지를 검색해 연결하면 알림을 눌렀을 때 그 문제지 풀이로 이동한다(MyStudyLife).
import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { WheelPicker, WheelPickerWrapper } from '@ncdai/react-wheel-picker';
import '@ncdai/react-wheel-picker/style.css';
import { Bell, BellOff, BookOpen, CalendarPlus, Check, ChevronLeft, ChevronRight, Plus, Search, X } from 'lucide-react';
import { FlowActionButton } from '../flow-action-button.jsx';
import { getCustomBankCollection } from '../custom-bank.js';
import { getLikedPublicQuizzes } from '../paper-favorites.js';
import { BUILT_IN_PAPER_PREVIEWS } from '../paper-preview.jsx';
import { enableBrowserNotifications, getBrowserNotificationSettings } from '../browser-notifications.js';
import { lockPageScroll } from '../scroll-lock.js';
import { listPublicQuizzes } from '../public-quizzes-api.js';
import { deleteSchedule, listSchedules, saveSchedule } from './schedule-api.js';
import { calendarFileUrl, googleCalendarUrl } from './schedule-calendar.js';
import {
  MEMO_LIMIT, NOTIFY_OPTIONS, SCHEDULE_COLOR_LABELS, SCHEDULE_COLORS, TITLE_LIMIT, WEEKDAYS,
  addDays, dateLabel, formatMinutes, fromDateKey, localTimezone, monthLabel, monthWeeks, occursOn, sortByStart, toDateKey, toMinutes, weekDates, weekRangeLabel,
} from './schedule-model.js';
import './schedule.css';

const HOUR_HEIGHT = 48;
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => { const value = String(hour).padStart(2, '0'); return { value, label: value }; });
const MINUTE_OPTIONS = Array.from({ length: 12 }, (_, index) => { const value = String(index * 5).padStart(2, '0'); return { value, label: value }; });
const LAST_START = 23 * 60 + 55;

// iOS처럼 굴려서 고르는 시·분 휠(React Wheel Picker). 분은 5분 단위.
function TimeWheel({ value, onChange, label }) {
  const [hour, rawMinute] = value.split(':');
  const minute = String((Math.round(Number(rawMinute) / 5) * 5) % 60).padStart(2, '0');
  const wheelProps = { infinite: true, optionItemHeight: 36, visibleCount: 16, classNames: { optionItem: 'mb-time-wheel-option', highlightWrapper: 'mb-time-wheel-highlight' } };
  return <div className="mb-time-wheel" role="group" aria-label={`${label} 시간 선택`}>
    <WheelPickerWrapper className="mb-time-wheel-wrapper">
      <WheelPicker {...wheelProps} options={HOUR_OPTIONS} value={hour} onValueChange={next => onChange(`${next}:${minute}`)} />
      <WheelPicker {...wheelProps} options={MINUTE_OPTIONS} value={minute} onValueChange={next => onChange(`${hour}:${next}`)} />
    </WheelPickerWrapper>
    <span className="mb-time-wheel-colon" aria-hidden="true">:</span>
  </div>;
}

// 고르기 시트: 모바일은 아래에서 올라오는 바텀시트, PC는 가운데 작은 창. 확인을 눌러야 반영된다.
function PickerSheet({ title, error = '', opener, onConfirm, onClose, children }) {
  const titleId = useId();
  const sheetRef = useRef(null);
  // 열면 시트로 포커스를 옮겨(입력 중이던 키보드는 내려간다) 닫으면 눌렀던 버튼으로 돌려준다.
  useEffect(() => {
    sheetRef.current?.focus({ preventScroll: true });
    return () => { if (opener?.isConnected) opener.focus({ preventScroll: true }); };
  }, [opener]);
  return createPortal(<div className="mb-time-sheet-layer" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={sheetRef} className="mb-time-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
      <h3 id={titleId}>{title}</h3>
      {children}
      {error && <p className="mb-time-sheet-error" role="alert">{error}</p>}
      <button type="button" className="mb-time-sheet-confirm" disabled={Boolean(error)} onClick={onConfirm}>확인</button>
    </div>
  </div>, document.body);
}

function TimeSheet({ label, value, problem, opener, onConfirm, onClose }) {
  const [draft, setDraft] = useState(value);
  return <PickerSheet title={label} error={problem ? problem(draft) : ''} opener={opener} onClose={onClose} onConfirm={() => onConfirm(draft)}>
    <TimeWheel label={label} value={draft} onChange={setDraft} />
  </PickerSheet>;
}

// 날짜 고르기: 달을 넘기며 하루를 누르고 확인
function DateSheet({ title, value, opener, onConfirm, onClose }) {
  const [draft, setDraft] = useState(value);
  const [month, setMonth] = useState(() => { const date = fromDateKey(value); return new Date(date.getFullYear(), date.getMonth(), 1); });
  const todayKey = toDateKey(new Date());
  const moveMonth = step => setMonth(current => new Date(current.getFullYear(), current.getMonth() + step, 1));
  return <PickerSheet title={title} opener={opener} onClose={onClose} onConfirm={() => onConfirm(draft)}>
    <div className="mb-date-picker">
      <div className="mb-date-picker-head">
        <button type="button" aria-label="이전 달" onClick={() => moveMonth(-1)}><ChevronLeft size={20} aria-hidden="true" /></button>
        <strong aria-live="polite">{monthLabel(month)}</strong>
        <button type="button" aria-label="다음 달" onClick={() => moveMonth(1)}><ChevronRight size={20} aria-hidden="true" /></button>
      </div>
      <div className="mb-date-picker-grid">
        {WEEKDAYS.map(day => <span key={day.value} aria-hidden="true">{day.label}</span>)}
        {monthWeeks(month).flat().map(date => {
          const key = toDateKey(date);
          if (date.getMonth() !== month.getMonth()) return <i key={key} aria-hidden="true" />;
          return <button key={key} type="button" className={key === todayKey ? 'is-today' : ''} aria-pressed={key === draft} aria-label={dateLabel(key)} onClick={() => setDraft(key)}><span>{date.getDate()}</span></button>;
        })}
      </div>
    </div>
  </PickerSheet>;
}

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [query]);
  return matches;
}

// 연결할 수 있는 문제지(기기에 있는 것): 내 문제지 · 기본 문제지 · 스크랩한 공개 문제. 공개 문제는 검색할 때 서버에서 더 찾는다.
function localPapers(userId) {
  return [
    ...getCustomBankCollection(userId).banks.map(bank => ({ value: `custom:${bank.id}`, kind: 'custom', ref: bank.id, title: bank.title, group: '내 문제지' })),
    ...BUILT_IN_PAPER_PREVIEWS.map(paper => ({ value: `builtin:${paper.id}`, kind: 'builtin', ref: paper.id, title: paper.label, group: '기본 문제지' })),
    ...getLikedPublicQuizzes(userId).map(item => ({ value: `share:${item.token}`, kind: 'share', ref: item.token, title: item.title || '공개 문제', group: '스크랩한 공개 문제' })),
  ];
}

// 일정에 연결할 문제지 검색: 기기에 있는 문제지 + 문제 찾기의 공개 문제
function PaperPicker({ userId, value, onChange }) {
  const [query, setQuery] = useState('');
  const [remote, setRemote] = useState([]);
  const local = useMemo(() => localPapers(userId), [userId]);
  useEffect(() => {
    const term = query.trim();
    if (!term) { setRemote([]); return undefined; }
    let alive = true;
    const timer = window.setTimeout(() => {
      listPublicQuizzes({ query: term })
        .then(page => { if (alive) setRemote(page.items.slice(0, 5).map(item => ({ value: `share:${item.token}`, kind: 'share', ref: item.token, title: item.title, group: '공개 문제' }))); })
        .catch(() => { if (alive) setRemote([]); });
    }, 250);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [query]);
  if (value) {
    return <div className="mb-schedule-paper-picked">
      <BookOpen size={16} aria-hidden="true" /><span>{value.title || '연결한 문제지'}</span>
      <button type="button" aria-label="문제지 연결 해제" onClick={() => onChange(null)}><X size={14} aria-hidden="true" /></button>
    </div>;
  }
  const needle = query.trim().toLocaleLowerCase();
  const matches = [
    ...local.filter(item => !needle || item.title.toLocaleLowerCase().includes(needle)),
    ...remote.filter(item => !local.some(saved => saved.value === item.value)),
  ].slice(0, needle ? 8 : 4);
  return <div className="mb-schedule-paper-search">
    <label className="mb-schedule-paper-input"><Search size={16} aria-hidden="true" /><span className="mb-sr-only">문제지 검색</span>
      <input type="search" value={query} maxLength={50} placeholder="문제지 이름으로 검색" onChange={event => setQuery(event.target.value)} />
    </label>
    {matches.length > 0
      ? <ul className="mb-schedule-paper-results">{matches.map(item => <li key={item.value}>
        <button type="button" onClick={() => onChange({ kind: item.kind, ref: item.ref, title: item.title })}><span>{item.title}</span><small>{item.group}</small></button>
      </li>)}</ul>
      : <p className="mb-schedule-paper-empty">{needle ? '찾는 문제지가 없어요.' : '연결할 문제지가 아직 없어요.'}</p>}
  </div>;
}

function nextHourStart() {
  const now = new Date();
  return Math.min(22 * 60, (now.getHours() + 1) * 60);
}

// 새 일정은 그 날짜에 한 번(매주 반복은 편집 화면에서 켠다).
function emptyDraft(date, startMinutes = nextHourStart()) {
  return { id: null, title: '', memo: '', repeatWeekly: false, date: toDateKey(date), days: [date.getDay()], start: formatMinutes(startMinutes), end: formatMinutes(Math.min(startMinutes + 60, 23 * 60 + 59)), color: 'blue', notify: true, notifyBefore: 10, paper: null };
}

// 알림 상태 한 줄: 허용 전이면 버튼, 막혀 있으면 안내
function NotificationStatus({ userId }) {
  const [, refresh] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const update = () => refresh(value => value + 1);
    window.addEventListener('moonble:browser-notifications-changed', update);
    return () => window.removeEventListener('moonble:browser-notifications-changed', update);
  }, []);
  const settings = getBrowserNotificationSettings(userId);
  const permission = typeof Notification === 'function' ? Notification.permission : 'unsupported';
  async function allow() {
    setBusy(true);
    try {
      if (settings.permission === 'unconfigured') await Notification.requestPermission();
      else await enableBrowserNotifications(userId);
    } catch { /* 아래 안내 문구가 상태를 보여준다. */ }
    finally { setBusy(false); refresh(value => value + 1); }
  }
  let copy = '';
  let action = null;
  if (settings.permission === 'install-required') copy = '홈 화면에 추가한 문블 앱에서 알림을 받을 수 있어요.';
  else if (settings.permission === 'unsupported' || settings.permission === 'insecure' || permission === 'unsupported') copy = '이 브라우저에서는 알림을 받을 수 없어요. 문블이 열려 있으면 화면으로 알려드려요.';
  else if (permission === 'denied') copy = '브라우저 설정에서 문블 알림을 허용하면 시간에 맞춰 알려드려요.';
  else if (permission === 'default') { copy = '알림을 허용하면 시간에 맞춰 알려드려요.'; action = '알림 허용'; }
  else if (settings.permission === 'granted' && !settings.enabled) { copy = '알림이 켜져 있어요. 문블을 닫아도 받으려면 푸시 알림을 켜주세요.'; action = '푸시 알림 켜기'; }
  else if (settings.permission === 'unconfigured') copy = '알림이 켜져 있어요. 문블이 열려 있을 때 알려드려요.';
  else copy = '알림이 켜져 있어요.';
  return <p className="mb-schedule-notify-status">
    {permission === 'granted' ? <Bell size={14} aria-hidden="true" /> : <BellOff size={14} aria-hidden="true" />}
    <span>{copy}</span>
    {action && <button type="button" disabled={busy} onClick={allow}>{busy ? '확인 중' : action}</button>}
  </p>;
}

// 겹치는 일정은 나란히 놓는다.
function layoutDay(items) {
  const sorted = sortByStart(items);
  const placed = [];
  let cluster = [];
  let clusterEnd = -1;
  const flush = () => {
    const columns = Math.max(1, ...cluster.map(item => item.column + 1));
    cluster.forEach(item => { item.columns = columns; });
    placed.push(...cluster);
    cluster = [];
  };
  sorted.forEach(schedule => {
    const start = toMinutes(schedule.start);
    const end = toMinutes(schedule.end);
    if (cluster.length && start >= clusterEnd) { flush(); clusterEnd = -1; }
    const used = new Set(cluster.filter(item => toMinutes(item.schedule.end) > start).map(item => item.column));
    let column = 0;
    while (used.has(column)) column += 1;
    cluster.push({ schedule, column, start, end });
    clusterEnd = Math.max(clusterEnd, end);
  });
  if (cluster.length) flush();
  return placed;
}

// 주 보기: 시간축 주간표. 빈 칸을 누르면 그 날짜·시간으로 새 일정을 연다.
function WeekGrid({ week, items, compact, onEdit, onAddAt }) {
  const weekItems = items.filter(item => week.some(day => occursOn(item, day.date)));
  const starts = weekItems.map(item => toMinutes(item.start));
  const ends = weekItems.map(item => toMinutes(item.end));
  const firstHour = Math.max(0, Math.min(8, ...starts.map(value => Math.floor(value / 60))));
  const lastHour = Math.min(24, Math.max(22, ...ends.map(value => Math.ceil(value / 60))));
  const hours = Array.from({ length: lastHour - firstHour }, (_, index) => firstHour + index);
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return <div className={`mb-week${compact ? ' is-compact' : ''}`} style={{ '--hour-height': `${HOUR_HEIGHT}px` }}>
    <div className="mb-week-head" aria-hidden="true">
      <span />
      {week.map(day => <span key={day.key} className={day.isToday ? 'is-today' : ''}>{day.label}<b>{day.date.getDate()}</b></span>)}
    </div>
    <div className="mb-week-body" style={{ height: hours.length * HOUR_HEIGHT }}>
      <div className="mb-week-times" aria-hidden="true">{hours.map(hour => <span key={hour} style={{ top: (hour - firstHour) * HOUR_HEIGHT }}>{compact ? hour : `${String(hour).padStart(2, '0')}:00`}</span>)}</div>
      {week.map(day => {
        const dayItems = layoutDay(weekItems.filter(item => occursOn(item, day.date)));
        return <div key={day.key} className={`mb-week-col${day.isToday ? ' is-today' : ''}`} role="group" aria-label={dateLabel(day.key)}
          onClick={event => {
            if (event.target !== event.currentTarget) return;
            const rect = event.currentTarget.getBoundingClientRect();
            const minutes = firstHour * 60 + Math.floor((event.clientY - rect.top) / HOUR_HEIGHT) * 60;
            onAddAt(day.date, Math.min(minutes, 22 * 60));
          }}>
          {hours.map(hour => <i key={hour} className="mb-week-line" style={{ top: (hour - firstHour) * HOUR_HEIGHT }} aria-hidden="true" />)}
          {day.isToday && nowMinutes >= firstHour * 60 && nowMinutes <= lastHour * 60 && <i className="mb-week-now" style={{ top: (nowMinutes - firstHour * 60) * HOUR_HEIGHT / 60 }} aria-hidden="true" />}
          {dayItems.map(({ schedule, column, columns, start, end }) => <button key={schedule.id} type="button" className={`mb-week-block is-${schedule.color}`}
            style={{ top: (start - firstHour * 60) * HOUR_HEIGHT / 60, height: Math.max(22, (end - start) * HOUR_HEIGHT / 60 - 2), left: `calc(${(column / columns) * 100}% + 2px)`, width: `calc(${100 / columns}% - 4px)` }}
            onClick={() => onEdit(schedule)} aria-label={`${dateLabel(day.key)} ${schedule.start} ~ ${schedule.end} ${schedule.title}`}>
            <strong>{schedule.title}</strong>
            {!compact && <small>{schedule.start} ~ {schedule.end}</small>}
            {schedule.paper && <small className="mb-week-block-paper">{compact ? '문제지' : schedule.paper.title}</small>}
          </button>)}
        </div>;
      })}
    </div>
  </div>;
}

// 월 보기: 날짜 칸에 그날 일정을 색 띠로 보여주고, 누른 날은 아래 목록에 펼친다.
function MonthView({ month, items, selected, compact, onSelect }) {
  const todayKey = toDateKey(new Date());
  const limit = compact ? 2 : 3;
  return <div className={`mb-month${compact ? ' is-compact' : ''}`}>
    <div className="mb-month-head" aria-hidden="true">{WEEKDAYS.map(day => <span key={day.value}>{day.label}</span>)}</div>
    {monthWeeks(month).map(week => <div key={toDateKey(week[0])} className="mb-month-week">
      {week.map(date => {
        const key = toDateKey(date);
        const dayItems = sortByStart(items.filter(item => occursOn(item, date)));
        const className = `mb-month-day${date.getMonth() !== month.getMonth() ? ' is-outside' : ''}${key === todayKey ? ' is-today' : ''}${key === selected ? ' is-selected' : ''}`;
        return <button key={key} type="button" className={className} aria-pressed={key === selected} aria-current={key === todayKey ? 'date' : undefined}
          aria-label={`${dateLabel(key)}${dayItems.length ? `, 일정 ${dayItems.length}개` : ''}`} onClick={() => onSelect(key)}>
          <b>{date.getDate()}</b>
          {dayItems.slice(0, limit).map(item => <span key={item.id} className={`mb-month-event is-${item.color}`}>{item.title}</span>)}
          {dayItems.length > limit && <small>+{dayItems.length - limit}</small>}
        </button>;
      })}
    </div>)}
  </div>;
}

// 고른 날의 일정 목록. 누르면 편집한다.
function DayAgenda({ dateKey, items, onEdit }) {
  const date = fromDateKey(dateKey);
  const dayItems = sortByStart(items.filter(item => occursOn(item, date)));
  return <section className="mb-agenda" aria-label={`${dateLabel(dateKey)} 일정`}>
    <h2>{dateLabel(dateKey)}</h2>
    {dayItems.length
      ? <ul>{dayItems.map(item => <li key={item.id}>
        <button type="button" className={`mb-agenda-item is-${item.color}`} onClick={() => onEdit(item)}>
          <span className="mb-agenda-time"><b>{item.start}</b><small>{item.end}</small></span>
          <span className="mb-agenda-copy"><strong>{item.title}</strong>
            {(item.repeatWeekly || item.paper || item.memo) && <small>{[item.repeatWeekly && '매주 반복', item.paper?.title, item.memo.split('\n')[0]].filter(Boolean).join(' · ')}</small>}
          </span>
        </button>
      </li>)}</ul>
      : <p className="mb-agenda-empty">이 날은 일정이 없어요.</p>}
  </section>;
}

// ‹ 기간 › · 오늘 · 주/월
function CalendarToolbar({ view, label, onMove, onToday, onView }) {
  const unit = view === 'week' ? '주' : '달';
  return <div className="mb-calendar-toolbar">
    <div className="mb-calendar-period">
      <button type="button" aria-label={`이전 ${unit}`} onClick={() => onMove(-1)}><ChevronLeft size={20} aria-hidden="true" /></button>
      <strong aria-live="polite">{label}</strong>
      <button type="button" aria-label={`다음 ${unit}`} onClick={() => onMove(1)}><ChevronRight size={20} aria-hidden="true" /></button>
    </div>
    <button type="button" className="mb-calendar-today" onClick={onToday}>오늘</button>
    <div className="mb-calendar-views" role="group" aria-label="보기">
      <button type="button" aria-pressed={view === 'week'} onClick={() => onView('week')}>주</button>
      <button type="button" aria-pressed={view === 'month'} onClick={() => onView('month')}>월</button>
    </div>
  </div>;
}

// 일정 추가·편집 시트(모바일은 아래에서 올라오는 시트, PC는 가운데 창)
function ScheduleEditor({ userId, initial, onSave, onDelete, onClose }) {
  const titleId = useId();
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [picker, setPicker] = useState(null);
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const pickerRef = useRef(picker);
  pickerRef.current = picker;
  const pickerButtonsRef = useRef({});
  useEffect(() => {
    const unlock = lockPageScroll();
    dialogRef.current?.querySelector('input')?.focus({ preventScroll: true });
    const onKey = event => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      if (pickerRef.current) setPicker(null);
      else onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => { unlock(); document.removeEventListener('keydown', onKey); };
  }, []);
  const set = patch => setDraft(current => ({ ...current, ...patch }));
  // 날짜를 바꾸면 한 번 일정은 그 요일로, 매주 일정은 요일 하나만 골랐을 때 새 날짜 요일로 옮긴다.
  const changeDate = key => setDraft(current => {
    const weekday = fromDateKey(key).getDay();
    if (!current.repeatWeekly) return { ...current, date: key, days: [weekday] };
    const previous = fromDateKey(current.date).getDay();
    return { ...current, date: key, days: current.days.length === 1 && current.days[0] === previous ? [weekday] : current.days };
  });
  const toggleRepeat = on => setDraft(current => {
    const weekday = fromDateKey(current.date).getDay();
    return { ...current, repeatWeekly: on, days: on && current.days.includes(weekday) ? current.days : [weekday] };
  });
  // 시작을 바꾸면 일정 길이를 유지한 채 끝도 함께 옮긴다.
  const changeStart = next => setDraft(current => {
    const duration = Math.max(5, toMinutes(current.end) - toMinutes(current.start));
    const start = Math.min(toMinutes(next), LAST_START);
    return { ...current, start: formatMinutes(start), end: formatMinutes(Math.min(start + duration, 23 * 60 + 59)) };
  });
  const timeInvalid = toMinutes(draft.end) <= toMinutes(draft.start);
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    if (!draft.title.trim()) { setError('제목을 입력해주세요.'); return; }
    if (draft.repeatWeekly && !draft.days.length) { setError('반복할 요일을 하나 이상 골라주세요.'); return; }
    if (toMinutes(draft.end) <= toMinutes(draft.start)) { setError('끝나는 시간은 시작 시간보다 늦어야 해요.'); return; }
    setBusy(true); setError('');
    try { await onSave({ ...draft, title: draft.title.trim(), timezone: localTimezone() }); }
    catch (saveError) { setError(saveError.message || '일정을 저장하지 못했어요.'); setBusy(false); }
  }
  async function remove() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setBusy(true);
    try { await onDelete(draft.id); }
    catch (deleteError) { setError(deleteError.message || '일정을 삭제하지 못했어요.'); setBusy(false); }
  }
  return createPortal(<div className="mb-schedule-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <form ref={dialogRef} className="mb-schedule-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} onSubmit={submit}>
      <header>
        <h2 id={titleId}>{draft.id ? '일정 편집' : '일정 추가'}</h2>
        <button type="button" className="mb-schedule-close" aria-label="닫기" onClick={onClose} disabled={busy}><X size={19} aria-hidden="true" /></button>
        <button type="submit" className="mb-schedule-header-save" disabled={busy}>{busy ? '저장 중' : '저장'}</button>
      </header>
      <label className="mb-schedule-field"><span>제목</span>
        <input type="text" value={draft.title} maxLength={TITLE_LIMIT} placeholder="예: GA4 이벤트 복습" onChange={event => set({ title: event.target.value })} />
      </label>
      <div className="mb-schedule-field"><span>{draft.repeatWeekly ? '시작 날짜' : '날짜'}</span>
        <button ref={node => { pickerButtonsRef.current.date = node; }} type="button" className={`mb-schedule-date-button${picker === 'date' ? ' is-open' : ''}`} aria-haspopup="dialog" aria-expanded={picker === 'date'} onClick={() => setPicker('date')}>{dateLabel(draft.date)}</button>
        {picker === 'date' && <DateSheet title={draft.repeatWeekly ? '시작 날짜' : '날짜'} value={draft.date} opener={pickerButtonsRef.current.date}
          onClose={() => setPicker(null)} onConfirm={key => { changeDate(key); setPicker(null); }} />}
      </div>
      <div className="mb-schedule-field">
        <span>시간</span>
        <div className="mb-schedule-time-row">
          <button ref={node => { pickerButtonsRef.current.start = node; }} type="button" aria-haspopup="dialog" aria-expanded={picker === 'start'} className={picker === 'start' ? 'is-open' : ''} onClick={() => setPicker('start')}><small>시작</small><b>{draft.start}</b></button>
          <span aria-hidden="true">~</span>
          <button ref={node => { pickerButtonsRef.current.end = node; }} type="button" aria-haspopup="dialog" aria-expanded={picker === 'end'} className={`${picker === 'end' ? 'is-open' : ''}${timeInvalid ? ' is-invalid' : ''}`} onClick={() => setPicker('end')}><small>끝</small><b>{draft.end}</b></button>
        </div>
        {(picker === 'start' || picker === 'end') && <TimeSheet key={picker} opener={pickerButtonsRef.current[picker]} label={picker === 'start' ? '시작 시간' : '끝나는 시간'} value={picker === 'start' ? draft.start : draft.end}
          problem={picker === 'end' ? next => (toMinutes(next) <= toMinutes(draft.start) ? `시작 시간(${draft.start})보다 늦게 골라주세요.` : '') : undefined}
          onClose={() => setPicker(null)}
          onConfirm={next => { if (picker === 'start') changeStart(next); else set({ end: next }); setPicker(null); }} />}
        {timeInvalid && <small className="mb-schedule-time-error">끝나는 시간은 시작 시간보다 늦어야 해요.</small>}
      </div>
      <div className="mb-schedule-field">
        <div className="mb-schedule-notify-row">
          <span>매주 반복</span>
          <label className="mb-schedule-switch">
            <input type="checkbox" role="switch" checked={draft.repeatWeekly} aria-checked={draft.repeatWeekly} onChange={event => toggleRepeat(event.target.checked)} />
            <span aria-hidden="true"><i /></span>
            <b className="mb-sr-only">매주 반복</b>
          </label>
        </div>
        {draft.repeatWeekly && <>
          <div className="mb-schedule-days" role="group" aria-label="반복 요일">
            {WEEKDAYS.map(day => <button key={day.value} type="button" aria-pressed={draft.days.includes(day.value)}
              onClick={() => set({ days: draft.days.includes(day.value) ? draft.days.filter(value => value !== day.value) : [...draft.days, day.value] })}>{day.label}</button>)}
          </div>
          <small>{dateLabel(draft.date)}부터 고른 요일마다 반복돼요.</small>
        </>}
      </div>
      <div className="mb-schedule-field"><span>문제지 연결</span>
        <PaperPicker userId={userId} value={draft.paper} onChange={paper => set({ paper })} />
        <small>알림을 누르면 이 문제지 풀이로 바로 이동해요.</small>
      </div>
      <div className="mb-schedule-field">
        <div className="mb-schedule-notify-row">
          <span>알림</span>
          <label className="mb-schedule-switch">
            <input type="checkbox" role="switch" checked={draft.notify} aria-checked={draft.notify} onChange={event => set({ notify: event.target.checked })} />
            <span aria-hidden="true"><i /></span>
            <b className="mb-sr-only">알림 받기</b>
          </label>
        </div>
        {draft.notify && <div className="mb-schedule-chips" role="group" aria-label="알림 시점">
          {NOTIFY_OPTIONS.map(option => <button key={option.value} type="button" aria-pressed={draft.notifyBefore === option.value} onClick={() => set({ notifyBefore: option.value })}>{option.label}</button>)}
        </div>}
      </div>
      <label className="mb-schedule-field"><span>메모</span>
        <textarea rows={2} value={draft.memo} maxLength={MEMO_LIMIT} placeholder="이번 시간에 할 일을 적어두세요" onChange={event => set({ memo: event.target.value })} />
      </label>
      <fieldset className="mb-schedule-field">
        <legend>색상</legend>
        <div className="mb-schedule-colors">
          {SCHEDULE_COLORS.map(color => <button key={color} type="button" className={`is-${color}`} aria-pressed={draft.color === color} aria-label={SCHEDULE_COLOR_LABELS[color]} onClick={() => set({ color })}>
            {draft.color === color && <Check size={16} strokeWidth={3} aria-hidden="true" />}
          </button>)}
        </div>
      </fieldset>
      {draft.id && <div className="mb-schedule-field"><span>내 캘린더에 저장</span>
        <div className="mb-schedule-calendar-actions">
          <a href={calendarFileUrl(draft)}><CalendarPlus size={16} aria-hidden="true" />iPhone·기본 캘린더</a>
          <a href={googleCalendarUrl(draft)} target="_blank" rel="noopener noreferrer"><CalendarPlus size={16} aria-hidden="true" />Google 캘린더</a>
        </div>
        <small>{draft.repeatWeekly ? '반복 요일과' : '날짜와'} 미리 알림이 함께 저장돼요. 문블에서 일정을 바꾸면 다시 저장해주세요.</small>
      </div>}
      {error && <p className="mb-schedule-error" role="alert">{error}</p>}
      <footer>
        {draft.id && <button type="button" className={`mb-schedule-delete${confirmDelete ? ' is-confirming' : ''}`} disabled={busy} onClick={remove}>{confirmDelete ? '정말 삭제' : '삭제'}</button>}
        <button type="button" disabled={busy} onClick={onClose}>취소</button>
        <button type="submit" className="is-primary" disabled={busy}>{busy ? '저장 중' : '저장'}</button>
      </footer>
    </form>
  </div>, document.body);
}

const viewKey = userId => `moonble:user:${userId}:schedule-view`;
function readView(userId) {
  try { return localStorage.getItem(viewKey(userId)) === 'month' ? 'month' : 'week'; } catch { return 'week'; }
}

export function SchedulePage({ user, tabs = null }) {
  const userId = user.id;
  const desktop = useMediaQuery('(min-width: 768px)');
  const [view, setView] = useState(() => readView(userId));
  // 보고 있는 날: 주 보기는 이 날이 있는 주, 월 보기는 이 날이 있는 달 + 고른 날. 새 일정도 이 날로 연다.
  const [focus, setFocus] = useState(() => toDateKey(new Date()));
  const focusDate = fromDateKey(focus);
  const week = useMemo(() => weekDates(fromDateKey(focus)), [focus]);
  const month = new Date(focusDate.getFullYear(), focusDate.getMonth(), 1);
  const [state, setState] = useState({ status: 'loading', items: [], server: false, error: '' });
  const [editor, setEditor] = useState(null);
  const swipeRef = useRef(null);

  function changeView(next) {
    setView(next);
    try { localStorage.setItem(viewKey(userId), next); } catch { /* 다음에는 주 보기로 연다. */ }
  }
  // 주 보기는 7일씩, 월 보기는 한 달씩(이번 달이면 오늘, 아니면 1일을 고른다).
  function move(step) {
    if (view === 'week') { setFocus(toDateKey(addDays(focusDate, step * 7))); return; }
    const first = new Date(focusDate.getFullYear(), focusDate.getMonth() + step, 1);
    const today = new Date();
    setFocus(toDateKey(first.getFullYear() === today.getFullYear() && first.getMonth() === today.getMonth() ? today : first));
  }
  // 모바일: 표·달력을 옆으로 밀어도 주·달이 넘어간다.
  const swipe = {
    onTouchStart: event => { const touch = event.touches[0]; swipeRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null; },
    onTouchEnd: event => {
      const start = swipeRef.current;
      const touch = event.changedTouches[0];
      swipeRef.current = null;
      if (!start || !touch) return;
      const dx = touch.clientX - start.x;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(touch.clientY - start.y) * 1.5) move(dx < 0 ? 1 : -1);
    },
  };
  // 날짜 기능 전에 만든 매주 일정은 이번 주 월요일을 시작 날짜로 보여준다.
  const edit = schedule => setEditor(schedule.date ? schedule : { ...schedule, date: toDateKey(weekDates(new Date())[0].date) });

  async function load(fresh = true) {
    try {
      const result = await listSchedules(userId, { fresh });
      setState({ status: 'ready', items: result.items, server: result.server, error: '' });
    } catch (loadError) {
      setState(current => ({ ...current, status: 'error', error: loadError.message }));
    }
  }
  useEffect(() => { load(true); }, [userId]);

  async function save(schedule) {
    const saved = await saveSchedule(userId, schedule);
    setState(current => ({ ...current, items: [...current.items.filter(item => item.id !== saved.id), saved] }));
    setEditor(null);
  }
  async function remove(scheduleId) {
    await deleteSchedule(userId, scheduleId);
    setState(current => ({ ...current, items: current.items.filter(item => item.id !== scheduleId) }));
    setEditor(null);
  }

  return <main className="prd-list-page min-h-screen bg-white no-print">
    <div className="prd-list-shell mb-page-gutter mb-schedule-page">
      {tabs}
      <div className="mb-schedule-title">
        <h1 className="mb-page-title">시간표 설정</h1>
        <FlowActionButton size="compact" onClick={() => setEditor(emptyDraft(focusDate))}><Plus size={14} aria-hidden="true" />일정 추가</FlowActionButton>
      </div>
      <NotificationStatus userId={userId} />
      {state.status === 'loading' && <p className="mb-schedule-muted" role="status">시간표를 불러오고 있어요.</p>}
      {state.status === 'error' && <div className="mb-schedule-empty" role="alert"><strong>시간표를 불러오지 못했어요</strong><p>{state.error}</p><button type="button" onClick={() => load(true)}>다시 시도</button></div>}
      {state.status === 'ready' && <>
        <CalendarToolbar view={view} label={view === 'week' ? weekRangeLabel(week, { short: !desktop }) : monthLabel(month)} onMove={move} onToday={() => setFocus(toDateKey(new Date()))} onView={changeView} />
        {view === 'week' && !state.items.length && <p className="mb-schedule-hint">빈 칸을 누르면 그 날짜·시간으로 일정을 추가할 수 있어요.</p>}
        {view === 'week'
          ? <div className="mb-calendar-swipe" {...swipe}><WeekGrid week={week} items={state.items} compact={!desktop} onEdit={edit} onAddAt={(date, minutes) => setEditor(emptyDraft(date, minutes))} /></div>
          : <div className="mb-month-layout">
            <div className="mb-calendar-swipe" {...swipe}><MonthView month={month} items={state.items} selected={focus} compact={!desktop} onSelect={setFocus} /></div>
            <DayAgenda dateKey={focus} items={state.items} onEdit={edit} />
          </div>}
      </>}
      {state.status === 'ready' && !state.server && <p className="mb-schedule-muted">지금은 이 기기에 저장돼요. 서버 준비가 끝나면 자동으로 옮겨져 다른 기기에서도 보여요.</p>}
      {editor && <ScheduleEditor userId={userId} initial={editor} onSave={save} onDelete={remove} onClose={() => setEditor(null)} />}
    </div>
  </main>;
}
