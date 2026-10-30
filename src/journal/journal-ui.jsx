// 일지·회고 화면 조각: 자동 높이 입력란, 기분, 태그, 달력, 시트, 읽기 전용 미리보기.
import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { lockPageScroll } from '../scroll-lock.js';
import { BODY_COPY, LIMITS, MOODS, QUESTIONS, monthGrid, monthLabel, moodOf, normalizeTag, weekdayLabel } from './journal-model.js';

// 글이 길어지면 같이 늘어나는 입력란. 높이를 다시 잴 때 화면이 튀지 않게 스크롤 위치를 지킨다.
export function AutoTextarea({ value, onChange, className = '', minRows = 2, ...props }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const scrollY = window.scrollY;
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight}px`;
    if (window.scrollY !== scrollY) window.scrollTo(window.scrollX, scrollY);
  }, [value]);
  return <textarea ref={ref} rows={minRows} className={`jr-textarea ${className}`} value={value} onChange={event => onChange(event.target.value)} {...props} />;
}

// 오늘의 기분: 다시 누르면 선택이 풀린다.
export function MoodPicker({ value, onChange }) {
  return <div className="jr-moods" role="radiogroup" aria-label="오늘의 기분">
    {MOODS.map(mood => <button key={mood.value} type="button" role="radio" aria-checked={value === mood.value} className={value && value !== mood.value ? 'is-dim' : ''}
      onClick={() => onChange(value === mood.value ? null : mood.value)}>
      <span aria-hidden="true">{mood.emoji}</span><small>{mood.label}</small>
    </button>)}
  </div>;
}

// 태그: Enter·쉼표로 추가, 비어 있을 때 Backspace로 마지막 태그 삭제. 자주 쓴 태그는 눌러서 추가.
export function TagEditor({ tags, suggestions = [], onChange }) {
  const [draft, setDraft] = useState('');
  const inputId = useId();
  const add = raw => {
    const tag = normalizeTag(raw);
    setDraft('');
    if (!tag || tags.includes(tag) || tags.length >= LIMITS.tags) return;
    onChange([...tags, tag]);
  };
  const rest = suggestions.filter(tag => !tags.includes(tag)).slice(0, 8);
  return <div className="jr-tags">
    <div className="jr-tag-row">
      {tags.map(tag => <span key={tag} className="jr-tag">#{tag}<button type="button" aria-label={`${tag} 태그 삭제`} onClick={() => onChange(tags.filter(item => item !== tag))}><X size={12} aria-hidden="true" /></button></span>)}
      {tags.length < LIMITS.tags && <>
        <label className="mb-sr-only" htmlFor={inputId}>태그 추가</label>
        <input id={inputId} className="jr-tag-input" value={draft} maxLength={LIMITS.tag + 1} placeholder={tags.length ? '태그 추가' : '태그를 입력하고 Enter'} enterKeyHint="done"
          onChange={event => { const value = event.target.value; if (/[,\n]/.test(value)) add(value.replace(/[,\n]/g, '')); else setDraft(value); }}
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); add(draft); }
            else if (event.key === 'Backspace' && !draft && tags.length) onChange(tags.slice(0, -1));
          }}
          onBlur={() => { if (draft.trim()) add(draft); }} />
      </>}
    </div>
    {rest.length > 0 && <div className="jr-tag-suggest" aria-label="자주 쓴 태그">
      {rest.map(tag => <button key={tag} type="button" onClick={() => add(tag)}><Plus size={12} aria-hidden="true" />{tag}</button>)}
    </div>}
  </div>;
}

// 달력: 일지를 쓴 날은 작은 점, 오늘은 파란 글자, 고른 날은 #404040 동그라미.
export function JournalCalendar({ month, marks, selected, today, onSelect, onMonth, label = '일지 달력' }) {
  return <div className="jr-calendar" aria-label={label}>
    <div className="jr-calendar-head">
      <button type="button" aria-label="이전 달" onClick={() => onMonth(-1)}><ChevronLeft size={18} aria-hidden="true" /></button>
      <strong aria-live="polite">{monthLabel(month)}</strong>
      <button type="button" aria-label="다음 달" onClick={() => onMonth(1)}><ChevronRight size={18} aria-hidden="true" /></button>
    </div>
    <div className="jr-calendar-grid">
      {['월', '화', '수', '목', '금', '토', '일'].map(day => <span key={day} aria-hidden="true">{day}</span>)}
      {monthGrid(month).flat().map(key => {
        if (key.slice(0, 7) !== month.slice(0, 7)) return <i key={key} aria-hidden="true" />;
        const mark = marks.get(key);
        const mood = mark?.mood ? moodOf(mark.mood) : null;
        return <button key={key} type="button" className={`${key === today ? 'is-today' : ''}${mark ? ' has-entry' : ''}`} aria-pressed={key === selected}
          aria-label={`${Number(key.slice(8))}일 ${weekdayLabel(key)}요일${mark ? `, 일지 있음${mood ? ` · ${mood.label}` : ''}` : ''}`} onClick={() => onSelect(key)}>
          <span>{Number(key.slice(8))}</span>{mark && <i aria-hidden="true" />}
        </button>;
      })}
    </div>
  </div>;
}

// 시트: 모바일은 아래에서 올라오는 바텀시트, PC는 가운데 창. Esc·바깥 누르기로 닫는다.
export function Sheet({ title, onClose, children, footer = null, wide = false }) {
  const titleId = useId();
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const unlock = lockPageScroll();
    const opener = document.activeElement;
    ref.current?.focus({ preventScroll: true });
    const onKey = event => { if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); } };
    document.addEventListener('keydown', onKey);
    return () => { unlock(); document.removeEventListener('keydown', onKey); if (opener instanceof HTMLElement && opener.isConnected && opener.tagName === 'BUTTON') opener.focus({ preventScroll: true }); };
  }, []);
  return createPortal(<div className="jr-sheet-layer" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={ref} className={`jr-sheet${wide ? ' is-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
      <header><h2 id={titleId}>{title}</h2><button type="button" className="jr-icon-button" aria-label="닫기" onClick={onClose}><X size={20} aria-hidden="true" /></button></header>
      <div className="jr-sheet-body">{children}</div>
      {footer && <footer>{footer}</footer>}
    </div>
  </div>, document.body);
}

// 읽기 전용 일지(주간·월간 회고를 쓰며 참고하는 용도)
export function EntryPreview({ entry }) {
  const mood = moodOf(entry.mood);
  const answers = (QUESTIONS[entry.kind] || []).filter(question => String(entry.answers[question.key] || '').trim());
  return <div className="jr-preview">
    {(mood || entry.title) && <p className="jr-preview-title">{mood && <span aria-label={mood.label}>{mood.emoji}</span>}{entry.title && <strong>{entry.title}</strong>}</p>}
    {entry.body.trim() && <section><h4>{BODY_COPY[entry.kind].label}</h4><p>{entry.body}</p></section>}
    {answers.map(question => <section key={question.key}><h4>{question.label}</h4><p>{entry.answers[question.key]}</p></section>)}
    {entry.tags.length > 0 && <p className="jr-preview-tags">{entry.tags.map(tag => <span key={tag}>#{tag}</span>)}</p>}
  </div>;
}
