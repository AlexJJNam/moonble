// 카테고리 알약 버튼 묶음: 필터(전체 + 카테고리, 한 줄 가로 스크롤)와 고르기(여러 줄, 다시 누르면 해제)에 함께 쓴다.
import React from 'react';
import { QUIZ_CATEGORIES } from './quiz-categories.js';
import './category-chips.css';

export function CategoryChips({ value, onChange, label, allLabel = null, wrap = false, className = '' }) {
  return <div className={`mb-category-chips${wrap ? ' is-wrap' : ''}${className ? ` ${className}` : ''}`} role="group" aria-label={label}>
    {allLabel && <button type="button" aria-pressed={!value} onClick={() => onChange(null)}>{allLabel}</button>}
    {QUIZ_CATEGORIES.map(item => <button key={item.value} type="button" aria-pressed={value === item.value}
      onClick={() => onChange(allLabel ? item.value : value === item.value ? null : item.value)}>{item.label}</button>)}
  </div>;
}
