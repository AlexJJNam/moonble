// 마이페이지 커뮤니티 활동: 요약 섹션과 상세(작성한 글 / 작성한 댓글 / 좋아요한 글).
import React, { useEffect, useState } from 'react';
import { ChevronLeft, Heart, MessageCircle, PenLine } from 'lucide-react';
import { CommunityFeed, toViewer } from './quiz-community.jsx';
import { formatRelativeDate } from './date-format.js';
import { COMMUNITY_PAGE_SIZE, getMyCommunitySummary, listMyComments } from './quiz-community-api.js';
import './account-community.css';

export const ACTIVITY_TABS = [
  { value: 'posts', label: '작성한 글', countKey: 'posts' },
  { value: 'comments', label: '작성한 댓글', countKey: 'comments' },
  { value: 'likes', label: '좋아요한 글', countKey: 'likes' },
];
const ACTIVITY_SCOPE = { posts: 'mine', likes: 'liked' };

export function activityHash(tab) {
  return tab ? `#activity/${tab}` : '#activity';
}

export function readActivityRoute() {
  const match = window.location.hash.match(/^#activity(?:\/(posts|comments|likes))?$/);
  return match ? { tab: match[1] || 'posts' } : null;
}

// 내 정보 화면의 한 섹션: 글·댓글·좋아요 수를 보여주고 누르면 상세로 이동한다.
export function CommunityActivitySummary() {
  const [summary, setSummary] = useState(undefined);
  useEffect(() => {
    let alive = true;
    getMyCommunitySummary().then(value => { if (alive) setSummary(value); }).catch(() => { if (alive) setSummary(null); });
    return () => { alive = false; };
  }, []);
  // 불러오는 중이거나 아직 준비되지 않은 DB에서는 섹션을 그리지 않는다.
  if (summary === undefined || summary === null) return null;
  return <section className="account-community" aria-labelledby="account-community-title">
    <div className="account-community-head">
      <h2 id="account-community-title" className="mb-section-title">커뮤니티 활동</h2>
    </div>
    <ul className="account-community-stats">
      {ACTIVITY_TABS.map(tab => <li key={tab.value}>
        <a href={activityHash(tab.value)}>
          <span>{tab.label}</span>
          <strong>{summary[tab.countKey].toLocaleString('ko-KR')}<small>개</small></strong>
        </a>
      </li>)}
    </ul>
  </section>;
}

function MyCommentList() {
  const [state, setState] = useState({ status: 'loading', items: [], total: 0 });
  const [more, setMore] = useState(false);
  async function load(offset) {
    const page = await listMyComments(offset);
    setState(current => ({ status: 'ready', total: page.total, items: offset ? [...current.items, ...page.comments.filter(item => !current.items.some(old => old.id === item.id))] : page.comments }));
  }
  useEffect(() => { load(0).catch(() => setState({ status: 'error', items: [], total: 0 })); }, []);
  if (state.status === 'loading') return <p className="account-community-muted" role="status">불러오는 중이에요.</p>;
  if (state.status === 'error') return <p className="account-community-muted" role="alert">댓글을 불러오지 못했어요. 잠시 후 다시 시도해주세요.</p>;
  if (!state.items.length) return <div className="account-community-empty"><strong>아직 작성한 댓글이 없어요</strong><p>관심 있는 글에 댓글을 남겨보세요.</p></div>;
  return <>
    <ul className="account-community-comments">
      {state.items.map(item => <li key={item.id}>
        <a href="./quiz.html#community" aria-label={`${item.post_title || item.post_body || '글'}에 남긴 댓글, 커뮤니티에서 보기`}>
          <p className="account-community-on">{item.post_title || item.post_body || '삭제된 내용 없음'}<small> · {item.post_author_name}</small></p>
          <p className="account-community-text">{item.body || 'GIF'}</p>
          <p className="account-community-meta"><time dateTime={item.created_at}>{formatRelativeDate(item.created_at)}</time>{item.like_count > 0 && <span><Heart size={13} aria-hidden="true" />{item.like_count}</span>}</p>
        </a>
      </li>)}
    </ul>
    {state.items.length < state.total && <button type="button" className="account-community-more-button" disabled={more}
      onClick={async () => { setMore(true); try { await load(state.items.length); } catch { /* 다음 페이지 실패는 목록을 유지한다. */ } finally { setMore(false); } }}>
      {more ? '불러오는 중' : `더 보기 (${Math.min(COMMUNITY_PAGE_SIZE, state.total - state.items.length)})`}
    </button>}
  </>;
}

export function CommunityActivityPage({ user, tab, onTabChange }) {
  const viewer = toViewer(user);
  const [counts, setCounts] = useState(null);
  useEffect(() => {
    let alive = true;
    getMyCommunitySummary().then(value => { if (alive) setCounts(value); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  return <>
    <div className="account-heading account-community-heading">
      <a className="account-community-back" href="#" aria-label="내 정보로 돌아가기" onClick={event => { event.preventDefault(); onTabChange(null); }}><ChevronLeft size={22} aria-hidden="true" /></a>
      <h1 className="mb-page-title">커뮤니티 활동</h1>
    </div>
    <div className="account-community-detail">
      <div className="account-community-tabs" role="tablist" aria-label="커뮤니티 활동">
        {ACTIVITY_TABS.map(item => <a key={item.value} role="tab" href={activityHash(item.value)} aria-selected={tab === item.value} aria-current={tab === item.value ? 'page' : undefined}
          onClick={event => { event.preventDefault(); onTabChange(item.value); }}>
          {item.label}{counts && <small>{counts[item.countKey].toLocaleString('ko-KR')}</small>}
        </a>)}
      </div>
      <div role="tabpanel" aria-label={ACTIVITY_TABS.find(item => item.value === tab)?.label}>
        {tab === 'comments' ? <MyCommentList key="comments" /> : <CommunityFeed key={tab} scope={ACTIVITY_SCOPE[tab]} viewer={viewer} variant="page" />}
      </div>
    </div>
  </>;
}
