// 커뮤니티 GIF 검색·첨부(KLIPY). gif-picker-react는 GIF 버튼을 처음 누를 때 불러온다.
// KLIPY 요구사항: 검색창 "Search KLIPY" 표시(라이브러리가 설정), 미디어는 받은 URL 그대로 브라우저에서 직접 불러오고 파일을 저장하지 않는다.
import React, { Suspense, lazy, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ImagePlus, RefreshCw, X } from 'lucide-react';
import { supabase } from './supabase.js';

const KLIPY_APP_KEY = String(import.meta.env.VITE_KLIPY_APP_KEY || '').trim();
export const GIF_ENABLED = /^[A-Za-z0-9_-]{8,128}$/.test(KLIPY_APP_KEY);

const KLIPY_MEDIA_PREFIX = /^https:\/\/(static|static1|static2)\.klipy\.com\//;
const UNSAFE_URL_CHARS = /[\s"'<>\\`^{}|]/;
const COMMUNITY_MEDIA_BUCKET = 'community-media';
const COMMUNITY_MEDIA_MAX_BYTES = 5 * 1024 * 1024;
const UPLOAD_MEDIA_PATH = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(gif|jpg|png)$/i;
const UPLOAD_EXTENSIONS = { 'image/gif': 'gif', 'image/jpeg': 'jpg', 'image/png': 'png' };

// 서버(013 마이그레이션)와 같은 기준으로 KLIPY 미디어 URL만 허용한다. URL은 바꾸지 않는다.
export function isKlipyMediaUrl(url) {
  return typeof url === 'string' && url.length <= 2048 && KLIPY_MEDIA_PREFIX.test(url) && !UNSAFE_URL_CHARS.test(url);
}

// 저장된 크기로 최대 상자 안에 맞춘 표시 크기를 계산해, 로딩 전에도 자리를 잡아 화면이 밀리지 않게 한다.
function fitSize(width, height, maxWidth, maxHeight) {
  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

function toDimension(value) {
  const number = Math.round(Number(value));
  return Number.isFinite(number) && number >= 1 && number <= 4096 ? number : null;
}

// 선택기·서버 응답의 GIF를 저장 형식({ provider, id, url, preview_url, width, height, title })으로 정리한다.
export function normalizeGif(gif) {
  if (!gif || typeof gif !== 'object') return null;
  const provider = gif.provider ?? 'klipy';
  const id = String(gif.id ?? '');
  const url = gif.url ?? gif.imageUrl;
  const previewUrl = gif.preview_url ?? gif.preview?.imageUrl ?? null;
  const width = toDimension(gif.width);
  const height = toDimension(gif.height);
  const title = String(gif.title ?? gif.description ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 120);
  if (provider === 'upload') {
    if (!UPLOAD_MEDIA_PATH.test(id) || !width || !height || !supabase) return null;
    const publicUrl = supabase.storage.from(COMMUNITY_MEDIA_BUCKET).getPublicUrl(id).data?.publicUrl;
    if (!publicUrl) return null;
    return { provider: 'upload', id, url: publicUrl, preview_url: null, width, height, title: title || null };
  }
  if (provider !== 'klipy' || !/^[A-Za-z0-9_-]{1,120}$/.test(id) || !isKlipyMediaUrl(url) || !width || !height) return null;
  if (previewUrl != null && !isKlipyMediaUrl(previewUrl)) return null;
  return { provider: 'klipy', id, url, preview_url: previewUrl, width, height, title: title || null };
}

function makeUuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
    const random = Math.random() * 16 | 0;
    return (char === 'x' ? random : (random & 3 | 8)).toString(16);
  });
}

async function imageDimensions(file) {
  try {
    const bitmap = await createImageBitmap(file);
    const dimensions = { width: toDimension(bitmap.width) || 640, height: toDimension(bitmap.height) || 360 };
    bitmap.close?.();
    return dimensions;
  } catch {
    return { width: 640, height: 360 };
  }
}

async function uploadCommunityMedia(file) {
  if (!supabase) throw new Error('이미지를 올릴 수 있는 서비스 설정을 확인해 주세요.');
  if (!file || !Object.prototype.hasOwnProperty.call(UPLOAD_EXTENSIONS, file.type)) throw new Error('GIF, JPG, PNG 파일을 선택해 주세요.');
  if (file.size > COMMUNITY_MEDIA_MAX_BYTES) throw new Error('이미지는 5MB 이하로 등록해 주세요.');
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user?.id) throw new Error('로그인 상태를 확인해 주세요.');
  const id = `${user.id}/${makeUuid()}.${UPLOAD_EXTENSIONS[file.type]}`;
  const { error } = await supabase.storage.from(COMMUNITY_MEDIA_BUCKET).upload(id, file, {
    contentType: file.type,
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) throw error;
  const { width, height } = await imageDimensions(file);
  const media = normalizeGif({ provider: 'upload', id, width, height, title: file.name });
  if (!media) {
    await supabase.storage.from(COMMUNITY_MEDIA_BUCKET).remove([id]).catch(() => {});
    throw new Error('이미지를 확인하지 못했어요. 다른 파일을 선택해 주세요.');
  }
  return media;
}

export function CommunityMediaUploadButton({ disabled = false, onPick, onError, onBeforeOpen, compact = false }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  async function handleChange(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    try { onPick?.(await uploadCommunityMedia(file)); }
    catch (error) { onError?.(error.message || '이미지를 올리지 못했어요.'); }
    finally { setBusy(false); }
  }
  return <>
    <input ref={inputRef} className="mb-sr-only" type="file" accept="image/gif,image/jpeg,image/png" disabled={disabled || busy} onChange={handleChange} tabIndex={-1} />
    <button type="button" className={`quiz-community-upload-button${compact ? ' is-compact' : ''}`} aria-label="이미지 첨부" title="GIF, JPG, PNG 이미지 첨부" disabled={disabled || busy}
      onClick={() => { if (onBeforeOpen?.() === false) return; inputRef.current?.click(); }}>
      <ImagePlus size={18} aria-hidden="true" />{!compact && <span>{busy ? '올리는 중' : '이미지'}</span>}
    </button>
  </>;
}

// 대화상자·GIF 선택기가 겹쳐 열려도 Esc는 맨 위 층만 닫는다.
const escapeLayers = [];
export function useEscapeLayer(onEscape) {
  const handlerRef = useRef(onEscape);
  handlerRef.current = onEscape;
  useEffect(() => {
    const layer = {};
    escapeLayers.push(layer);
    const onKey = event => {
      if (event.key === 'Escape' && escapeLayers[escapeLayers.length - 1] === layer) { event.preventDefault(); handlerRef.current(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { escapeLayers.splice(escapeLayers.indexOf(layer), 1); document.removeEventListener('keydown', onKey); };
  }, []);
}

const LazyGifPicker = lazy(async () => {
  const [{ GifPicker, Theme }, { Klipy, ContentFilter, KlipyQuality }] = await Promise.all([
    import('gif-picker-react'),
    import('gif-picker-react/providers/klipy'),
  ]);
  // 전 연령 학습 서비스이므로 가장 엄격한 필터를 쓴다. 사용자 식별자(customer_id)는 보내지 않는다.
  const provider = Klipy(KLIPY_APP_KEY, {
    contentFilter: ContentFilter.HIGH,
    locale: 'kr',
    quality: KlipyQuality.MD,
    previewQuality: KlipyQuality.SM,
    showBranding: true,
  });
  return { default: props => <GifPicker provider={provider} theme={Theme.LIGHT} {...props} /> };
});

function useMobileLayout() {
  const query = '(max-width: 640px)';
  const [mobile, setMobile] = useState(() => window.matchMedia?.(query).matches ?? false);
  useEffect(() => {
    const list = window.matchMedia?.(query);
    if (!list) return undefined;
    const sync = () => setMobile(list.matches);
    list.addEventListener('change', sync);
    return () => list.removeEventListener('change', sync);
  }, []);
  return mobile;
}

const POPOVER_WIDTH = 360;
const POPOVER_HEIGHT = 420;

// PC는 GIF 버튼 옆 팝오버, 모바일은 화면 폭 하단 시트.
export function GifPickerPanel({ anchorRef, onPick, onClose }) {
  const mobile = useMobileLayout();
  const panelRef = useRef(null);
  const [position, setPosition] = useState(null);
  useEscapeLayer(onClose);

  useLayoutEffect(() => {
    if (mobile) return undefined;
    const place = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(POPOVER_WIDTH, window.innerWidth - 32);
      const height = Math.min(POPOVER_HEIGHT, window.innerHeight - 32);
      const left = Math.min(Math.max(16, rect.left), window.innerWidth - width - 16);
      const above = rect.top - height - 8 >= 16;
      const top = above ? rect.top - height - 8 : Math.min(rect.bottom + 8, window.innerHeight - height - 16);
      setPosition({ left, top, width, height });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [mobile, anchorRef]);

  useEffect(() => {
    if (mobile) return undefined;
    const onPointer = event => {
      if (panelRef.current?.contains(event.target) || anchorRef.current?.contains(event.target)) return;
      onClose();
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [mobile, anchorRef, onClose]);

  useEffect(() => {
    const anchor = anchorRef.current;
    return () => anchor?.focus?.({ preventScroll: true });
  }, [anchorRef]);

  function handleGifClick(gif) {
    const picked = normalizeGif(gif);
    if (picked) onPick(picked);
  }

  const picker = <Suspense fallback={<div className="quiz-community-gif-loading" role="status">GIF를 불러오는 중이에요</div>}>
    <LazyGifPicker width="100%" height="100%" autoFocusSearch={!mobile} onGifClick={handleGifClick} />
  </Suspense>;

  if (mobile) {
    return createPortal(<div className="quiz-community-gif-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={panelRef} className="quiz-community-gif-panel is-sheet" role="dialog" aria-modal="true" aria-label="GIF 검색">
        <header className="quiz-community-gif-head">
          <h2>GIF</h2>
          <button type="button" className="quiz-community-icon-button" aria-label="GIF 검색 닫기" onClick={onClose}><X size={20} aria-hidden="true" /></button>
        </header>
        <div className="quiz-community-gif-body">{picker}</div>
      </section>
    </div>, document.body);
  }
  return createPortal(<section ref={panelRef} className="quiz-community-gif-panel is-popover" role="dialog" aria-label="GIF 검색"
    style={position ? { left: position.left, top: position.top, width: position.width, height: position.height } : { visibility: 'hidden' }}>
    <div className="quiz-community-gif-body">{picker}</div>
  </section>, document.body);
}

export function GifButton({ open, onToggle, buttonRef, disabled }) {
  if (!GIF_ENABLED) return null;
  return <button ref={buttonRef} type="button" className={`quiz-community-gif-button${open ? ' is-open' : ''}`} aria-label="GIF 추가" aria-haspopup="dialog" aria-expanded={open} disabled={disabled} onClick={onToggle}>
    <span aria-hidden="true">GIF</span>
  </button>;
}

// 작성 중인 GIF 미리보기: X로 빼거나 다른 GIF로 바꿀 수 있다.
export function GifDraftPreview({ gif, onRemove, onReplace, compact = false }) {
  const media = normalizeGif(gif);
  if (!media) return null;
  const preview = media.provider === 'klipy' && isKlipyMediaUrl(media.preview_url) ? media.preview_url : media.url;
  const size = fitSize(gif.width, gif.height, compact ? 160 : 240, compact ? 120 : 180);
  return <div className={`quiz-community-gif-draft${compact ? ' is-compact' : ''}`}>
    <span className="quiz-community-gif-frame">
      <img src={preview} alt={gif.title ? `선택한 GIF: ${gif.title}` : '선택한 GIF'} width={size.width} height={size.height} style={{ width: size.width }} decoding="async" />
      <button type="button" className="quiz-community-gif-remove" aria-label="GIF 빼기" onClick={onRemove}><X size={16} aria-hidden="true" /></button>
    </span>
    {onReplace && media.provider === 'klipy' && <button type="button" className="quiz-community-text-button quiz-community-gif-replace" onClick={onReplace}><RefreshCw size={14} aria-hidden="true" />다른 GIF</button>}
  </div>;
}

// 등록된 글·댓글의 GIF. 저장된 KLIPY URL만 그대로 불러온다.
export function CommunityGif({ gif, size = 'post' }) {
  const media = normalizeGif(gif);
  if (!media) return null;
  const box = size === 'comment' ? fitSize(media.width, media.height, 200, 160) : fitSize(media.width, media.height, 360, 320);
  return <span className={`quiz-community-gif is-${size}`}>
    <img src={media.url} alt={media.title ? `${media.provider === 'upload' ? '이미지' : 'GIF'}: ${media.title}` : (media.provider === 'upload' ? '첨부 이미지' : 'GIF')} width={box.width} height={box.height} style={{ width: box.width }} loading="lazy" decoding="async" />
  </span>;
}
