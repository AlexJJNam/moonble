import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { encodeQuizThumbnailGif, getQuizThumbnailUrl } from './quiz-thumbnail.js';
import { GIF_ENABLED, GifButton, GifPickerPanel } from './community-gif.jsx';
import './quiz-thumbnail-picker.css';

export function useQuizThumbnailUrl(path, media = null) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let alive = true;
    setUrl('');
    if (path || media) getQuizThumbnailUrl(path, media).then(value => { if (alive) setUrl(value); }).catch(() => {});
    return () => { alive = false; };
  }, [path, media]);
  return url;
}

export function QuizThumbnailPicker({ path, file, onFileChange, onGifChange, onClear, disabled = false }) {
  const signedUrl = useQuizThumbnailUrl(path);
  const [localUrl, setLocalUrl] = useState('');
  const [gifOpen, setGifOpen] = useState(false);
  const gifButtonRef = useRef(null);
  useEffect(() => {
    if (!file) { setLocalUrl(''); return undefined; }
    const nextUrl = URL.createObjectURL(file);
    setLocalUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);
  const previewUrl = localUrl || signedUrl;

  return <section className="quiz-thumbnail-picker" aria-label="문제지 썸네일 설정">
    <div className="quiz-thumbnail-picker-copy">
      <strong>커스텀 썸네일</strong>
      <span>문제지에 표시할 썸네일을 설정해요.</span>
    </div>
    <div className="quiz-thumbnail-picker-controls">
      <div className={`quiz-thumbnail-picker-preview${previewUrl ? ' has-image' : ''}`}>
        {previewUrl ? <img src={previewUrl} alt="문제지 썸네일 미리보기" /> : <ImagePlus size={23} aria-hidden="true" />}
      </div>
      {GIF_ENABLED && <GifButton buttonRef={gifButtonRef} open={gifOpen} disabled={disabled} onToggle={() => setGifOpen(open => !open)} />}
      <label className="quiz-thumbnail-picker-select">
        <input type="file" accept="image/gif,image/jpeg,image/png" disabled={disabled} onChange={event => { onFileChange?.(event.target.files?.[0] || null); event.target.value = ''; }} />
        {path || file ? '이미지 파일 변경' : '이미지 파일 등록'}
      </label>
      {(path || file) && <button className="quiz-thumbnail-picker-clear" type="button" disabled={disabled} onClick={onClear}><Trash2 size={15} aria-hidden="true" />초기화</button>}
    </div>
    {gifOpen && <GifPickerPanel anchorRef={gifButtonRef} onClose={() => setGifOpen(false)} onPick={gif => { onGifChange?.(encodeQuizThumbnailGif(gif)); setGifOpen(false); }} />}
    <small className="quiz-thumbnail-picker-footnote">GIF 검색은 KLIPY에서 제공해요. 이미지 파일은 GIF·JPG·PNG, 5MB 이하로 등록할 수 있어요.</small>
  </section>;
}
