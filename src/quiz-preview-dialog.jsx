// 문제지 미리보기: 문제지 카드 썸네일과 앞 문항 몇 개를 보여주고, 바로 풀러 갈 수 있다.
import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Heart, X } from 'lucide-react';
import { PaperPreview } from './paper-preview.jsx';
import { normalizeGif } from './community-gif.jsx';
import { formatRelativeDate } from './date-format.js';
import { cachedCommunityAvatarUrl, communityAvatarUrl } from './profile-avatar.js';
import { getQuizPreviewComment } from './quiz-preview-comments.js';
import { lockPageScroll } from './scroll-lock.js';
import './quiz-preview-dialog.css';

// 문제 목록을 PaperPreview가 쓰는 모양으로 바꾼다. 정답은 넣지 않는다.
export function previewPaperFromQuestions({ title, description = '', questions = [], thumbnailPath = null, thumbnailMedia = null }) {
  return {
    kind: 'custom',
    label: title || '문제지',
    description,
    count: questions.length,
    thumbnailPath,
    thumbnailMedia,
    samples: questions.slice(0, 6).map(question => ({ title: String(question.q || question.title || ''), options: Array.isArray(question.options) ? question.options.map(String) : [] })),
  };
}

function PreviewCommentAvatar({ name, path }) {
  const [image, setImage] = useState(() => ({ path, src: cachedCommunityAvatarUrl(path), loaded: false, failed: false }));
  useEffect(() => {
    let alive = true;
    if (!path) { setImage({ path: '', src: '', loaded: false, failed: false }); return () => { alive = false; }; }
    setImage({ path, src: cachedCommunityAvatarUrl(path), loaded: false, failed: false });
    communityAvatarUrl(path).then(url => {
      if (!alive) return;
      if (!url) { setImage({ path, src: '', loaded: false, failed: true }); return; }
      const preview = new Image();
      preview.onload = () => { if (alive) setImage({ path, src: url, loaded: true, failed: false }); };
      preview.onerror = () => { if (alive) setImage({ path, src: '', loaded: false, failed: true }); };
      preview.src = url;
    }).catch(() => { if (alive) setImage({ path, src: '', loaded: false, failed: true }); });
    return () => { alive = false; };
  }, [path]);
  const samePath = image.path === path;
  const src = samePath && image.loaded ? image.src : '';
  const loading = Boolean(path) && !src && !(samePath && image.failed);
  return <span className={`mb-preview-comment-avatar${loading ? ' is-loading' : ''}`} aria-hidden="true">{src ? <img src={src} alt="" decoding="async" onError={() => setImage({ path, src: '', loaded: false, failed: true })} /> : !loading ? [...(name || '문블')][0] : null}</span>;
}

function PreviewComment({ comment }) {
  const gif = normalizeGif(comment.gif);
  if (!comment.body && !gif) return null;
  const author = typeof comment.author_name === 'string' && comment.author_name.trim() ? comment.author_name : '문블 사용자';
  const likes = Number.isInteger(comment.like_count) && comment.like_count > 0 ? comment.like_count : 0;
  const date = comment.created_at ? formatRelativeDate(comment.created_at) : '';
  return <section className="mb-preview-comment" aria-label="대표 댓글">
    <h3>댓글</h3>
    <div className="mb-preview-comment-row">
      <PreviewCommentAvatar name={author} path={comment.author_avatar} />
      <div className="mb-preview-comment-content">
        <p className="mb-preview-comment-meta"><strong>{author}</strong>{date && <time dateTime={comment.created_at}>{date}</time>}</p>
        {comment.body && <p className="mb-preview-comment-body">{comment.body}</p>}
        {gif && <img className="mb-preview-comment-gif" src={gif.preview_url || gif.url} alt={gif.title ? `GIF: ${gif.title}` : 'GIF'} loading="lazy" decoding="async" />}
        {likes > 0 && <span className="mb-preview-comment-likes"><Heart size={13} aria-hidden="true" />{likes.toLocaleString('ko-KR')}</span>}
      </div>
    </div>
  </section>;
}

// load(): 위 모양의 문제지(또는 그 Promise). 대화상자 위에 다시 뜨므로 Esc는 이 창만 닫는다.
export function QuizPreviewDialog({ load, solveHref, onClose }) {
  const titleId = useId();
  const dialogRef = useRef(null);
  const loadRef = useRef(load);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [state, setState] = useState({ status: 'loading', paper: null, error: '' });
  const [comment, setComment] = useState(null);
  useEffect(() => {
    let alive = true;
    Promise.resolve().then(() => loadRef.current())
      .then(paper => { if (alive) setState({ status: 'ready', paper, error: '' }); })
      .catch(error => { if (alive) setState({ status: 'error', paper: null, error: error?.message || '미리보기를 불러오지 못했어요.' }); });
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    let alive = true;
    getQuizPreviewComment(solveHref).then(value => { if (alive) setComment(value); }).catch(() => {});
    return () => { alive = false; };
  }, [solveHref]);
  useEffect(() => {
    const unlock = lockPageScroll();
    const previous = document.activeElement;
    dialogRef.current?.focus({ preventScroll: true });
    const onKey = event => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onCloseRef.current();
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      unlock();
      window.removeEventListener('keydown', onKey, true);
      if (previous && typeof previous.focus === 'function') previous.focus({ preventScroll: true });
    };
  }, []);
  const paper = state.paper;
  const stop = event => event.stopPropagation();
  return createPortal(<div className="mb-preview-overlay" role="presentation" onClick={stop} onKeyDown={stop}
    onMouseDown={event => { event.stopPropagation(); if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialogRef} className="mb-preview-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
      <header className="mb-preview-head">
        <h2 id={titleId}>미리보기</h2>
        <button type="button" className="mb-preview-close" aria-label="닫기" onClick={onClose}><X size={19} aria-hidden="true" /></button>
      </header>
      {state.status === 'loading' && <div className="mb-preview-card is-loading" role="status"><span className="mb-sr-only">미리보기를 불러오는 중이에요.</span></div>}
      {state.status === 'error' && <p className="mb-preview-error" role="alert">{state.error}</p>}
      {paper && <>
        <article className="mb-preview-card">
          <PaperPreview paper={paper} />
          <div className="mb-preview-info">
            <strong>{paper.label}</strong>
            <span>{paper.count.toLocaleString('ko-KR')}문항{paper.description ? ` · ${paper.description}` : ''}</span>
          </div>
        </article>
        {paper.samples.length > 0 && <ol className="mb-preview-questions" aria-label="앞 문항">
          {paper.samples.slice(0, 3).map((sample, index) => <li key={`${sample.title}-${index}`}><b>Q{index + 1}</b><span>{sample.title}</span></li>)}
        </ol>}
        {comment && <PreviewComment comment={comment} />}
      </>}
      <footer className="mb-preview-actions">
        <button type="button" onClick={onClose}>닫기</button>
        <a className="is-primary" href={solveHref}>풀어보기</a>
      </footer>
    </section>
  </div>, document.body);
}

// "이 문제를 푸시겠어요?" 확인 + 아래 회색 캡션으로 미리보기. 문제 찾기 등에서 쓴다.
export function SolveConfirmDialog({ title, description, solveHref, loadPreview, onClose }) {
  const titleId = useId();
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [previewing, setPreviewing] = useState(false);
  useEffect(() => {
    if (previewing) return undefined;
    const unlock = lockPageScroll();
    const previous = document.activeElement;
    dialogRef.current?.querySelector('.is-primary')?.focus({ preventScroll: true });
    const onKey = event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onCloseRef.current(); } };
    window.addEventListener('keydown', onKey, true);
    return () => {
      unlock();
      window.removeEventListener('keydown', onKey, true);
      if (previous && typeof previous.focus === 'function') previous.focus({ preventScroll: true });
    };
  }, [previewing]);
  if (previewing) return <QuizPreviewDialog solveHref={solveHref} load={loadPreview} onClose={() => setPreviewing(false)} />;
  const stop = event => event.stopPropagation();
  return createPortal(<div className="mb-preview-overlay" role="presentation" onClick={stop} onKeyDown={stop}
    onMouseDown={event => { event.stopPropagation(); if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialogRef} className="mb-preview-dialog is-confirm" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
      <h2 id={titleId} className="mb-preview-confirm-title">{title}</h2>
      {description && <p className="mb-preview-confirm-copy">{description}</p>}
      <footer className="mb-preview-actions">
        <button type="button" onClick={onClose}>취소</button>
        <a className="is-primary" href={solveHref}>풀어보기</a>
      </footer>
      {loadPreview && <p className="mb-preview-caption"><span>어떤 문제인지 궁금하신가요?</span><button type="button" onClick={() => setPreviewing(true)}>미리보기</button></p>}
    </section>
  </div>, document.body);
}
