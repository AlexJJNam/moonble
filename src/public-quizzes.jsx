// 문제 서칭: 공개로 올린 문제지를 검색해서 풀어보는 탭.
import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, Clock, Search, X } from 'lucide-react';
import { PaperPreview } from './paper-preview.jsx';
import { CommunitySortToggle } from './quiz-community.jsx';
import { listPublicQuizzes, PUBLIC_PAGE_SIZE, suggestPublicQuizTitles } from './public-quizzes-api.js';
import { lockPageScroll } from './scroll-lock.js';

const PLACEHOLDER = '제목이나 설명으로 찾아보세요';
const QUERY_LIMIT = 50;
const RECENT_KEY = 'moonble:public-search-recent';
const RECENT_LIMIT = 8;
const HISTORY_KEY = 'moonblePublicSearch';
const MOBILE_QUERY = '(max-width: 767px)';

function readRecent() {
  try {
    const value = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(value) ? value.filter(item => typeof item === 'string' && item.trim()).slice(0, RECENT_LIMIT) : [];
  } catch { return []; }
}
function writeRecent(list) {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch { /* 저장이 막혀도 검색은 된다. */ }
}

function useMediaQuery(query) {
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

// 입력 중인 검색어가 들어간 공개 문제 제목을 제안한다. 아직 받기 전이면 null.
function useSuggestions(term) {
  const value = term.trim();
  const [state, setState] = useState({ term: '', items: [] });
  useEffect(() => {
    if (!value) return undefined;
    let alive = true;
    const timer = window.setTimeout(() => {
      suggestPublicQuizTitles(value).then(items => { if (alive) setState({ term: value, items }); }).catch(() => { if (alive) setState({ term: value, items: [] }); });
    }, 150);
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

// 검색어가 없으면 최근 검색어, 있으면 자동완성 제안을 보여준다.
function SearchSuggestions({ draft, recent, onPick, onRemoveRecent, onClearRecent }) {
  const term = draft.trim();
  const suggestions = useSuggestions(draft);
  if (!term) {
    if (!recent.length) return <p className="public-search-empty">최근 검색어가 없어요.</p>;
    return <section className="public-search-section" aria-label="최근 검색어">
      <div className="public-search-section-head"><h3>최근 검색어</h3><button type="button" onClick={onClearRecent}>전체 삭제</button></div>
      <ul className="public-search-list">{recent.map(item => <li key={item}>
        <button type="button" className="public-search-option" onClick={() => onPick(item)}><Clock size={18} aria-hidden="true" /><span>{item}</span></button>
        <button type="button" className="public-search-remove" aria-label={`최근 검색어 ${item} 삭제`} onClick={() => onRemoveRecent(item)}><X size={16} aria-hidden="true" /></button>
      </li>)}</ul>
    </section>;
  }
  const items = (suggestions || []).filter(item => item !== term);
  return <ul className="public-search-list" aria-label="검색어 제안">
    <li><button type="button" className="public-search-option is-query" onClick={() => onPick(term)}><Search size={18} aria-hidden="true" /><span><mark>{term}</mark> 검색</span></button></li>
    {items.map(item => <li key={item}><button type="button" className="public-search-option" onClick={() => onPick(item)}><Search size={18} aria-hidden="true" /><Highlight text={item} term={term} /></button></li>)}
  </ul>;
}

function SearchInput({ inputRef, value, onChange, onClear, ...props }) {
  return <label className="quiz-search public-search-field"><Search size={18} aria-hidden="true" /><span className="mb-sr-only">공개 문제 검색</span>
    <input ref={inputRef} type="search" enterKeyHint="search" autoComplete="off" value={value} maxLength={QUERY_LIMIT} placeholder={PLACEHOLDER} onChange={event => onChange(event.target.value)} {...props} />
    {value && <button type="button" className="public-search-clear" aria-label="검색어 지우기" onMouseDown={event => event.preventDefault()} onClick={onClear}><X size={14} aria-hidden="true" /></button>}
  </label>;
}

// 모바일: 검색창을 누르면 전체 화면 검색으로 바꾼다. 뒤로가기 버튼·기기 뒤로가기로 닫힌다.
function SearchScreen({ initial, recent, onSubmit, onClose, onRemoveRecent, onClearRecent }) {
  const [draft, setDraft] = useState(initial);
  const inputRef = useRef(null);
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
    inputRef.current?.focus({ preventScroll: true });
    window.history.pushState({ ...(window.history.state || {}), [HISTORY_KEY]: true }, '', window.location.href);
    const onPop = () => { if (!closedRef.current) { closedRef.current = true; onCloseRef.current(); } };
    const onKey = event => { if (event.key === 'Escape') { event.preventDefault(); finish(() => onCloseRef.current()); } };
    window.addEventListener('popstate', onPop);
    document.addEventListener('keydown', onKey);
    return () => { unlock(); window.removeEventListener('popstate', onPop); document.removeEventListener('keydown', onKey); };
  }, [finish]);
  const submit = term => finish(() => onSubmit(term));
  return createPortal(<div className="public-search-screen" role="dialog" aria-modal="true" aria-label="공개 문제 검색">
    <form className="public-search-screen-head" role="search" onSubmit={event => { event.preventDefault(); submit(draft); }}>
      <button type="button" className="public-search-back" aria-label="검색 닫기" onClick={() => finish(() => onCloseRef.current())}><ChevronLeft size={22} aria-hidden="true" /></button>
      <SearchInput inputRef={inputRef} value={draft} onChange={setDraft} onClear={() => { setDraft(''); inputRef.current?.focus(); }} />
    </form>
    <div className="public-search-screen-body">
      <SearchSuggestions draft={draft} recent={recent} onPick={submit} onRemoveRecent={onRemoveRecent} onClearRecent={onClearRecent} />
    </div>
  </div>, document.body);
}

function PublicQuizCard({ item }) {
  const stats = [`${item.question_count}문항`, item.participants > 0 ? `${item.participants.toLocaleString('ko-KR')}명 참여` : '', item.average_score != null && item.participants > 0 ? `평균 ${Number(item.average_score)}점` : ''].filter(Boolean).join(' · ');
  const paper = { kind: 'custom', label: item.title, description: item.description, count: item.question_count, samples: item.preview ? [{ title: item.preview, options: [] }] : [] };
  return <article className="paper-card public-quiz-card">
    <a className="paper-card-link" href={`./solve.html#share=${encodeURIComponent(item.token)}`} aria-label={`${item.title} · ${item.question_count}문항 문제 풀기`}>
      <PaperPreview paper={paper} />
      <div className="paper-info">
        <div className="paper-copy">
          <h2 className="mb-card-title">{item.title}</h2>
          <p>{item.author_name} · {stats}</p>
          {item.post_count > 0 && <p>이야기 {item.post_count.toLocaleString('ko-KR')}개</p>}
        </div>
      </div>
    </a>
  </article>;
}

export function PublicQuizSearch() {
  const mobile = useMediaQuery(MOBILE_QUERY);
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('popular');
  const [recent, setRecent] = useState(readRecent);
  const [screenOpen, setScreenOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [state, setState] = useState({ status: 'loading', items: [], total: 0, error: '' });
  const [loadingMore, setLoadingMore] = useState(false);
  const requestRef = useRef(0);
  const inputRef = useRef(null);
  const triggerRef = useRef(null);
  const dropdownId = useId();

  function saveRecent(next) { setRecent(next); writeRecent(next); }
  function apply(term) {
    const value = term.trim().slice(0, QUERY_LIMIT);
    setQuery(value);
    setDraft(value);
    setDropdownOpen(false);
    if (value) saveRecent([value, ...recent.filter(item => item !== value)].slice(0, RECENT_LIMIT));
  }
  function clearQuery() { setDraft(''); setQuery(''); }
  const removeRecent = item => saveRecent(recent.filter(old => old !== item));
  const clearRecent = () => saveRecent([]);
  useEffect(() => { if (!mobile) setScreenOpen(false); else setDropdownOpen(false); }, [mobile]);

  const load = useCallback(async (append, offset) => {
    const request = ++requestRef.current;
    if (append) setLoadingMore(true);
    else setState(current => ({ ...current, status: current.items.length ? 'refreshing' : 'loading', error: '' }));
    try {
      const page = await listPublicQuizzes({ query, sort, offset });
      if (request !== requestRef.current) return;
      setState(current => ({ status: 'ready', error: '', total: page.total, items: append ? [...current.items, ...page.items.filter(item => !current.items.some(old => old.token === item.token))] : page.items }));
    } catch (error) {
      if (request !== requestRef.current) return;
      setState(current => ({ ...current, status: error.unavailable ? 'unavailable' : 'error', error: error.message }));
    } finally { if (append) setLoadingMore(false); }
  }, [query, sort]);
  useEffect(() => { load(false, 0); }, [load]);

  const ready = state.status === 'ready' || state.status === 'refreshing';
  return <section className="public-quiz-search" aria-labelledby="public-search-title">
    <h2 id="public-search-title" className="mb-sr-only">공개 문제 검색</h2>
    {mobile
      ? <div className="public-search-box">
        <button ref={triggerRef} type="button" className={`quiz-search public-search-trigger${query ? ' has-value' : ''}`} aria-label={query ? `공개 문제 검색: ${query}` : '공개 문제 검색'} onClick={() => setScreenOpen(true)}>
          <Search size={18} aria-hidden="true" /><span>{query || PLACEHOLDER}</span>
        </button>
        {query && <button type="button" className="public-search-clear" aria-label="검색어 지우기" onClick={clearQuery}><X size={14} aria-hidden="true" /></button>}
      </div>
      : <div className="public-search-box" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setDropdownOpen(false); }}>
        <form role="search" onSubmit={event => { event.preventDefault(); apply(draft); inputRef.current?.blur(); }}>
          <SearchInput inputRef={inputRef} value={draft} aria-expanded={dropdownOpen} aria-controls={dropdownId}
            onChange={value => { setDraft(value); setDropdownOpen(true); if (!value.trim()) setQuery(''); }}
            onClear={() => { clearQuery(); setDropdownOpen(true); inputRef.current?.focus(); }}
            onFocus={() => setDropdownOpen(true)} onKeyDown={event => { if (event.key === 'Escape') setDropdownOpen(false); }} />
        </form>
        {dropdownOpen && (draft.trim() || recent.length > 0) && <div id={dropdownId} className="public-search-dropdown" onMouseDown={event => event.preventDefault()}>
          <SearchSuggestions draft={draft} recent={recent} onPick={term => { apply(term); inputRef.current?.blur(); }} onRemoveRecent={removeRecent} onClearRecent={clearRecent} />
        </div>}
      </div>}
    <div className="quiz-community-page-sort public-quiz-sort"><CommunitySortToggle ariaLabel="문제" sort={sort} onChange={setSort} /></div>
    {state.status === 'loading' && <p className="public-quiz-muted" role="status">공개 문제를 불러오고 있어요.</p>}
    {state.status === 'unavailable' && <div className="quiz-empty"><Search size={28} aria-hidden="true" /><h2 className="mb-card-title">공개 문제 검색을 준비하고 있어요</h2><p>곧 공개된 문제지를 찾아 풀 수 있어요.</p></div>}
    {state.status === 'error' && <div className="quiz-empty" role="alert"><h2 className="mb-card-title">공개 문제를 불러오지 못했어요</h2><p>{state.error}</p><button type="button" onClick={() => load(false, 0)}>다시 시도</button></div>}
    {ready && state.items.length === 0 && <div className="quiz-empty"><Search size={28} aria-hidden="true" /><h2 className="mb-card-title">{query ? '검색 결과가 없어요' : '아직 공개된 문제가 없어요'}</h2><p>{query ? '다른 검색어로 다시 찾아보세요.' : '내 문제지를 공개로 올려 첫 문제를 공유해보세요.'}</p></div>}
    {ready && state.items.length > 0 && <div className="paper-grid public-quiz-grid" aria-label="공개 문제 목록">{state.items.map(item => <PublicQuizCard key={item.token} item={item} />)}</div>}
    {ready && state.items.length < state.total && <button type="button" className="public-quiz-more" disabled={loadingMore} onClick={() => load(true, state.items.length)}>{loadingMore ? '불러오는 중' : `더 보기 (${Math.min(PUBLIC_PAGE_SIZE, state.total - state.items.length)})`}</button>}
    {screenOpen && <SearchScreen initial={query} recent={recent} onRemoveRecent={removeRecent} onClearRecent={clearRecent}
      onSubmit={term => { apply(term); setScreenOpen(false); requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true })); }}
      onClose={() => { setScreenOpen(false); requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true })); }} />}
  </section>;
}
