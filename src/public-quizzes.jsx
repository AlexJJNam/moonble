// 문제 서칭: 공개로 올린 문제지를 검색해서 풀어보는 탭.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { PaperPreview } from './paper-preview.jsx';
import { CommunitySortToggle } from './quiz-community.jsx';
import { SearchField } from './search-field.jsx';
import { CategoryChips } from './category-chips.jsx';
import { categoryLabel } from './quiz-categories.js';
import { listPublicQuizzes, PUBLIC_PAGE_SIZE, suggestPublicQuizTitles } from './public-quizzes-api.js';

function PublicQuizCard({ item }) {
  const stats = [`${item.question_count}문항`, item.participants > 0 ? `${item.participants.toLocaleString('ko-KR')}명 참여` : '', item.average_score != null && item.participants > 0 ? `평균 ${Number(item.average_score)}점` : ''].filter(Boolean).join(' · ');
  const paper = { kind: 'custom', label: item.title, description: item.description, count: item.question_count, samples: item.preview ? [{ title: item.preview, options: [] }] : [] };
  return <article className="paper-card public-quiz-card">
    <a className="paper-card-link" href={`./solve.html#share=${encodeURIComponent(item.token)}`} aria-label={`${item.title} · ${item.question_count}문항 문제 풀기`}>
      <PaperPreview paper={paper} />
      <div className="paper-info">
        <div className="paper-copy">
          <h2 className="mb-card-title">{item.title}</h2>
          <p>{categoryLabel(item.category) ? `${categoryLabel(item.category)} · ` : ''}{item.author_name} · {stats}</p>
          {item.post_count > 0 && <p>이야기 {item.post_count.toLocaleString('ko-KR')}개</p>}
        </div>
      </div>
    </a>
  </article>;
}

export function PublicQuizSearch() {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('popular');
  const [category, setCategory] = useState(null);
  const [state, setState] = useState({ status: 'loading', items: [], total: 0, error: '' });
  const [loadingMore, setLoadingMore] = useState(false);
  const requestRef = useRef(0);

  const load = useCallback(async (append, offset) => {
    const request = ++requestRef.current;
    if (append) setLoadingMore(true);
    else setState(current => ({ ...current, status: current.items.length ? 'refreshing' : 'loading', error: '' }));
    try {
      const page = await listPublicQuizzes({ query, sort, offset, category });
      if (request !== requestRef.current) return;
      setState(current => ({ status: 'ready', error: '', total: page.total, items: append ? [...current.items, ...page.items.filter(item => !current.items.some(old => old.token === item.token))] : page.items }));
    } catch (error) {
      if (request !== requestRef.current) return;
      setState(current => ({ ...current, status: error.unavailable ? 'unavailable' : 'error', error: error.message }));
    } finally { if (append) setLoadingMore(false); }
  }, [query, sort, category]);
  useEffect(() => { load(false, 0); }, [load]);

  const ready = state.status === 'ready' || state.status === 'refreshing';
  return <section className="public-quiz-search" aria-labelledby="public-search-title">
    <h2 id="public-search-title" className="mb-sr-only">공개 문제 검색</h2>
    <SearchField label="공개 문제 검색" placeholder="제목이나 설명으로 찾아보세요" value={query} onSearch={setQuery}
      suggest={suggestPublicQuizTitles} recentKey="moonble:public-search-recent" />
    <CategoryChips className="public-quiz-categories" label="카테고리 필터" allLabel="전체" value={category} onChange={setCategory} />
    <div className="quiz-community-page-sort public-quiz-sort"><CommunitySortToggle ariaLabel="문제" sort={sort} onChange={setSort} /></div>
    {state.status === 'loading' && <p className="public-quiz-muted" role="status">공개 문제를 불러오고 있어요.</p>}
    {state.status === 'unavailable' && <div className="quiz-empty"><Search size={28} aria-hidden="true" /><h2 className="mb-card-title">공개 문제 검색을 준비하고 있어요</h2><p>곧 공개된 문제지를 찾아 풀 수 있어요.</p></div>}
    {state.status === 'error' && <div className="quiz-empty" role="alert"><h2 className="mb-card-title">공개 문제를 불러오지 못했어요</h2><p>{state.error}</p><button type="button" onClick={() => load(false, 0)}>다시 시도</button></div>}
    {ready && state.items.length === 0 && <div className="quiz-empty"><Search size={28} aria-hidden="true" /><h2 className="mb-card-title">{query ? '검색 결과가 없어요' : category ? '이 카테고리의 공개 문제가 없어요' : '아직 공개된 문제가 없어요'}</h2><p>{query ? '다른 검색어로 다시 찾아보세요.' : category ? '다른 카테고리를 골라보세요.' : '내 문제지를 공개로 올려 첫 문제를 공유해보세요.'}</p></div>}
    {ready && state.items.length > 0 && <div className="paper-grid public-quiz-grid" aria-label="공개 문제 목록">{state.items.map(item => <PublicQuizCard key={item.token} item={item} />)}</div>}
    {ready && state.items.length < state.total && <button type="button" className="public-quiz-more" disabled={loadingMore} onClick={() => load(true, state.items.length)}>{loadingMore ? '불러오는 중' : `더 보기 (${Math.min(PUBLIC_PAGE_SIZE, state.total - state.items.length)})`}</button>}
  </section>;
}
