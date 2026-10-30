// 화면 상위 탭: 문제지(나의 문제지·문제 서칭·커뮤니티)와 워크스페이스(시간표 설정·PRD)가 같은 모양을 쓴다.
import React from 'react';
import './section-tabs.css';

export function SectionTabs({ label, items, current, className = '' }) {
  return <nav className={`quiz-library-tabs${className ? ` ${className}` : ''}`} aria-label={label}>
    {items.map(item => <a key={item.value} href={item.href} aria-current={current === item.value ? 'page' : undefined}
      onClick={item.onSelect ? event => { event.preventDefault(); item.onSelect(); } : undefined}>{item.label}</a>)}
  </nav>;
}

const WORKSPACE_TABS = [
  { value: 'schedule', href: '#/schedule', label: '시간표 설정' },
  { value: 'prd', href: '#/list', label: 'PRD' },
];

// 문제 생성하기: 문제 생성(프롬프트) · 문제 등록(파일). 같은 #create 화면 안의 단계를 바꾼다.
export function CreatorTabs({ current, onSelect, className = '' }) {
  const items = [
    { value: 'create', href: '#create', label: '문제 생성', onSelect: () => onSelect?.('create') },
    { value: 'upload', href: '#create', label: '문제 등록', onSelect: () => onSelect?.('upload') },
  ];
  return <SectionTabs label="문제 생성 메뉴" items={items} current={current} className={className} />;
}

export function WorkspaceTabs({ current, className = '' }) {
  return <SectionTabs label="워크스페이스 메뉴" items={WORKSPACE_TABS} current={current} className={className} />;
}
