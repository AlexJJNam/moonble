// 워크스페이스 일지·회고: 일간 일지(기본) · 주간 회고 · 월간 회고와 기록 목록·검색.
// Day One처럼 날짜를 오가며 문서처럼 쓰고(PC는 오른쪽에 달력·목록), Grid Diary처럼 질문에 답하며 돌아본다.
// 주소: #/journal(오늘) · #/journal/daily/YYYY-MM-DD · #/journal/weekly/월요일 · #/journal/monthly/YYYY-MM · #/journal/list
import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useMediaQuery } from '../search-field.jsx';
import { listEntries, listTags, searchEntries } from './journal-api.js';
import {
  JOURNAL_KINDS, MOODS, addDays, dayLabel, hasContent, isDateKey, monthEnd, monthLabel, monthStart, moodOf,
  periodEnd, periodLabel, periodStart, previewText, seoulDateKey, stepPeriod, weekdayLabel,
} from './journal-model.js';
import { EntryEditor } from './journal-editor.jsx';
import { EntryPreview, JournalCalendar, Sheet } from './journal-ui.jsx';
import './journal.css';

function parseRoute(path, today) {
  const [, , view = 'daily', raw = ''] = path.split('?')[0].split('/');
  if (view === 'list') return { view: 'list' };
  const kind = JOURNAL_KINDS.some(item => item.value === view) ? view : 'daily';
  let key = kind === 'monthly' && /^\d{4}-\d{2}$/.test(raw) ? `${raw}-01` : raw;
  if (!isDateKey(key)) key = today;
  return { view: kind, start: periodStart(kind, key) };
}
export function journalHref(kind, start) {
  return kind === 'monthly' ? `#/journal/monthly/${start.slice(0, 7)}` : `#/journal/${kind}/${start}`;
}
const go = href => { window.location.hash = href.slice(1); };
// 종류를 바꿀 때 보고 있던 기간 안의 날짜(오늘이 그 안에 있으면 오늘)를 이어 받는다.
function focusDate(kind, start, today) {
  return today >= start && today <= periodEnd(kind, start) ? today : start;
}

// 기간 안 기록(달력 점·목록·주간/월간 참고용). 저장·삭제하면 바로 반영한다.
function useRangeEntries(from, to) {
  const [state, setState] = useState({ items: [], status: 'loading' });
  useEffect(() => {
    let alive = true;
    setState(current => ({ ...current, status: 'loading' }));
    listEntries({ from, to }).then(items => { if (alive) setState({ items, status: 'ready' }); }).catch(() => { if (alive) setState({ items: [], status: 'error' }); });
    return () => { alive = false; };
  }, [from, to]);
  const upsert = entry => setState(current => ({ ...current, items: [entry, ...current.items.filter(item => !(item.kind === entry.kind && item.periodStart === entry.periodStart))] }));
  const remove = (kind, start) => setState(current => ({ ...current, items: current.items.filter(item => !(item.kind === kind && item.periodStart === start)) }));
  return { ...state, upsert, remove };
}

function EntryRow({ entry, href, today, expandable = false }) {
  const [open, setOpen] = useState(false);
  const mood = moodOf(entry.mood);
  const preview = previewText(entry);
  const kind = JOURNAL_KINDS.find(item => item.value === entry.kind);
  const dateBlock = entry.kind === 'daily'
    ? <span className="jr-row-date"><b>{Number(entry.periodStart.slice(8))}</b><small>{entry.periodStart.slice(0, 4) !== today.slice(0, 4) ? `${entry.periodStart.slice(2, 4)}.${Number(entry.periodStart.slice(5, 7))}월` : `${Number(entry.periodStart.slice(5, 7))}월`} {weekdayLabel(entry.periodStart)}</small></span>
    : <span className="jr-row-date is-period"><small>{kind.short}</small></span>;
  const copy = <span className="jr-row-copy">
    <strong>{entry.title || (entry.kind === 'daily' ? dayLabel(entry.periodStart, today) : periodLabel(entry.kind, entry.periodStart, { today }))}</strong>
    {preview && <small>{preview}</small>}
    {entry.tags.length > 0 && <span className="jr-row-tags">{entry.tags.slice(0, 4).map(tag => <i key={tag}>#{tag}</i>)}</span>}
  </span>;
  if (!expandable) return <li><a className="jr-row" href={href}>{dateBlock}{copy}{mood && <span className="jr-row-mood" aria-label={mood.label}>{mood.emoji}</span>}</a></li>;
  return <li className={open ? 'is-open' : ''}>
    <button type="button" className="jr-row" aria-expanded={open} onClick={() => setOpen(value => !value)}>{dateBlock}{copy}{mood && <span className="jr-row-mood" aria-label={mood.label}>{mood.emoji}</span>}</button>
    {open && <div className="jr-row-preview"><EntryPreview entry={entry} /><a href={href}>{entry.kind === 'daily' ? '이 일지 열기' : '이 회고 열기'}</a></div>}
  </li>;
}

function MoodSummary({ entries }) {
  const daily = entries.filter(entry => entry.kind === 'daily' && hasContent(entry));
  const counts = MOODS.map(mood => ({ ...mood, count: daily.filter(entry => entry.mood === mood.value).length }));
  const none = daily.filter(entry => !entry.mood).length;
  return <div className="jr-summary">
    <p><b>{daily.length}</b>일 일지를 썼어요</p>
    {daily.length > 0 && <ul className="jr-mood-counts" aria-label="이번 달 기분">
      {counts.map(mood => <li key={mood.value} className={mood.count ? '' : 'is-zero'}><span aria-hidden="true">{mood.emoji}</span><small>{mood.label}</small><b>{mood.count}</b></li>)}
    </ul>}
    {none > 0 && <small className="jr-muted">기분을 고르지 않은 날 {none}일</small>}
  </div>;
}

// 참고 기록(주간·월간 회고를 쓸 때 이 기간의 일지·회고)
function ReferencePanel({ kind, start, range, today, compact, calendarMonth, onCalendarMonth }) {
  const end = periodEnd(kind, start);
  const written = range.items.filter(hasContent);
  const daily = written.filter(entry => entry.kind === 'daily' && entry.periodStart >= start && entry.periodStart <= end);
  const marks = useMemo(() => new Map(written.filter(entry => entry.kind === 'daily').map(entry => [entry.periodStart, { mood: entry.mood }])), [range.items]);
  const [open, setOpen] = useState(!compact);
  useEffect(() => { setOpen(!compact); }, [compact]);
  if (kind === 'daily') {
    const monthDaily = written.filter(entry => entry.kind === 'daily' && entry.periodStart.slice(0, 7) === calendarMonth.slice(0, 7));
    return <aside className="jr-aside" aria-label="일지 달력과 목록">
      <JournalCalendar month={calendarMonth} marks={marks} selected={start} today={today} onSelect={key => go(journalHref('daily', key))} onMonth={step => onCalendarMonth(step)} />
      <section className="jr-aside-section">
        <h3>{monthLabel(calendarMonth)} 일지</h3>
        {range.status === 'loading' ? <p className="jr-muted">불러오는 중…</p>
          : monthDaily.length
            ? <ul className="jr-rows is-compact">{monthDaily.map(entry => <EntryRow key={entry.periodStart} entry={entry} href={journalHref('daily', entry.periodStart)} today={today} />)}</ul>
            : <p className="jr-muted">이 달에 쓴 일지가 없어요.</p>}
      </section>
    </aside>;
  }
  const weekly = written.filter(entry => entry.kind === 'weekly' && entry.periodStart <= end && addDays(entry.periodStart, 6) >= start);
  const body = <>
    {kind === 'monthly' && <MoodSummary entries={daily} />}
    {kind === 'monthly' && <JournalCalendar month={start} marks={marks} selected="" today={today} onSelect={key => go(journalHref('daily', key))} onMonth={step => go(journalHref('monthly', stepPeriod('monthly', start, step)))} label="이번 달 일지 달력" />}
    {kind === 'monthly' && <section className="jr-aside-section">
      <h3>이번 달 주간 회고</h3>
      {weekly.length ? <ul className="jr-rows is-compact">{weekly.map(entry => <EntryRow key={entry.periodStart} entry={entry} href={journalHref('weekly', entry.periodStart)} today={today} expandable />)}</ul> : <p className="jr-muted">이 달에 쓴 주간 회고가 없어요.</p>}
    </section>}
    <section className="jr-aside-section">
      <h3>{kind === 'weekly' ? '이번 주 일지' : '이번 달 일지'} {daily.length > 0 && <small>{daily.length}</small>}</h3>
      {range.status === 'loading' ? <p className="jr-muted">불러오는 중…</p>
        : daily.length ? <ul className="jr-rows is-compact">{daily.map(entry => <EntryRow key={entry.periodStart} entry={entry} href={journalHref('daily', entry.periodStart)} today={today} expandable />)}</ul>
          : <p className="jr-muted">{kind === 'weekly' ? '이번 주에 쓴 일지가 없어요.' : '이번 달에 쓴 일지가 없어요.'}</p>}
    </section>
  </>;
  if (!compact) return <aside className="jr-aside" aria-label="참고 기록">{body}</aside>;
  return <section className="jr-reference">
    <button type="button" className="jr-reference-toggle" aria-expanded={open} onClick={() => setOpen(value => !value)}>
      <span>{kind === 'weekly' ? `이번 주 일지 ${daily.length}개 보며 쓰기` : `이번 달 기록 보기 · 일지 ${daily.length}일`}</span><ChevronDown size={18} aria-hidden="true" />
    </button>
    {open && <div className="jr-reference-body">{body}</div>}
  </section>;
}

// 기록 목록·검색: 제목·본문·질문 답변·태그를 찾고 종류·태그·기간으로 거른다.
const RANGE_OPTIONS = [['all', '전체 기간'], ['7', '최근 7일'], ['30', '최근 30일'], ['year', '올해']];
function JournalList({ today }) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('');
  const [tag, setTag] = useState('');
  const [range, setRange] = useState('all');
  const [tags, setTags] = useState([]);
  const [limit, setLimit] = useState(60);
  const [state, setState] = useState({ status: 'loading', items: [], more: false, error: '' });
  useEffect(() => { listTags().then(setTags).catch(() => setTags([])); }, []);
  useEffect(() => { setLimit(60); }, [query, kind, tag, range]);
  useEffect(() => {
    let alive = true;
    const from = range === '7' ? addDays(today, -6) : range === '30' ? addDays(today, -29) : range === 'year' ? `${today.slice(0, 4)}-01-01` : '';
    const timer = window.setTimeout(() => {
      searchEntries({ query, kind, tag, from, limit })
        .then(result => { if (alive) setState({ status: 'ready', items: result.items.filter(hasContent), more: result.more, error: '' }); })
        .catch(error => { if (alive) setState({ status: 'error', items: [], more: false, error: error.message }); });
    }, query ? 250 : 0);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [query, kind, tag, range, limit]);
  const filtered = Boolean(query.trim() || kind || tag || range !== 'all');
  return <section className="jr-list" aria-label="일지 목록과 검색">
    <a className="jr-back" href={journalHref('daily', today)}><ChevronLeft size={18} aria-hidden="true" />일지로 돌아가기</a>
    <label className="jr-search"><Search size={16} aria-hidden="true" /><span className="mb-sr-only">일지 검색</span>
      <input type="search" value={query} maxLength={50} placeholder="제목·내용·태그로 찾기" onChange={event => setQuery(event.target.value)} />
    </label>
    <div className="jr-filters">
      <div className="jr-chips" role="group" aria-label="기록 종류">
        {[['', '전체'], ['daily', '일간'], ['weekly', '주간'], ['monthly', '월간']].map(([value, label]) => <button key={value || 'all'} type="button" aria-pressed={kind === value} onClick={() => setKind(value)}>{label}</button>)}
      </div>
      <div className="jr-chips" role="group" aria-label="기간">
        {RANGE_OPTIONS.map(([value, label]) => <button key={value} type="button" aria-pressed={range === value} onClick={() => setRange(value)}>{label}</button>)}
      </div>
      {tags.length > 0 && <div className="jr-chips is-tags" role="group" aria-label="태그">
        {tags.slice(0, 20).map(value => <button key={value} type="button" aria-pressed={tag === value} onClick={() => setTag(current => current === value ? '' : value)}>#{value}</button>)}
      </div>}
    </div>
    {state.status === 'loading' && <p className="jr-muted" role="status">기록을 찾고 있어요.</p>}
    {state.status === 'error' && <p className="jr-inline-error" role="alert">{state.error}</p>}
    {state.status === 'ready' && (state.items.length
      ? <>
        <ul className="jr-rows">{state.items.map(entry => <EntryRow key={`${entry.kind}:${entry.periodStart}`} entry={entry} href={journalHref(entry.kind, entry.periodStart)} today={today} />)}</ul>
        {state.more && <button type="button" className="jr-more" onClick={() => setLimit(value => value + 60)}>더 보기</button>}
      </>
      : <p className="jr-empty">{filtered ? '조건에 맞는 기록이 없어요. 다른 말이나 조건으로 찾아보세요.' : '아직 쓴 일지가 없어요. 오늘 일지부터 써 보세요.'}</p>)}
  </section>;
}

export function JournalPage({ user, path, tabs = null }) {
  const userId = user.id;
  const today = seoulDateKey();
  const route = parseRoute(path, today);
  const wide = useMediaQuery('(min-width: 1024px)');
  const mobile = useMediaQuery('(max-width: 767px)');
  const [tagSuggestions, setTagSuggestions] = useState([]);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const kind = route.view === 'list' ? 'daily' : route.view;
  const start = route.view === 'list' ? today : route.start;
  // 일간 달력은 고른 날의 달을 보여주되, 달만 넘겨 볼 수도 있다.
  const [calendarMonth, setCalendarMonth] = useState(monthStart(start));
  useEffect(() => { setCalendarMonth(monthStart(start)); }, [start]);
  const from = kind === 'daily' ? calendarMonth : kind === 'weekly' ? start : addDays(start, -6);
  const to = kind === 'daily' ? monthEnd(calendarMonth) : periodEnd(kind, start);
  const range = useRangeEntries(from, to);
  useEffect(() => { listTags().then(setTagSuggestions).catch(() => setTagSuggestions([])); }, []);
  useEffect(() => { setCalendarOpen(false); }, [path]);

  const switchKind = next => go(journalHref(next, periodStart(next, focusDate(kind, start, today))));
  const label = periodLabel(kind, start, { short: mobile, today });
  const isCurrent = today >= start && today <= periodEnd(kind, start);
  return <main className="prd-list-page min-h-screen bg-white no-print">
    <div className="prd-list-shell mb-page-gutter jr-page">
      {tabs}
      <div className="jr-head">
        <h1 className="mb-page-title">일지·회고</h1>
        {route.view !== 'list' && <a className="jr-head-link" href="#/journal/list"><Search size={16} aria-hidden="true" />목록·검색</a>}
      </div>
      {route.view === 'list' ? <JournalList today={today} /> : <>
        <div className="jr-kinds" role="group" aria-label="일지 종류">
          {JOURNAL_KINDS.map(item => <button key={item.value} type="button" aria-pressed={kind === item.value} onClick={() => switchKind(item.value)}>{item.label}</button>)}
        </div>
        <div className="jr-nav">
          <div className="jr-nav-period">
            <a href={journalHref(kind, stepPeriod(kind, start, -1))} aria-label={kind === 'daily' ? '이전 날' : kind === 'weekly' ? '이전 주' : '이전 달'}><ChevronLeft size={20} aria-hidden="true" /></a>
            <strong aria-live="polite">{label}</strong>
            <a href={journalHref(kind, stepPeriod(kind, start, 1))} aria-label={kind === 'daily' ? '다음 날' : kind === 'weekly' ? '다음 주' : '다음 달'}><ChevronRight size={20} aria-hidden="true" /></a>
          </div>
          {!isCurrent && <a className="jr-today" href={journalHref(kind, periodStart(kind, today))}>{kind === 'daily' ? '오늘' : kind === 'weekly' ? '이번 주' : '이번 달'}</a>}
          {kind === 'daily' && !wide && <button type="button" className="jr-icon-button" aria-label="달력에서 날짜 고르기" onClick={() => setCalendarOpen(true)}><CalendarDays size={20} aria-hidden="true" /></button>}
        </div>
        <div className={`jr-layout${wide ? ' is-wide' : ''}`}>
          {!wide && kind !== 'daily' && <ReferencePanel kind={kind} start={start} range={range} today={today} compact calendarMonth={calendarMonth} onCalendarMonth={step => setCalendarMonth(current => stepPeriod('monthly', current, step))} />}
          <EntryEditor key={`${kind}:${start}`} userId={userId} kind={kind} start={start} tagSuggestions={tagSuggestions}
            onSaved={entry => { range.upsert(entry); entry.tags.forEach(tag => setTagSuggestions(current => current.includes(tag) ? current : [tag, ...current])); }}
            onDeleted={(deletedKind, deletedStart) => range.remove(deletedKind, deletedStart)} />
          {wide && <ReferencePanel kind={kind} start={start} range={range} today={today} compact={false} calendarMonth={calendarMonth} onCalendarMonth={step => setCalendarMonth(current => stepPeriod('monthly', current, step))} />}
        </div>
      </>}
      {calendarOpen && <Sheet title="날짜 고르기" onClose={() => setCalendarOpen(false)}>
        <JournalCalendar month={calendarMonth} marks={new Map(range.items.filter(entry => entry.kind === 'daily' && hasContent(entry)).map(entry => [entry.periodStart, { mood: entry.mood }]))}
          selected={start} today={today} onSelect={key => { setCalendarOpen(false); go(journalHref('daily', key)); }}
          onMonth={step => setCalendarMonth(current => stepPeriod('monthly', current, step))} />
        <p className="jr-muted jr-calendar-hint">점이 있는 날은 일지를 쓴 날이에요. 지난 날짜도 골라서 쓸 수 있어요.</p>
      </Sheet>}
    </div>
  </main>;
}
