// 커뮤니티: 문제지 화면의 "커뮤니티" 탭(전체 피드)과 공유 문제 순위 카드 아래(그 문제가 첨부된 글)에서 함께 쓴다.
import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { ChevronRight, Ellipsis, Heart, MessageCircle, Paperclip, PenLine, Share2, Trophy, X } from 'lucide-react';
import { cachedAuthSession, getSessionSafely, loginUrl, supabase } from './supabase.js';
import { hasProfile, profileOf } from './profile.js';
import { formatRelativeDate } from './date-format.js';
import { SegmentedControl } from './segmented-control.jsx';
import { clearCachedQuizShareToken, createQuizShare, getCachedQuizShareToken } from './quiz-share.js';
import {
  COMMENT_BODY_LIMIT, COMMUNITY_PAGE_SIZE, COMMUNITY_TOPICS, CommunityUnavailableError, POST_BODY_LIMIT, POST_TITLE_LIMIT,
  canAttachRecord, communityTokenHash, createComment, createPost, deleteComment, deletePost, externalShareUrl, getSolvedShares,
  listComments, listPosts, rememberSolvedShare, reportPost, solveHref, toggleLike,
} from './quiz-community-api.js';
import './quiz-community.css';

const RETURN_KEY = 'moonble:after-login';
const COMMUNITY_RETURN_KEY = 'moonble:community-return';
const SORT_ITEMS = [{ value: 'popular', label: '인기순' }, { value: 'latest', label: '최신순' }];
const REPORT_REASONS = [
  { value: 'spoiler', label: '정답을 그대로 공개해요' },
  { value: 'spam', label: '스팸·홍보 글이에요' },
  { value: 'abuse', label: '욕설·비방이 있어요' },
  { value: 'other', label: '기타' },
];
const AVATAR_TONES = ['blue', 'green', 'yellow', 'purple', 'pink', 'gray'];
const EMPTY_DRAFT = { topic: '', title: '', body: '', attachment: null, showRecord: true };

function topicLabel(value) {
  return COMMUNITY_TOPICS.find(topic => topic.value === value)?.label || '';
}

export function toViewer(user) {
  if (!user) return null;
  return { id: user.id, name: profileOf(user).name, ready: hasProfile(user) };
}

function useViewer() {
  const [viewer, setViewer] = useState(() => toViewer(cachedAuthSession()?.user));
  useEffect(() => {
    if (!supabase) return undefined;
    let alive = true;
    getSessionSafely().then(({ session }) => { if (alive) setViewer(toViewer(session?.user)); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { if (alive) setViewer(toViewer(session?.user)); });
    return () => { alive = false; subscription.unsubscribe(); };
  }, []);
  return viewer;
}

function InitialAvatar({ name, size = 'md' }) {
  const text = name || '문블';
  const tone = AVATAR_TONES[[...text].reduce((sum, char) => sum + char.codePointAt(0), 0) % AVATAR_TONES.length];
  return <span className={`quiz-community-avatar is-${size} is-${tone}`} aria-hidden="true">{[...text][0]}</span>;
}

function AuthorBadges({ item }) {
  return item.is_share_owner ? <span className="quiz-community-badge is-owner">출제자</span> : null;
}

// 열린 대화상자 순서. Esc는 맨 위 대화상자만 닫는다.
const dialogStack = [];

// 대화상자: 데스크톱은 가운데, 모바일은 하단 시트. Esc·바깥 클릭으로 닫고 열기 전 포커스로 돌아간다.
function Dialog({ labelledBy, describedBy, className = '', onClose, children }) {
  const panelRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const token = {};
    dialogStack.push(token);
    const previous = document.activeElement;
    const onKey = event => {
      if (event.key === 'Escape' && dialogStack[dialogStack.length - 1] === token) { event.preventDefault(); closeRef.current(); }
    };
    document.addEventListener('keydown', onKey);
    window.moonbleScrollLock?.lock();
    const focusTarget = panelRef.current?.querySelector('[data-autofocus]') || panelRef.current;
    focusTarget?.focus({ preventScroll: true });
    return () => {
      dialogStack.splice(dialogStack.indexOf(token), 1);
      document.removeEventListener('keydown', onKey);
      window.moonbleScrollLock?.unlock();
      if (previous && typeof previous.focus === 'function') previous.focus({ preventScroll: true });
    };
  }, []);
  return createPortal(<div className="quiz-community-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={panelRef} className={`quiz-community-dialog ${className}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy} aria-describedby={describedBy} tabIndex={-1}>
      {children}
    </div>
  </div>, document.body);
}

function ConfirmDialog({ title, description, confirmLabel, danger, busy, onConfirm, onClose }) {
  const id = useId();
  return <Dialog labelledBy={`${id}-title`} describedBy={`${id}-desc`} className="is-confirm" onClose={busy ? () => {} : onClose}>
    <h2 id={`${id}-title`}>{title}</h2>
    <p id={`${id}-desc`} className="quiz-community-dialog-copy">{description}</p>
    <footer className="quiz-community-dialog-actions">
      <button type="button" onClick={onClose} disabled={busy}>취소</button>
      <button type="button" className={danger ? 'is-danger' : 'is-primary'} onClick={onConfirm} disabled={busy} data-autofocus>{confirmLabel}</button>
    </footer>
  </Dialog>;
}

function LoginPrompt({ viewer, tokenHash, onClose }) {
  const id = useId();
  const needsProfile = Boolean(viewer && !viewer.ready);
  function goLogin() {
    try {
      if (tokenHash) {
        sessionStorage.setItem(RETURN_KEY, './solve.html?paper=shared#quiz');
        sessionStorage.setItem(COMMUNITY_RETURN_KEY, tokenHash);
      }
    } catch { /* 저장이 막혀도 로그인은 진행한다. */ }
    window.location.href = needsProfile ? new URL('./prd.html', window.location.href).href : loginUrl();
  }
  return <Dialog labelledBy={`${id}-title`} describedBy={`${id}-desc`} className="is-confirm" onClose={onClose}>
    <h2 id={`${id}-title`}>{needsProfile ? '프로필을 완성하고 참여해보세요' : '로그인하고 참여해보세요'}</h2>
    <p id={`${id}-desc`} className="quiz-community-dialog-copy">
      {needsProfile ? '이름을 정하면 글과 댓글에 그 이름으로 표시돼요.' : '글을 남기거나 좋아요를 누르려면 Moonble 계정이 필요해요. 로그인하면 이 문제로 돌아와요.'}
    </p>
    <footer className="quiz-community-dialog-actions">
      <button type="button" onClick={onClose}>취소</button>
      <button type="button" className="is-primary" onClick={goLogin} data-autofocus>{needsProfile ? '프로필 설정하기' : '로그인하기'}</button>
    </footer>
  </Dialog>;
}

function ReportDialog({ onSubmit, onClose }) {
  const id = useId();
  const [reason, setReason] = useState('spoiler');
  const [busy, setBusy] = useState(false);
  return <Dialog labelledBy={`${id}-title`} className="is-confirm" onClose={busy ? () => {} : onClose}>
    <h2 id={`${id}-title`}>이 글을 신고할까요?</h2>
    <fieldset className="quiz-community-report-reasons">
      <legend className="mb-sr-only">신고 이유</legend>
      {REPORT_REASONS.map(option => <label key={option.value}>
        <input type="radio" name={`${id}-reason`} value={option.value} checked={reason === option.value} onChange={() => setReason(option.value)} data-autofocus={reason === option.value ? true : undefined} />
        <span>{option.label}</span>
      </label>)}
    </fieldset>
    <footer className="quiz-community-dialog-actions">
      <button type="button" onClick={onClose} disabled={busy}>취소</button>
      <button type="button" className="is-danger" disabled={busy} onClick={async () => { setBusy(true); try { await onSubmit(reason); } finally { setBusy(false); } }}>신고하기</button>
    </footer>
  </Dialog>;
}

// 문제지 썸네일 간략 버전(장식용). 제목과 첫 문항 일부만 보여준다.
function MiniSheet({ title, preview }) {
  return <span className="quiz-community-sheet" aria-hidden="true">
    <i />
    <b>{title}</b>
    {preview ? <em>Q1. {preview}</em> : <><u /><u /></>}
  </span>;
}

function RecordLine({ record }) {
  if (!record || !Number.isInteger(record.score)) return null;
  const top = Number.isInteger(record.rank) && record.rank <= 3;
  return <span className={`quiz-community-record${top ? ' is-top' : ''}`}>
    <Trophy size={14} aria-hidden="true" />
    <span>내 기록 <b>{record.score === 100 ? '만점' : `${record.score}점`}</b>{Number.isInteger(record.rank) && Number.isInteger(record.participants) ? ` · ${record.participants.toLocaleString('ko-KR')}명 중 ${record.rank}위` : ''}</span>
  </span>;
}

// 글에 붙은 문제지: 썸네일 + 요약 + 풀어보기(공유 링크). 작성 중에는 미리보기로 쓴다.
function QuizAttachment({ attachment, record, onRemove }) {
  const questionCount = Number(attachment.question_count ?? attachment.questionCount) || 0;
  const stats = [questionCount ? `${questionCount}문항` : '', Number.isInteger(attachment.participants) && attachment.participants > 0 ? `${attachment.participants.toLocaleString('ko-KR')}명 참여` : '',
    attachment.average_score != null && attachment.participants > 0 ? `평균 ${Number(attachment.average_score)}점` : ''].filter(Boolean).join(' · ');
  const active = attachment.active !== false;
  const token = attachment.token;
  const Body = <>
    <MiniSheet title={attachment.title} preview={attachment.preview} />
    <span className="quiz-community-attachment-copy">
      <strong>{attachment.title}</strong>
      {stats && <span>{stats}</span>}
      <RecordLine record={record} />
      {!active && <span className="is-inactive">공유가 중지된 문제지예요</span>}
    </span>
  </>;
  if (onRemove) {
    return <div className="quiz-community-attachment is-editing">
      {Body}
      {!attachment.fixed && <button type="button" className="quiz-community-icon-button" aria-label="첨부한 문제지 빼기" onClick={onRemove}><X size={18} aria-hidden="true" /></button>}
    </div>;
  }
  return active && token
    ? <a className="quiz-community-attachment" href={solveHref(token)} aria-label={`${attachment.title} 문제 풀어보기`}>
      {Body}
      <span className="quiz-community-attachment-cta">풀어보기<ChevronRight size={16} aria-hidden="true" /></span>
    </a>
    : <div className="quiz-community-attachment is-inactive">{Body}</div>;
}

function AttachPicker({ banks, solved, onPick, onBack }) {
  return <div className="quiz-community-picker">
    <header className="quiz-community-picker-head">
      <h2>문제지 첨부</h2>
      <button type="button" className="quiz-community-icon-button" aria-label="첨부 선택 닫기" onClick={onBack} data-autofocus><X size={20} aria-hidden="true" /></button>
    </header>
    <p className="quiz-community-dialog-copy">첨부한 문제지는 공유 링크와 함께 올라가서 누구나 풀어볼 수 있어요.</p>
    <section aria-labelledby="community-pick-mine">
      <h3 id="community-pick-mine">내가 만든 문제지</h3>
      {banks.length ? <ul>{banks.map(bank => <li key={bank.id}>
        <button type="button" onClick={() => onPick({ kind: 'bank', bankId: bank.id, title: bank.title, questionCount: bank.questions?.length || 0, preview: String(bank.questions?.[0]?.q || '').slice(0, 80) })}>
          <MiniSheet title={bank.title} preview={String(bank.questions?.[0]?.q || '').slice(0, 80)} />
          <span><strong>{bank.title}</strong><span>{bank.questions?.length || 0}문항</span></span>
        </button>
      </li>)}</ul> : <p className="quiz-community-muted">아직 만든 문제지가 없어요.</p>}
    </section>
    <section aria-labelledby="community-pick-solved">
      <h3 id="community-pick-solved">내가 푼 공유 문제</h3>
      {solved.length ? <ul>{solved.map(item => <li key={item.token}>
        <button type="button" onClick={() => onPick({ kind: 'share', token: item.token, title: item.title, questionCount: item.questionCount, preview: '' })}>
          <MiniSheet title={item.title} />
          <span><strong>{item.title}</strong><span>{item.questionCount ? `${item.questionCount}문항 · ` : ''}{formatRelativeDate(item.solvedAt)} 풀이</span></span>
        </button>
      </li>)}</ul> : <p className="quiz-community-muted">이 기기에서 공유 링크로 푼 문제가 여기에 나와요.</p>}
    </section>
  </div>;
}

function ComposeDialog({ viewer, draft, onDraftChange, onSubmit, onClose, attachSource, placeholder }) {
  const id = useId();
  const [view, setView] = useState('edit');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [recordAvailable, setRecordAvailable] = useState(false);
  const attachment = draft.attachment;
  const bodyLength = draft.body.trim().length;
  const ready = bodyLength > 0 && draft.body.length <= POST_BODY_LIMIT && draft.title.length <= POST_TITLE_LIMIT;

  useEffect(() => {
    let alive = true;
    const token = attachment?.kind === 'share' ? attachment.token : attachment?.kind === 'bank' ? attachSource?.cachedToken?.(attachment.bankId) : null;
    if (!token) { setRecordAvailable(false); return undefined; }
    canAttachRecord(token).then(value => { if (alive) setRecordAvailable(value); });
    return () => { alive = false; };
  }, [attachment, attachSource]);

  async function submit(event) {
    event.preventDefault();
    if (!ready || busy) return;
    setBusy(true); setError('');
    try { await onSubmit({ ...draft, showRecord: draft.showRecord && recordAvailable }); }
    catch (submitError) { setError(submitError.message || '글을 남기지 못했어요.'); }
    finally { setBusy(false); }
  }

  if (view === 'attach') {
    return <Dialog labelledBy={`${id}-pick`} className="is-compose" onClose={() => setView('edit')}>
      <AttachPicker banks={attachSource?.banks || []} solved={getSolvedShares()} onBack={() => setView('edit')}
        onPick={picked => { onDraftChange({ ...draft, attachment: picked, showRecord: true }); setView('edit'); }} />
    </Dialog>;
  }
  return <Dialog labelledBy={`${id}-title`} className="is-compose" onClose={busy ? () => {} : onClose}>
    <form onSubmit={submit}>
      <header className="quiz-community-compose-head">
        <InitialAvatar name={viewer.name} />
        <strong id={`${id}-title`}>{viewer.name}</strong>
        <label className="quiz-community-topic">
          <span className="mb-sr-only">주제</span>
          <select value={draft.topic} onChange={event => onDraftChange({ ...draft, topic: event.target.value })}>
            <option value="">주제 선택</option>
            {COMMUNITY_TOPICS.map(topic => <option key={topic.value} value={topic.value}>{topic.label}</option>)}
          </select>
        </label>
        <button type="button" className="quiz-community-icon-button" aria-label="닫기" onClick={onClose} disabled={busy}><X size={20} aria-hidden="true" /></button>
      </header>
      <label className="mb-sr-only" htmlFor={`${id}-subject`}>제목(선택)</label>
      <input id={`${id}-subject`} className="quiz-community-compose-title" value={draft.title} maxLength={POST_TITLE_LIMIT} placeholder="(선택) 제목을 입력해주세요"
        onChange={event => onDraftChange({ ...draft, title: event.target.value })} />
      <label className="mb-sr-only" htmlFor={`${id}-body`}>내용</label>
      <textarea id={`${id}-body`} className="quiz-community-compose-body" value={draft.body} maxLength={POST_BODY_LIMIT} placeholder={placeholder} data-autofocus
        onChange={event => onDraftChange({ ...draft, body: event.target.value })} />
      {attachment && <div className="quiz-community-compose-attachment">
        <QuizAttachment attachment={attachment} onRemove={() => onDraftChange({ ...draft, attachment: null })} />
        <label className={`quiz-community-record-toggle${recordAvailable ? '' : ' is-disabled'}`}>
          <input type="checkbox" checked={recordAvailable && draft.showRecord} disabled={!recordAvailable} onChange={event => onDraftChange({ ...draft, showRecord: event.target.checked })} />
          <span>
            <b>내 점수·순위 함께 올리기</b>
            <small>{recordAvailable ? '이 문제를 공유 링크로 푼 내 최고 점수와 순위가 표시돼요.' : '이 기기에서 공유 링크로 푼 기록이 있으면 점수·순위를 붙일 수 있어요.'}</small>
          </span>
        </label>
      </div>}
      <p className="quiz-community-policy">Moonble은 게시글이 운영 정책에 맞는지 확인하고 있어요. 정책에 어긋나는 글은 숨겨지거나 삭제될 수 있어요. 다른 참여자를 위해 정답을 그대로 적는 것은 피해주세요.</p>
      {error && <p className="quiz-community-form-error" role="alert">{error}</p>}
      <footer className="quiz-community-compose-foot">
        {attachSource && !attachment?.fixed && <button type="button" className="quiz-community-attach-button" onClick={() => setView('attach')}>
          <Paperclip size={18} aria-hidden="true" /><span>{attachment ? '다른 문제지' : '문제지 첨부'}</span>
        </button>}
        <span className={`quiz-community-counter${draft.body.length > POST_BODY_LIMIT * .95 ? ' is-near-limit' : ''}`} aria-live="polite">{draft.body.length.toLocaleString('ko-KR')} / {POST_BODY_LIMIT.toLocaleString('ko-KR')}</span>
        <button type="submit" className="is-primary" disabled={!ready || busy}>{busy ? '남기는 중' : '남기기'}</button>
      </footer>
    </form>
  </Dialog>;
}

function CommentThread({ post, viewer, onCountChange, onRequireLogin, onAnnounce }) {
  const [comments, setComments] = useState(null);
  const [error, setError] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const inputId = useId();
  useEffect(() => {
    let alive = true;
    listComments(post.id).then(items => { if (alive) setComments(items); }).catch(loadError => { if (alive) { setComments([]); setError(loadError.message); } });
    return () => { alive = false; };
  }, [post.id]);
  async function submit(event) {
    event.preventDefault();
    if (!viewer?.ready) { onRequireLogin(); return; }
    if (!body.trim() || busy) return;
    setBusy(true); setError('');
    try {
      const comment = await createComment(post.id, body);
      setComments(current => [...(current || []), comment]);
      setBody('');
      onCountChange(1);
    } catch (submitError) { setError(submitError.message); }
    finally { setBusy(false); }
  }
  async function remove(comment) {
    try {
      await deleteComment(comment.id);
      setComments(current => current.filter(item => item.id !== comment.id));
      onCountChange(-1);
      onAnnounce('댓글을 삭제했어요.');
    } catch (removeError) { setError(removeError.message); }
  }
  return <div className="quiz-community-comments">
    {comments === null ? <p className="quiz-community-muted">댓글을 불러오는 중이에요.</p>
      : comments.length === 0 ? <p className="quiz-community-muted">아직 댓글이 없어요.</p>
        : <ul>{comments.map(comment => <li key={comment.id}>
          <InitialAvatar name={comment.author_name} size="sm" />
          <div>
            <p className="quiz-community-comment-head"><strong>{comment.author_name}</strong><AuthorBadges item={comment} /><time dateTime={comment.created_at}>{formatRelativeDate(comment.created_at)}</time></p>
            <p className="quiz-community-comment-body">{comment.body}</p>
            {comment.can_delete && <button type="button" className="quiz-community-text-button" onClick={() => remove(comment)}>삭제</button>}
          </div>
        </li>)}</ul>}
    {error && <p className="quiz-community-form-error" role="alert">{error}</p>}
    <form className="quiz-community-comment-form" onSubmit={submit}>
      <label className="mb-sr-only" htmlFor={inputId}>댓글</label>
      <input id={inputId} value={body} maxLength={COMMENT_BODY_LIMIT} placeholder={viewer?.ready ? '댓글을 남겨보세요' : '로그인하고 댓글을 남겨보세요'}
        onFocus={() => { if (!viewer?.ready) onRequireLogin(); }} onChange={event => setBody(event.target.value)} readOnly={!viewer?.ready} />
      <button type="submit" disabled={viewer?.ready ? !body.trim() || busy : false}>등록</button>
    </form>
  </div>;
}

function PostCard({ post, viewer, onPatch, onRequireLogin, onAnnounce, onAskDelete, onAskReport }) {
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [liking, setLiking] = useState(false);
  const bodyRef = useRef(null);
  const menuRef = useRef(null);
  const menuId = useId();

  useLayoutEffect(() => {
    const node = bodyRef.current;
    if (node && !expanded) setClamped(node.scrollHeight > node.clientHeight + 1);
  }, [post.body, expanded]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = event => { if (!menuRef.current?.contains(event.target)) setMenuOpen(false); };
    const onKey = event => { if (event.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', onKey); };
  }, [menuOpen]);

  async function like() {
    if (!viewer?.ready) { onRequireLogin(); return; }
    if (liking) return;
    const previous = { liked: post.liked, like_count: post.like_count };
    onPatch({ liked: !post.liked, like_count: Math.max(0, post.like_count + (post.liked ? -1 : 1)) });
    setLiking(true);
    try {
      const result = await toggleLike(post.id);
      onPatch({ liked: result.liked, like_count: result.likeCount });
    } catch (likeError) {
      onPatch(previous);
      onAnnounce(likeError.message);
    } finally { setLiking(false); }
  }

  async function share() {
    const token = post.attachment?.active ? post.attachment.token : null;
    const url = token ? externalShareUrl(token) : new URL('./quiz.html#community', window.location.href).href;
    try {
      if (navigator.share) { await navigator.share({ title: post.attachment?.title ? `[문블] ${post.attachment.title}` : '[문블] 커뮤니티', url }); return; }
      await navigator.clipboard.writeText(url);
      onAnnounce(token ? '문제 링크를 복사했어요.' : '커뮤니티 링크를 복사했어요.');
    } catch (shareError) {
      if (shareError?.name !== 'AbortError') onAnnounce('링크를 복사하지 못했어요.');
    }
  }

  const topic = topicLabel(post.topic);
  return <li className="quiz-community-post">
    <InitialAvatar name={post.author_name} />
    <div className="quiz-community-post-main">
      <header className="quiz-community-post-head">
        <p><strong>{post.author_name}</strong><AuthorBadges item={post} /></p>
        <p className="quiz-community-meta"><time dateTime={post.created_at}>{formatRelativeDate(post.created_at)}</time>{topic && <span>{topic}</span>}</p>
        <div className="quiz-community-menu" ref={menuRef}>
          <button type="button" className="quiz-community-icon-button" aria-label="글 메뉴" aria-haspopup="menu" aria-expanded={menuOpen} aria-controls={menuId} onClick={() => setMenuOpen(open => !open)}>
            <Ellipsis size={18} aria-hidden="true" />
          </button>
          {menuOpen && <div id={menuId} className="quiz-community-menu-list" role="menu">
            {post.can_delete && <button type="button" role="menuitem" className="is-danger" onClick={() => { setMenuOpen(false); onAskDelete(post); }}>삭제하기</button>}
            {!post.is_mine && <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); if (viewer?.ready) onAskReport(post); else onRequireLogin(); }}>신고하기</button>}
          </div>}
        </div>
      </header>
      {post.title && <h4 className="quiz-community-post-title">{post.title}</h4>}
      <p ref={bodyRef} className={`quiz-community-post-body${expanded ? ' is-expanded' : ''}`}>{post.body}</p>
      {clamped && !expanded && <button type="button" className="quiz-community-text-button is-more" onClick={() => setExpanded(true)}>더 보기</button>}
      {post.attachment && <QuizAttachment attachment={post.attachment} record={post.record} />}
      {!post.attachment && post.record && <RecordLine record={post.record} />}
      <div className="quiz-community-actions">
        <button type="button" className={post.liked ? 'is-liked' : ''} aria-pressed={post.liked} aria-label={`좋아요 ${post.like_count}개`} onClick={like}>
          <Heart size={18} aria-hidden="true" fill={post.liked ? 'currentColor' : 'none'} /><span>{post.like_count}</span>
        </button>
        <button type="button" aria-expanded={commentsOpen} aria-label={`댓글 ${post.comment_count}개`} onClick={() => setCommentsOpen(open => !open)}>
          <MessageCircle size={18} aria-hidden="true" /><span>{post.comment_count}</span>
        </button>
        <button type="button" aria-label="공유" onClick={share}><Share2 size={18} aria-hidden="true" /></button>
      </div>
      {commentsOpen && <CommentThread post={post} viewer={viewer} onRequireLogin={onRequireLogin} onAnnounce={onAnnounce}
        onCountChange={delta => onPatch({ comment_count: Math.max(0, post.comment_count + delta) })} />}
    </div>
  </li>;
}

// scope='all': 전체 피드(문제지 화면 커뮤니티 탭). scope='share': token 공유 문제가 첨부된 글(순위 카드 아래).
export function CommunityFeed({ scope = 'all', token = null, viewer, variant = 'page', attachSource = null, fixedAttachment = null, tokenHash = '', onPosted }) {
  const [sort, setSort] = useState('popular');
  const [state, setState] = useState({ status: 'loading', posts: [], total: 0, error: '' });
  const [loadingMore, setLoadingMore] = useState(false);
  const [draft, setDraft] = useState(() => ({ ...EMPTY_DRAFT, attachment: fixedAttachment }));
  const [dialog, setDialog] = useState(null);
  const [announcement, setAnnouncement] = useState('');
  const requestRef = useRef(0);

  useEffect(() => { if (fixedAttachment) setDraft(current => ({ ...current, attachment: fixedAttachment })); }, [fixedAttachment]);

  const load = useCallback(async (nextSort, append = false, offset = 0) => {
    const request = ++requestRef.current;
    if (append) setLoadingMore(true);
    else setState(current => ({ ...current, status: current.posts.length ? 'refreshing' : 'loading', error: '' }));
    try {
      const page = await listPosts({ scope, token, sort: nextSort, offset });
      if (request !== requestRef.current) return;
      setState(current => ({ status: 'ready', error: '', total: page.total, posts: append ? [...current.posts, ...page.posts.filter(post => !current.posts.some(item => item.id === post.id))] : page.posts }));
    } catch (loadError) {
      if (request !== requestRef.current) return;
      setState(current => ({ ...current, status: loadError instanceof CommunityUnavailableError ? 'unavailable' : 'error', error: loadError.message }));
    } finally { if (append) setLoadingMore(false); }
  }, [scope, token]);

  useEffect(() => { load(sort); }, [sort, viewer?.id, load]);

  const announce = useCallback(message => { setAnnouncement(''); requestAnimationFrame(() => setAnnouncement(message)); }, []);
  const patchPost = useCallback((postId, patch) => setState(current => ({ ...current, posts: current.posts.map(post => post.id === postId ? { ...post, ...patch } : post) })), []);
  const requireLogin = useCallback(() => setDialog({ type: 'login' }), []);

  async function submitPost(nextDraft) {
    const attachment = nextDraft.attachment;
    let shareToken = null;
    if (attachment?.kind === 'share') shareToken = attachment.token;
    else if (attachment?.kind === 'bank') shareToken = await attachSource.resolveToken(attachment.bankId);
    let post;
    try {
      post = await createPost({ ...nextDraft, shareToken, showRecord: nextDraft.showRecord });
    } catch (postError) {
      // 저장해 둔 공유 링크가 중지된 경우 새 링크를 만들어 한 번 더 시도한다.
      if (attachment?.kind !== 'bank' || postError.code !== 'P0002') throw postError;
      shareToken = await attachSource.resolveToken(attachment.bankId, { fresh: true });
      post = await createPost({ ...nextDraft, shareToken, showRecord: nextDraft.showRecord });
    }
    setDraft({ ...EMPTY_DRAFT, attachment: fixedAttachment });
    setDialog(null);
    setState(current => ({ ...current, total: current.total + 1, posts: [post, ...current.posts.filter(item => item.id !== post.id)] }));
    announce('글을 남겼어요.');
    onPosted?.(post);
  }

  async function removePost(post) {
    setDialog(current => ({ ...current, busy: true }));
    try {
      await deletePost(post.id);
      setState(current => ({ ...current, total: Math.max(0, current.total - 1), posts: current.posts.filter(item => item.id !== post.id) }));
      setDialog(null);
      announce('글을 삭제했어요.');
    } catch (removeError) {
      setDialog(null);
      announce(removeError.message);
    }
  }

  if (state.status === 'unavailable') return variant === 'page' ? <div className="quiz-community-page"><div className="quiz-community-empty"><strong>커뮤니티를 준비하고 있어요</strong><p>곧 문제지를 나누고 기록을 자랑할 수 있어요.</p></div></div> : null;
  const hasMore = state.posts.length < state.total;
  const canWrite = Boolean(viewer?.ready);
  const countText = state.status === 'ready' || state.status === 'refreshing' ? `${state.total.toLocaleString('ko-KR')}개` : '';
  const placeholder = scope === 'share' ? '이 문제에 대한 의견을 남겨보세요' : '공부한 이야기나 내 문제지를 나눠보세요';
  const Wrapper = variant === 'card' ? 'section' : 'div';
  return <Wrapper className={variant === 'card' ? 'quiz-community' : 'quiz-community-page'} aria-labelledby={variant === 'card' ? 'quizCommunityTitle' : undefined} aria-busy={state.status === 'loading'}>
    <header className="quiz-community-head">
      {variant === 'card'
        ? <div><h3 id="quizCommunityTitle">커뮤니티</h3><p>이 문제를 푼 사람들의 이야기{countText ? ` ${countText}` : ''}</p></div>
        : <p className="quiz-community-total">전체 글{countText ? ` ${countText}` : ''}</p>}
      <SegmentedControl ariaLabel="글 정렬" className="quiz-community-sort" items={SORT_ITEMS} value={sort} onChange={setSort} />
    </header>

    <button type="button" className="quiz-community-composer" onClick={() => setDialog(canWrite ? { type: 'compose' } : { type: 'login' })}>
      <InitialAvatar name={canWrite ? viewer.name : ''} />
      <span>{canWrite ? (draft.body.trim() ? '작성 중인 글이 있어요' : placeholder) : '로그인하고 글을 남겨보세요'}</span>
      {attachSource ? <Paperclip size={18} aria-hidden="true" /> : <PenLine size={18} aria-hidden="true" />}
    </button>

    {state.status === 'loading' && <ul className="quiz-community-skeleton" aria-label="글을 불러오는 중">{[0, 1].map(key => <li key={key}><i /><span><b /><b /><b /></span></li>)}</ul>}
    {state.status === 'error' && <div className="quiz-community-error" role="alert">
      <p>{state.error}</p>
      <button type="button" onClick={() => load(sort)}>다시 시도</button>
    </div>}
    {(state.status === 'ready' || state.status === 'refreshing') && state.posts.length === 0 && <div className="quiz-community-empty">
      <strong>아직 남겨진 글이 없어요</strong>
      <p>{scope === 'share' ? '풀이 소감이나 궁금한 점을 가장 먼저 남겨보세요.' : '내가 만든 문제지를 첨부하고 첫 글을 남겨보세요.'}</p>
    </div>}
    {state.posts.length > 0 && <ol className="quiz-community-feed">
      {state.posts.map(post => <PostCard key={post.id} post={post} viewer={viewer}
        onPatch={patch => patchPost(post.id, patch)} onRequireLogin={requireLogin} onAnnounce={announce}
        onAskDelete={target => setDialog({ type: 'delete', post: target })} onAskReport={target => setDialog({ type: 'report', post: target })} />)}
    </ol>}
    {hasMore && state.status !== 'loading' && <button type="button" className="quiz-community-more" disabled={loadingMore} onClick={() => load(sort, true, state.posts.length)}>
      {loadingMore ? '불러오는 중' : `글 더 보기 (${Math.min(COMMUNITY_PAGE_SIZE, state.total - state.posts.length)})`}
    </button>}
    <p className="quiz-community-status" role="status" aria-live="polite">{announcement}</p>

    {dialog?.type === 'compose' && canWrite && <ComposeDialog viewer={viewer} draft={draft} onDraftChange={setDraft} onSubmit={submitPost} onClose={() => setDialog(null)}
      attachSource={attachSource} placeholder={placeholder} />}
    {dialog?.type === 'login' && <LoginPrompt viewer={viewer} tokenHash={tokenHash} onClose={() => setDialog(null)} />}
    {dialog?.type === 'delete' && <ConfirmDialog title="이 글을 삭제할까요?" description="삭제한 글과 댓글은 되돌릴 수 없어요." confirmLabel="삭제하기" danger busy={dialog.busy}
      onConfirm={() => removePost(dialog.post)} onClose={() => setDialog(null)} />}
    {dialog?.type === 'report' && <ReportDialog onClose={() => setDialog(null)} onSubmit={async reason => {
      try { await reportPost(dialog.post.id, reason); setDialog(null); announce('신고를 접수했어요. 확인 후 조치할게요.'); }
      catch (reportError) { setDialog(null); announce(reportError.message); }
    }} />}
  </Wrapper>;
}

// 문제지 화면 "커뮤니티" 탭. 내가 만든 문제지를 첨부할 수 있다.
export function CommunityPage({ user, banks }) {
  const viewer = toViewer(user);
  const banksRef = useRef(banks);
  banksRef.current = banks;
  const [attachSource] = useState(() => ({
    get banks() { return banksRef.current || []; },
    cachedToken: bankId => getCachedQuizShareToken(user.id, bankId),
    // 첨부하는 문제지는 공유 링크가 필요하다. 저장된 링크를 쓰고, 없거나 중지됐으면 새로 만든다.
    async resolveToken(bankId, { fresh = false } = {}) {
      if (!fresh) {
        const cached = getCachedQuizShareToken(user.id, bankId);
        if (cached) return cached;
      } else clearCachedQuizShareToken(user.id, bankId);
      const bank = (banksRef.current || []).find(item => item.id === bankId);
      if (!bank) throw new Error('첨부할 문제지를 찾지 못했어요.');
      return createQuizShare(user.id, bank);
    },
  }));
  return <CommunityFeed scope="all" viewer={viewer} variant="page" attachSource={attachSource} />;
}

// 공유 문제 풀이 화면: 제출해서 순위가 나온 뒤에만 보여준다(정답 스포일러 방지).
function SharedQuizCommunity({ token }) {
  const viewer = useViewer();
  const [tokenHash, setTokenHash] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const sectionRef = useRef(null);
  const sharedQuiz = window.moonbleSharedQuiz;
  const [fixedAttachment] = useState(() => ({
    kind: 'share', fixed: true, token,
    title: sharedQuiz?.title || '공유 문제', questionCount: sharedQuiz?.questions?.length || 0,
    preview: String(sharedQuiz?.questions?.[0]?.q || '').slice(0, 80),
  }));

  useEffect(() => {
    let alive = true;
    communityTokenHash(token).then(hash => {
      if (!alive) return;
      setTokenHash(hash);
      try {
        // 로그인하러 갔다가 돌아온 경우에는 다시 풀지 않아도 바로 참여할 수 있게 연다.
        if (sessionStorage.getItem(COMMUNITY_RETURN_KEY) === hash) {
          sessionStorage.removeItem(COMMUNITY_RETURN_KEY);
          setUnlocked(true);
          requestAnimationFrame(() => sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
        }
      } catch { /* 저장소를 못 읽으면 제출 후에 연다. */ }
    }).catch(() => {});
    const open = () => {
      setUnlocked(true);
      rememberSolvedShare({ token, title: window.moonbleSharedQuiz?.title, questionCount: window.moonbleSharedQuiz?.questions?.length });
    };
    const close = () => setUnlocked(false);
    window.addEventListener('moonble:shared-quiz-submitted', open);
    window.addEventListener('moonble:shared-quiz-reset', close);
    return () => { alive = false; window.removeEventListener('moonble:shared-quiz-submitted', open); window.removeEventListener('moonble:shared-quiz-reset', close); };
  }, [token]);

  if (!unlocked) return null;
  return <div ref={sectionRef}>
    <CommunityFeed scope="share" token={token} viewer={viewer} variant="card" fixedAttachment={fixedAttachment} tokenHash={tokenHash} />
  </div>;
}

export function mountQuizCommunity(container, token) {
  if (!container || typeof token !== 'string' || !token) return null;
  const root = createRoot(container);
  root.render(<SharedQuizCommunity token={token} />);
  return root;
}
