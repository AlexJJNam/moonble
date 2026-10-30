// 화면 상위 탭: 문제지(나의 문제지·문제 서칭·커뮤니티)와 워크스페이스(시간표 설정·PRD)가 같은 모양을 쓴다.
import React from 'react';
import './section-tabs.css';

export function SectionTabs({ label, items, current, className = '' }) {
  return <nav className={`quiz-library-tabs${className ? ` ${className}` : ''}`} aria-label={label}>
    {items.map(item => <a key={item.value} href={item.href} aria-current={current === item.value ? 'page' : undefined}>{item.label}</a>)}
  </nav>;
}

const WORKSPACE_TABS = [
  { value: 'schedule', href: '#/schedule', label: '시간표 설정' },
  { value: 'prd', href: '#/list', label: 'PRD' },
];

export function WorkspaceTabs({ current, className = '' }) {
  return <SectionTabs label="워크스페이스 메뉴" items={WORKSPACE_TABS} current={current} className={className} />;
}
