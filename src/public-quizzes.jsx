// 문제 서칭: 공개로 올린 문제지를 검색해서 풀어보는 탭.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Heart, LayoutGrid, List, Search } from 'lucide-react';
import { PaperPreview } from './paper-preview.jsx';
import { CommunitySortToggle } from './quiz-community.jsx';
import { SearchField } from './search-field.jsx';
import { CategoryChips } from './category-chips.jsx';
import { categoryLabel } from './quiz-categories.js';
import { SolveConfirmDialog, previewPaperFromQuestions } from './quiz-preview-dialog.jsx';
import { getQuizShare } from './quiz-share.js';
import { getLikedPublicQuizzes, toggleLikedPublicQuiz } from './paper-favorites.js';
import { listPublicQuizzes, PUBLIC_PAGE_SIZE, suggestPublicQuizTitles } from './public-quizzes-api.js';

function PublicQuizCard({ item, userId, onLikeChange }) {
  const [confirming, setConfirming] = useState(false);
  const [liked, setLiked] = useState(() => getLikedPublicQuizzes(userId).some(saved => saved.token === item.token));
  const href = `./solve.html#share=${encodeURIComponent(item.token)}`;
  const stats = [`${item.question_count}문항`, item.participants > 0 ? `${item.participants.toLocaleString('ko-KR')}명 참여` : '', item.average_score != null && item.participants > 0 ? `평균 ${Number(item.average_score)}점` : ''].filter(Boolean).join(' · ');
  // 썸네일에는 앞 문항 최대 6개(019의 samples). 019 적용 전에는 첫 문항(preview)만 쓴다.
  const samples = Array.isArray(item.samples) && item.samples.length ? item.samples.map(sample => ({ title: String(sample?.q || ''), options: Array.isArray(sample?.options) ? sample.options.map(String) : [] })) : item.preview ? [{ title: item.preview, options: [] }] : [];
  const paper = { kind: 'custom', label: item.title, description: item.description, count: item.question_count, samples };
  return <article className="paper-card public-quiz-card">
    <a className="paper-card-link" href={href} aria-label={`${item.title} · ${item.question_count}문항 문제 풀기`}
      onClick={event => { if (event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1) return; event.preventDefault(); setConfirming(true); }}>
      <PaperPreview paper={paper} />
      <div className="paper-info">
        <div className="paper-copy">
          <h2 className="mb-card-title">{item.title}</h2>
          <p>{categoryLabel(item.category) ? `${categoryLabel(item.category)} · ` : ''}{item.author_name} · {stats}</p>
          {item.post_count > 0 && <p>이야기 {item.post_count.toLocaleString('ko-KR')}개</p>}
        </div>
      </div>
    </a>
    <button className={`paper-favorite-toggle is-heart${liked ? ' is-active' : ''}`} type="button" aria-label={`${item.title} ${liked ? '스크랩 취소' : '스크랩'}`} aria-pressed={liked} title={liked ? '스크랩 취소' : '스크랩'}
      onClick={event => { event.preventDefault(); event.stopPropagation(); const next = toggleLikedPublicQuiz(userId, item); setLiked(next); onLikeChange?.(item, next); }}><Heart size={16} fill={liked ? 'currentColor' : 'none'} aria-hidden="true" /></button>
    {confirming && <SolveConfirmDialog title="이 문제를 푸시겠어요?" description={`${item.title} · ${stats}`} solveHref={href}
      loadPreview={() => getQuizShare(item.token).then(share => previewPaperFromQuestions(share))} onClose={() => setConfirming(false)} />}
  </article>;
}

export function PublicQuizSearch({ userId = null }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('popular');
  const [category, setCategory] = useState(null);
  const [view, setView] = useState('grid');
  // 스크랩 문제지만 보기(하트한 공개 문제). 하트 목록은 이 기기에 저장돼 있다.
  const [scrapOnly, setScrapOnly] = useState(false);
  const [state, setState] = useState({ status: 'loading', items: [], total: 0, error: '' });
  const [loadingMore, setLoadingMore] = useState(false);
  const requestRef = useRef(0);

  const load = useCallback(async (append, offset) => {
    const request = ++requestRef.current;
    if (append) setLoadingMore(true);
    else setState(current => ({ ...current, status: current.items.length ? 'refreshing' : 'loading', error: '' }));
    try {
      const page = await listPublicQuizzes({ query, sort, offset, category, tokens: scrapOnly ? getLikedPublicQuizzes(userId).map(saved => saved.token) : null });
      if (request !== requestRef.current) return;
      setState(current => ({ status: 'ready', error: '', total: page.total, items: append ? [...current.items, ...page.items.filter(item => !current.items.some(old => old.token === item.token))] : page.items }));
    } catch (error) {
      if (request !== requestRef.current) return;
      setState(current => ({ ...current, status: error.unavailable ? 'unavailable' : 'error', error: error.message }));
    } finally { if (append) setLoadingMore(false); }
  }, [query, sort, category, scrapOnly, userId]);
  useEffect(() => { load(false, 0); }, [load]);

  const ready = state.status === 'ready' || state.status === 'refreshing';
  return <section className="public-quiz-search" aria-labelledby="public-search-title">
    <h2 id="public-search-title" className="mb-sr-only">공개 문제 검색</h2>
    <SearchField label="공개 문제 검색" placeholder="제목이나 설명으로 찾아보세요" value={query} onSearch={setQuery}
      suggest={suggestPublicQuizTitles} recentKey="moonble:public-search-recent" />
    <CategoryChips className="public-quiz-categories" label="카테고리 필터" allLabel="전체" value={category} onChange={setCategory} />
    <div className="quiz-community-page-sort public-quiz-sort">
      <div className="public-quiz-sort-left">
        <CommunitySortToggle ariaLabel="문제" sort={sort} onChange={setSort} />
        <label className="mb-switch">
          <input type="checkbox" role="switch" checked={scrapOnly} aria-checked={scrapOnly} onChange={event => setScrapOnly(event.target.checked)} />
          <span className="mb-switch-track" aria-hidden="true"><span /></span>
          <span className="mb-switch-label">스크랩 문제지</span>
        </label>
      </div>
      <button type="button" className="quiz-view-toggle-button" aria-label={view === 'grid' ? '1열 목록으로 보기' : '2열 카드로 보기'} title={view === 'grid' ? '1열 목록으로 보기' : '2열 카드로 보기'}
        onClick={() => setView(current => current === 'grid' ? 'list' : 'grid')}>{view === 'grid' ? <List size={18} aria-hidden="true" /> : <LayoutGrid size={18} aria-hidden="true" />}</button>
    </div>
    {state.status === 'loading' && <p className="public-quiz-muted" role="status">공개 문제를 불러오고 있어요.</p>}
    {state.status === 'unavailable' && <div className="quiz-empty"><Search size={28} aria-hidden="true" /><h2 className="mb-card-title">공개 문제 검색을 준비하고 있어요</h2><p>곧 공개된 문제지를 찾아 풀 수 있어요.</p></div>}
    {state.status === 'error' && <div className="quiz-empty" role="alert"><h2 className="mb-card-title">공개 문제를 불러오지 못했어요</h2><p>{state.error}</p><button type="button" onClick={() => load(false, 0)}>다시 시도</button></div>}
    {ready && state.items.length === 0 && <div className="quiz-empty"><Search size={28} aria-hidden="true" /><h2 className="mb-card-title">{scrapOnly && !query && !category ? '스크랩한 문제지가 없어요' : query ? '검색 결과가 없어요' : category ? '이 카테고리의 공개 문제가 없어요' : '아직 공개된 문제가 없어요'}</h2><p>{scrapOnly && !query && !category ? '마음에 드는 문제지의 하트를 눌러 스크랩해보세요.' : query ? '다른 검색어로 다시 찾아보세요.' : category ? '다른 카테고리를 골라보세요.' : '내 문제지를 공개로 올려 첫 문제를 공유해보세요.'}</p></div>}
    {ready && state.items.length > 0 && <div className={`paper-grid public-quiz-grid${view === 'list' ? ' paper-list' : ''}`} aria-label="공개 문제 목록">{state.items.map(item => <PublicQuizCard key={item.token} item={item} userId={userId}
      onLikeChange={(target, liked) => { if (scrapOnly && !liked) setState(current => ({ ...current, items: current.items.filter(old => old.token !== target.token), total: Math.max(0, current.total - 1) })); }} />)}</div>}
    {ready && state.items.length < state.total && <button type="button" className="public-quiz-more" disabled={loadingMore} onClick={() => load(true, state.items.length)}>{loadingMore ? '불러오는 중' : `더 보기 (${Math.min(PUBLIC_PAGE_SIZE, state.total - state.items.length)})`}</button>}
  </section>;
}
