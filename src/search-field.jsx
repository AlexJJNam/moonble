// 검색창 공통 컴포넌트: PC는 입력 아래 제안 목록, 모바일은 누르면 전체 화면 검색(최근 검색어 · 자동완성).
import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { ChevronLeft, Clock, Search, X } from 'lucide-react';
import { lockPageScroll } from './scroll-lock.js';
import './search-field.css';

const QUERY_LIMIT = 50;
const RECENT_LIMIT = 8;
const HISTORY_KEY = 'moonbleSearchScreen';
const MOBILE_QUERY = '(max-width: 767px)';

function readRecent(key) {
  if (!key) return [];
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value.filter(item => typeof item === 'string' && item.trim()).slice(0, RECENT_LIMIT) : [];
  } catch { return []; }
}
function writeRecent(key, list) {
  if (!key) return;
  try { localStorage.setItem(key, JSON.stringify(list)); } catch { /* 저장이 막혀도 검색은 된다. */ }
}

export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [query]);
  return matches;
}

// suggest(term)는 문자열 배열이나 그 Promise를 돌려준다. 아직 받기 전이면 null.
function useSuggestions(term, suggest) {
  const value = term.trim();
  const suggestRef = useRef(suggest);
  suggestRef.current = suggest;
  const [state, setState] = useState({ term: '', items: [] });
  useEffect(() => {
    if (!value || !suggestRef.current) return undefined;
    let alive = true;
    const run = () => Promise.resolve(suggestRef.current(value))
      .then(items => { if (alive) setState({ term: value, items: Array.isArray(items) ? items : [] }); })
      .catch(() => { if (alive) setState({ term: value, items: [] }); });
    const timer = window.setTimeout(run, 150);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [value]);
  if (!value) return [];
  return state.term === value ? state.items : null;
}

function Highlight({ text, term }) {
  const index = term ? text.toLocaleLowerCase().indexOf(term.toLocaleLowerCase()) : -1;
  if (index < 0) return <span>{text}</span>;
  return <span>{text.slice(0, index)}<mark>{text.slice(index, index + term.length)}</mark>{text.slice(index + term.length)}</span>;
}

// 검색어가 없으면 최근 검색어, 있으면 자동완성 제안.
function SearchSuggestions({ draft, recent, suggest, onPick, onRemoveRecent, onClearRecent }) {
  const term = draft.trim();
  const suggestions = useSuggestions(draft, suggest);
  if (!term) {
    if (!recent.length) return <p className="mb-search-empty">최근 검색어가 없어요.</p>;
    return <section aria-label="최근 검색어">
      <div className="mb-search-section-head"><h3>최근 검색어</h3><button type="button" onClick={onClearRecent}>전체 삭제</button></div>
      <ul className="mb-search-list">{recent.map(item => <li key={item}>
        <button type="button" className="mb-search-option" onClick={() => onPick(item)}><Clock size={18} aria-hidden="true" /><span>{item}</span></button>
        <button type="button" className="mb-search-remove" aria-label={`최근 검색어 ${item} 삭제`} onClick={() => onRemoveRecent(item)}><X size={16} aria-hidden="true" /></button>
      </li>)}</ul>
    </section>;
  }
  const items = (suggestions || []).filter(item => item !== term);
  return <ul className="mb-search-list" aria-label="검색어 제안">
    <li><button type="button" className="mb-search-option" onClick={() => onPick(term)}><Search size={18} aria-hidden="true" /><span><mark>{term}</mark> 검색</span></button></li>
    {items.map(item => <li key={item}><button type="button" className="mb-search-option" onClick={() => onPick(item)}><Search size={18} aria-hidden="true" /><Highlight text={item} term={term} /></button></li>)}
  </ul>;
}

function SearchInput({ inputRef, label, placeholder, value, onChange, onClear, ...props }) {
  return <label className="mb-search-field"><Search size={18} aria-hidden="true" /><span className="mb-sr-only">{label}</span>
    <input ref={inputRef} type="search" enterKeyHint="search" autoComplete="off" value={value} maxLength={QUERY_LIMIT} placeholder={placeholder} onChange={event => onChange(event.target.value)} {...props} />
    {value && <button type="button" className="mb-search-clear" aria-label="검색어 지우기" onMouseDown={event => event.preventDefault()} onClick={onClear}><X size={14} aria-hidden="true" /></button>}
  </label>;
}

// 모바일 전체 화면 검색. 뒤로가기 버튼·기기 뒤로가기·Esc로 닫힌다.
function SearchScreen({ inputRef, label, placeholder, initial, recent, suggest, extra, onSubmit, onClose, onRemoveRecent, onClearRecent }) {
  const screenRef = useRef(null);
  const [draft, setDraft] = useState(initial);
  const closedRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const finish = useCallback(after => {
    if (closedRef.current) return;
    closedRef.current = true;
    if (window.history.state?.[HISTORY_KEY]) window.history.back();
    after();
  }, []);
  useEffect(() => {
    const unlock = lockPageScroll();
    if (document.activeElement !== inputRef.current) inputRef.current?.focus({ preventScroll: true });
    window.history.pushState({ ...(window.history.state || {}), [HISTORY_KEY]: true }, '', window.location.href);
    const onPop = () => { if (!closedRef.current) { closedRef.current = true; onCloseRef.current(); } };
    const onKey = event => { if (event.key === 'Escape') { event.preventDefault(); finish(() => onCloseRef.current()); } };
    // 페이지를 떠났다 돌아왔을 때(bfcache) 검색 기록이 남지 않게 한다.
    const onPageHide = () => {
      if (!window.history.state?.[HISTORY_KEY]) return;
      const state = { ...window.history.state };
      delete state[HISTORY_KEY];
      window.history.replaceState(state, '', window.location.href);
    };
    window.addEventListener('popstate', onPop);
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('keydown', onKey);
    return () => { unlock(); window.removeEventListener('popstate', onPop); window.removeEventListener('pagehide', onPageHide); document.removeEventListener('keydown', onKey); };
  }, [finish, inputRef]);
  // 키보드가 올라오면 화면 높이를 보이는 영역에 맞춰 아래쪽 조회 조건이 가려지지 않게 한다.
  useEffect(() => {
    const viewport = window.visualViewport;
    const screen = screenRef.current;
    if (!viewport || !screen) return undefined;
    const fit = () => {
      screen.style.height = `${Math.round(viewport.height)}px`;
      screen.style.top = `${Math.max(0, Math.round(viewport.offsetTop))}px`;
    };
    fit();
    viewport.addEventListener('resize', fit);
    viewport.addEventListener('scroll', fit);
    return () => { viewport.removeEventListener('resize', fit); viewport.removeEventListener('scroll', fit); };
  }, []);
  const submit = term => finish(() => onSubmit(term));
  return createPortal(<div ref={screenRef} className="mb-search-screen" role="dialog" aria-modal="true" aria-label={label}>
    <form className="mb-search-screen-head" role="search" onSubmit={event => { event.preventDefault(); submit(draft); }}>
      <button type="button" className="mb-search-back" aria-label="검색 닫기" onClick={() => finish(() => onCloseRef.current())}><ChevronLeft size={22} aria-hidden="true" /></button>
      <SearchInput inputRef={inputRef} label={label} placeholder={placeholder} value={draft} onChange={setDraft} onClear={() => { setDraft(''); inputRef.current?.focus(); }} />
    </form>
    {extra && <div className="mb-search-screen-filter"
      // 조회 조건을 눌러도 입력창 포커스를 지켜 자판이 내려가지 않게 한다(눌린 버튼이 포커스를 가져가지 않게 하고, 빠졌으면 같은 탭 안에서 다시 포커스).
      onMouseDown={event => event.preventDefault()}
      onClick={() => { if (document.activeElement !== inputRef.current) inputRef.current?.focus({ preventScroll: true }); }}>{extra}</div>}
    <div className="mb-search-screen-body">
      <SearchSuggestions draft={draft} recent={recent} suggest={suggest} onPick={submit} onRemoveRecent={onRemoveRecent} onClearRecent={onClearRecent} />
    </div>
  </div>, document.body);
}

// tags: 검색창 안 검색어 앞에 보이는 조회 조건 [{ key, label, onRemove }]. screenExtra: 모바일 검색 화면 입력창 바로 아래 조회 조건(예: 카테고리).
export function SearchField({ label, placeholder, value, onSearch, suggest, recentKey, className = '', tags = [], screenExtra = null }) {
  const mobile = useMediaQuery(MOBILE_QUERY);
  const [draft, setDraft] = useState(value);
  const [recent, setRecent] = useState(() => readRecent(recentKey));
  const [screenOpen, setScreenOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const inputRef = useRef(null);
  const screenInputRef = useRef(null);
  const triggerRef = useRef(null);
  const dropdownId = useId();
  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => { if (!mobile) setScreenOpen(false); else setDropdownOpen(false); }, [mobile]);

  function saveRecent(next) { setRecent(next); writeRecent(recentKey, next); }
  function apply(term) {
    const next = term.trim().slice(0, QUERY_LIMIT);
    setDraft(next);
    setDropdownOpen(false);
    onSearch(next);
    if (next) saveRecent([next, ...recent.filter(item => item !== next)].slice(0, RECENT_LIMIT));
  }
  const removeRecent = item => saveRecent(recent.filter(old => old !== item));
  const clearRecent = () => saveRecent([]);
  const refocusTrigger = () => requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
  function openScreen() {
    // iOS는 누른 순간 안에서 입력창에 포커스해야 키보드가 올라온다.
    flushSync(() => setScreenOpen(true));
    screenInputRef.current?.focus({ preventScroll: true });
  }

  if (mobile) {
    return <div className={`mb-search-box ${className}`}>
      <div className={`mb-search-field mb-search-trigger-field${value ? ' has-value' : ''}`}>
        <Search size={18} aria-hidden="true" />
        {tags.map(tag => <span key={tag.key} className="mb-search-tag"><span>{tag.label}</span><button type="button" aria-label={`${tag.label} 조건 지우기`} onClick={tag.onRemove}><X size={12} aria-hidden="true" /></button></span>)}
        <button ref={triggerRef} type="button" className="mb-search-trigger" aria-label={value ? `${label}: ${value}` : label} onClick={openScreen}><span>{value || (tags.length ? '' : placeholder)}</span></button>
        {value && <button type="button" className="mb-search-clear" aria-label="검색어 지우기" onClick={() => onSearch('')}><X size={14} aria-hidden="true" /></button>}
      </div>
      {screenOpen && <SearchScreen inputRef={screenInputRef} label={label} placeholder={placeholder} initial={value} recent={recent} suggest={suggest} extra={screenExtra}
        onRemoveRecent={removeRecent} onClearRecent={clearRecent}
        onSubmit={term => { apply(term); setScreenOpen(false); refocusTrigger(); }}
        onClose={() => { setScreenOpen(false); refocusTrigger(); }} />}
    </div>;
  }
  return <div className={`mb-search-box ${className}`} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setDropdownOpen(false); }}>
    <form role="search" onSubmit={event => { event.preventDefault(); apply(draft); inputRef.current?.blur(); }}>
      <SearchInput inputRef={inputRef} label={label} placeholder={placeholder} value={draft} aria-expanded={dropdownOpen} aria-controls={dropdownId}
        onChange={next => { setDraft(next); setDropdownOpen(true); if (!next.trim() && value) onSearch(''); }}
        onClear={() => { setDraft(''); if (value) onSearch(''); setDropdownOpen(true); inputRef.current?.focus(); }}
        onFocus={() => setDropdownOpen(true)} onKeyDown={event => { if (event.key === 'Escape') setDropdownOpen(false); }} />
    </form>
    {dropdownOpen && (draft.trim() || recent.length > 0) && <div id={dropdownId} className="mb-search-dropdown" onMouseDown={event => event.preventDefault()}>
      <SearchSuggestions draft={draft} recent={recent} suggest={suggest} onPick={term => { apply(term); inputRef.current?.blur(); }} onRemoveRecent={removeRecent} onClearRecent={clearRecent} />
    </div>}
  </div>;
}
