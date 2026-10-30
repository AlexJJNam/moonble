import React, { useEffect, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { getQuizThumbnailUrl } from './quiz-thumbnail.js';
import './quiz-thumbnail-picker.css';

export function useQuizThumbnailUrl(path) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let alive = true;
    setUrl('');
    if (path) getQuizThumbnailUrl(path).then(value => { if (alive) setUrl(value); }).catch(() => {});
    return () => { alive = false; };
  }, [path]);
  return url;
}

export function QuizThumbnailPicker({ path, file, onFileChange, onClear, disabled = false }) {
  const signedUrl = useQuizThumbnailUrl(path);
  const [localUrl, setLocalUrl] = useState('');
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
      <span>움직이는 GIF나 JPG, PNG를 등록할 수 있어요. 5MB 이하</span>
    </div>
    <div className="quiz-thumbnail-picker-controls">
      <div className={`quiz-thumbnail-picker-preview${previewUrl ? ' has-image' : ''}`}>
        {previewUrl ? <img src={previewUrl} alt="문제지 썸네일 미리보기" /> : <ImagePlus size={23} aria-hidden="true" />}
      </div>
      <label className="quiz-thumbnail-picker-select">
        <input type="file" accept="image/gif,image/jpeg,image/png" disabled={disabled} onChange={event => { onFileChange?.(event.target.files?.[0] || null); event.target.value = ''; }} />
        {path || file ? '이미지 변경' : '이미지 선택'}
      </label>
      {(path || file) && <button className="quiz-thumbnail-picker-clear" type="button" disabled={disabled} onClick={onClear}><Trash2 size={15} aria-hidden="true" />초기화</button>}
    </div>
  </section>;
}
