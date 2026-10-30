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
import { getMyPublicQuizLikedTokens, getPublicQuizLikeStates, importPublicQuizLikes, setPublicQuizLike } from './public-quiz-likes.js';
import { listPublicQuizzes, PUBLIC_PAGE_SIZE, suggestPublicQuizTitles } from './public-quizzes-api.js';

const PUBLIC_TOKEN_PATTERN = /^[A-Za-z0-9_-]{40,50}$/;
const localLikesKey = userId => `moonble:user:${userId}:public-quiz-likes-v1`;
const migrationKey = userId => `moonble:user:${userId}:public-quiz-likes-migrated-v1`;
const pendingLikesKey = userId => `moonble:user:${userId}:public-quiz-likes-pending-v1`;

function legacyLikeTokens(userId) {
  return [...new Set(getLikedPublicQuizzes(userId).map(item => item.token).filter(token => PUBLIC_TOKEN_PATTERN.test(token)))].slice(0, 300);
}

function readPendingLikes(userId) {
  try {
    const saved = JSON.parse(localStorage.getItem(pendingLikesKey(userId)) || '{}');
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {};
    return Object.fromEntries(Object.entries(saved).filter(([token, liked]) => PUBLIC_TOKEN_PATTERN.test(token) && typeof liked === 'boolean').slice(-300));
  } catch { return {}; }
}

function storePendingLike(userId, token, liked) {
  if (!userId) return;
  try { localStorage.setItem(pendingLikesKey(userId), JSON.stringify({ ...readPendingLikes(userId), [token]: liked })); } catch { /* 저장이 막히면 기존 스크랩 동작만 유지한다. */ }
}

function clearPendingLike(userId, token, liked) {
  try {
    const pending = readPendingLikes(userId);
    if (pending[token] === liked) delete pending[token];
    localStorage.setItem(pendingLikesKey(userId), JSON.stringify(pending));
  } catch { /* 다음 동기화에서 같은 목표 상태로 다시 요청해도 안전하다. */ }
}

function wasMigrated(userId) {
  try { return localStorage.getItem(migrationKey(userId)) === '1'; } catch { return false; }
}

function rememberMigrated(userId) {
  try { localStorage.setItem(migrationKey(userId), '1'); } catch { /* 이관은 재시도해도 중복되지 않는다. */ }
}

function cacheLikedTokens(userId, tokens) {
  if (!userId) return;
  try {
    const old = new Map(getLikedPublicQuizzes(userId).map(item => [item.token, item]));
    const pending = readPendingLikes(userId);
    const current = [...new Set([...tokens, ...Object.keys(pending).filter(token => pending[token])])].slice(0, 300);
    localStorage.setItem(localLikesKey(userId), JSON.stringify(current.map(token => old.get(token) || { token, title: '', likedAt: new Date().toISOString() })));
  } catch { /* 서버 스크랩은 기기 저장소에 영향을 받지 않는다. */ }
}

function cacheLikeState(userId, item, liked) {
  const saved = getLikedPublicQuizzes(userId).some(entry => entry.token === item.token);
  if (saved !== liked) toggleLikedPublicQuiz(userId, item);
}

// 썸네일 문항: 검색 결과에 앞 문항(samples)이 없으면(019/020 적용 전) 공유 문제를 한 번 불러와 나의 문제지처럼 앞 6문항을 그린다.
const sampleCache = new Map();
function usePublicSamples(item) {
  const own = Array.isArray(item.samples) && item.samples.length ? item.samples.map(sample => ({ title: String(sample?.q || ''), options: Array.isArray(sample?.options) ? sample.options.map(String) : [] })) : null;
  const [fetched, setFetched] = useState(() => sampleCache.get(item.token) || null);
  useEffect(() => {
    if (own) return undefined;
    if (sampleCache.has(item.token)) { setFetched(sampleCache.get(item.token)); return undefined; }
    let alive = true;
    getQuizShare(item.token).then(share => {
      const samples = share.questions.slice(0, 6).map(question => ({ title: question.q, options: question.options }));
      sampleCache.set(item.token, samples);
      if (alive) setFetched(samples);
    }).catch(() => {});
    return () => { alive = false; };
  }, [item.token, Boolean(own)]);
  return own || fetched || (item.preview ? [{ title: item.preview, options: [] }] : []);
}

function PublicQuizCard({ item, likeState, likeMode, likePending, onToggleLike }) {
  const [confirming, setConfirming] = useState(false);
  const liked = Boolean(likeState?.liked);
  const count = Number.isInteger(likeState?.likeCount) ? likeState.likeCount : null;
  const href = `./solve.html#share=${encodeURIComponent(item.token)}`;
  const stats = [`${item.question_count}문항`, item.participants > 0 ? `${item.participants.toLocaleString('ko-KR')}명 참여` : '', item.average_score != null && item.participants > 0 ? `평균 ${Number(item.average_score)}점` : ''].filter(Boolean).join(' · ');
  const samples = usePublicSamples(item);
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
    <button className={`paper-favorite-toggle is-heart${liked ? ' is-active' : ''}`} type="button" aria-label={`${item.title} ${liked ? '스크랩 취소' : '스크랩'}${count !== null ? `, 좋아요 ${count}개` : ''}`} aria-pressed={liked} aria-busy={likePending || undefined} disabled={likePending || likeMode === 'loading' || !likeState} title={liked ? '스크랩 취소' : '스크랩'}
      onClick={event => { event.preventDefault(); event.stopPropagation(); onToggleLike(item); }}><Heart size={16} fill={liked ? 'currentColor' : 'none'} aria-hidden="true" />{count !== null && <span className="public-quiz-like-count" aria-hidden="true">{count.toLocaleString('ko-KR')}</span>}</button>
    {confirming && <SolveConfirmDialog title="이 문제를 푸시겠어요?" description={`${item.title} · ${stats}`} solveHref={href}
      loadPreview={() => getQuizShare(item.token).then(share => previewPaperFromQuestions(share))} onClose={() => setConfirming(false)} />}
  </article>;
}

export function PublicQuizSearch({ userId = null }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('popular');
  const [category, setCategory] = useState(null);
  const [view, setView] = useState('grid');
  const [scrapOnly, setScrapOnly] = useState(false);
  const [state, setState] = useState({ status: 'loading', items: [], total: 0, error: '' });
  const [loadingMore, setLoadingMore] = useState(false);
  const [likeMode, setLikeMode] = useState('loading');
  const [likeStates, setLikeStates] = useState({});
  const [likeBusy, setLikeBusy] = useState({});
  const [likeWarning, setLikeWarning] = useState('');
  const [likeNotice, setLikeNotice] = useState('');
  const [likeRetry, setLikeRetry] = useState(0);
  const likedTokensRef = useRef([]);
  const busyLikesRef = useRef(new Set());
  const likeRevisionRef = useRef(0);
  const likeChangedAtRef = useRef({});
  const requestRef = useRef(0);

  useEffect(() => {
    let alive = true;
    setLikeMode('loading');
    setLikeStates({});
    setLikeWarning('');
    async function prepareLikes() {
      if (!userId) { if (alive) setLikeMode('local'); return; }
      try {
        const needsMigration = !wasMigrated(userId);
        if (needsMigration) await importPublicQuizLikes(legacyLikeTokens(userId));
        for (const [token, liked] of Object.entries(readPendingLikes(userId))) {
          try {
            await setPublicQuizLike(token, liked);
            clearPendingLike(userId, token, liked);
          } catch (error) {
            if (error.code !== 'P0002') throw error;
          }
        }
        const tokens = await getMyPublicQuizLikedTokens();
        if (!alive) return;
        if (needsMigration) rememberMigrated(userId);
        likedTokensRef.current = tokens;
        cacheLikedTokens(userId, tokens);
        setLikeMode('server');
      } catch {
        if (!alive) return;
        likedTokensRef.current = legacyLikeTokens(userId);
        setLikeWarning('좋아요 수를 불러오지 못했어요. 스크랩은 이 기기에 저장돼요.');
        setLikeMode('local');
      }
    }
    prepareLikes();
    return () => { alive = false; };
  }, [userId, likeRetry]);

  useEffect(() => {
    if (!likeNotice) return undefined;
    const timer = window.setTimeout(() => setLikeNotice(''), 3500);
    return () => window.clearTimeout(timer);
  }, [likeNotice]);

  const load = useCallback(async (append, offset) => {
    if (likeMode === 'loading') return;
    const request = ++requestRef.current;
    const likeRevision = likeRevisionRef.current;
    if (append) setLoadingMore(true);
    else setState(current => ({ ...current, status: current.items.length ? 'refreshing' : 'loading', error: '' }));
    try {
      const page = await listPublicQuizzes({ query, sort, offset, category, tokens: scrapOnly ? likedTokensRef.current : null });
      let pageLikes = {};
      let countsFailed = false;
      if (likeMode === 'server') {
        try {
          pageLikes = await getPublicQuizLikeStates(page.items.map(item => item.token));
          countsFailed = page.items.some(item => !pageLikes[item.token]);
        }
        catch { countsFailed = true; }
      } else {
        const saved = new Set(likedTokensRef.current);
        pageLikes = Object.fromEntries(page.items.map(item => [item.token, { liked: saved.has(item.token), likeCount: null }]));
      }
      if (request !== requestRef.current) return;
      const visibleItems = scrapOnly ? page.items.filter(item => likedTokensRef.current.includes(item.token)) : page.items;
      setState(current => ({ status: 'ready', error: '', total: page.total, items: append ? [...current.items, ...visibleItems.filter(item => !current.items.some(old => old.token === item.token))] : visibleItems }));
      setLikeStates(current => {
        const next = append ? { ...current, ...pageLikes } : { ...pageLikes };
        for (const item of page.items) {
          if ((likeChangedAtRef.current[item.token] || 0) <= likeRevision) continue;
          if (current[item.token]) next[item.token] = current[item.token];
          else delete next[item.token];
        }
        return next;
      });
      if (likeMode === 'server') setLikeWarning(current => countsFailed ? '좋아요 수를 불러오지 못했어요.' : append ? current : '');
    } catch (error) {
      if (request !== requestRef.current) return;
      setState(current => ({ ...current, status: error.unavailable ? 'unavailable' : 'error', error: error.message }));
    } finally { if (append) setLoadingMore(false); }
  }, [query, sort, category, scrapOnly, likeMode]);
  useEffect(() => {
    load(false, 0);
    return () => { requestRef.current += 1; };
  }, [load]);

  function applyLikeState(item, next) {
    likeRevisionRef.current += 1;
    likeChangedAtRef.current[item.token] = likeRevisionRef.current;
    setLikeStates(current => ({ ...current, [item.token]: next }));
    likedTokensRef.current = next.liked
      ? [item.token, ...likedTokensRef.current.filter(token => token !== item.token)].slice(0, 300)
      : likedTokensRef.current.filter(token => token !== item.token);
    cacheLikeState(userId, item, next.liked);
    if (scrapOnly && !next.liked) {
      setState(current => ({ ...current, items: current.items.filter(old => old.token !== item.token), total: Math.max(0, current.total - 1) }));
    }
  }

  function invalidateLikeState(token) {
    likeRevisionRef.current += 1;
    likeChangedAtRef.current[token] = likeRevisionRef.current;
    setLikeStates(old => { const next = { ...old }; delete next[token]; return next; });
    setLikeWarning('좋아요 수를 불러오지 못했어요.');
  }

  async function toggleLike(item) {
    const current = likeStates[item.token];
    if (!userId || !current || busyLikesRef.current.has(item.token)) return;
    const desired = !current.liked;
    if (likeMode === 'local') {
      storePendingLike(userId, item.token, desired);
      applyLikeState(item, { liked: desired, likeCount: null });
      return;
    }
    busyLikesRef.current.add(item.token);
    setLikeBusy(old => ({ ...old, [item.token]: true }));
    try {
      const result = await setPublicQuizLike(item.token, desired);
      clearPendingLike(userId, item.token, desired);
      applyLikeState(item, result);
    } catch (error) {
      // 응답이 끊겨도 서버에서 이미 저장됐을 수 있으므로 실제 상태를 다시 확인한다.
      try {
        const actual = await getPublicQuizLikeStates([item.token]);
        if (actual[item.token]) {
          applyLikeState(item, actual[item.token]);
          if (actual[item.token].liked !== desired) setLikeNotice(error.message || '좋아요를 반영하지 못했어요.');
        } else {
          invalidateLikeState(item.token);
          setLikeNotice(error.message || '좋아요를 반영하지 못했어요.');
        }
      } catch {
        invalidateLikeState(item.token);
        setLikeNotice(error.message || '좋아요를 반영하지 못했어요.');
      }
    } finally {
      busyLikesRef.current.delete(item.token);
      setLikeBusy(old => { const next = { ...old }; delete next[item.token]; return next; });
    }
  }

  const ready = state.status === 'ready' || state.status === 'refreshing';
  return <section className="public-quiz-search" aria-labelledby="public-search-title">
    <h2 id="public-search-title" className="mb-sr-only">공개 문제 검색</h2>
    <SearchField label="공개 문제 검색" placeholder="제목이나 설명으로 찾아보세요" value={query} onSearch={setQuery}
      suggest={suggestPublicQuizTitles} recentKey="moonble:public-search-recent"
      tags={category ? [{ key: 'category', label: categoryLabel(category), onRemove: () => setCategory(null) }] : []}
      screenExtra={<div className="mb-search-filter"><CategoryChips label="카테고리 필터" allLabel="전체" value={category} onChange={setCategory} /></div>} />
    {likeWarning && <p className="public-quiz-like-warning" role="status">{likeWarning} <button type="button" onClick={() => { if (likeMode === 'local') setLikeRetry(value => value + 1); else load(false, 0); }}>다시 시도</button></p>}
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
    {ready && state.items.length > 0 && <div className={`paper-grid public-quiz-grid${view === 'list' ? ' paper-list' : ''}`} aria-label="공개 문제 목록">{state.items.map(item => <PublicQuizCard key={item.token} item={item} likeState={likeStates[item.token]} likeMode={likeMode} likePending={Boolean(likeBusy[item.token])} onToggleLike={toggleLike} />)}</div>}
    {ready && state.items.length < state.total && <button type="button" className="public-quiz-more" disabled={loadingMore} onClick={() => load(true, state.items.length)}>{loadingMore ? '불러오는 중' : `더 보기 (${Math.min(PUBLIC_PAGE_SIZE, state.total - state.items.length)})`}</button>}
    {likeNotice && <p className="quiz-library-notice" role="status">{likeNotice}</p>}
  </section>;
}
