// 문제 서칭: 공개로 올린 문제지를 검색해서 풀어보는 탭.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { PaperPreview } from './paper-preview.jsx';
import { SegmentedControl } from './segmented-control.jsx';
import { listPublicQuizzes, PUBLIC_PAGE_SIZE } from './public-quizzes-api.js';

const SORT_ITEMS = [{ value: 'popular', label: '인기순' }, { value: 'latest', label: '최신순' }];

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
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('popular');
  const [state, setState] = useState({ status: 'loading', items: [], total: 0, error: '' });
  const [loadingMore, setLoadingMore] = useState(false);
  const requestRef = useRef(0);

  // 입력이 멈춘 뒤에 검색한다.
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(input.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [input]);

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
    <div className="public-quiz-tools">
      <label className="quiz-search public-quiz-input"><Search size={18} aria-hidden="true" /><span className="mb-sr-only">공개 문제 검색</span>
        <input type="search" value={input} maxLength={50} placeholder="제목이나 설명으로 찾아보세요" onChange={event => setInput(event.target.value)} /></label>
      <SegmentedControl className="quiz-community-sort" ariaLabel="정렬" items={SORT_ITEMS} value={sort} onChange={setSort} />
    </div>
    {state.status === 'loading' && <p className="public-quiz-muted" role="status">공개 문제를 불러오고 있어요.</p>}
    {state.status === 'unavailable' && <div className="quiz-empty"><Search size={28} aria-hidden="true" /><h2 className="mb-card-title">공개 문제 검색을 준비하고 있어요</h2><p>곧 공개된 문제지를 찾아 풀 수 있어요.</p></div>}
    {state.status === 'error' && <div className="quiz-empty" role="alert"><h2 className="mb-card-title">공개 문제를 불러오지 못했어요</h2><p>{state.error}</p><button type="button" onClick={() => load(false, 0)}>다시 시도</button></div>}
    {ready && state.items.length === 0 && <div className="quiz-empty"><Search size={28} aria-hidden="true" /><h2 className="mb-card-title">{query ? '검색 결과가 없어요' : '아직 공개된 문제가 없어요'}</h2><p>{query ? '다른 검색어로 다시 찾아보세요.' : '내 문제지를 공개로 올려 첫 문제를 공유해보세요.'}</p></div>}
    {ready && state.items.length > 0 && <div className="paper-grid public-quiz-grid" aria-label="공개 문제 목록">{state.items.map(item => <PublicQuizCard key={item.token} item={item} />)}</div>}
    {ready && state.items.length < state.total && <button type="button" className="public-quiz-more" disabled={loadingMore} onClick={() => load(true, state.items.length)}>{loadingMore ? '불러오는 중' : `더 보기 (${Math.min(PUBLIC_PAGE_SIZE, state.total - state.items.length)})`}</button>}
  </section>;
}
