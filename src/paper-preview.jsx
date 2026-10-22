import React from 'react';
import { BrandLogo } from './brand-logo.jsx';

export const BUILT_IN_PAPER_PREVIEWS = [
  { id: 'basics', kind: 'basics', label: 'GA4 핵심 개념', description: '이벤트부터 보고서까지, 분석의 기본기를 다져보세요.', count: 20, level: '기본', topics: '데이터 모델 · 이벤트 · 보고서', samples: [
    { title: 'GA4의 데이터 모델은 무엇인가요?', options: ['세션 기반', '페이지뷰 기반', '이벤트 기반'] },
    { title: 'DebugView를 활성화하는 방법은?', options: ['debug_mode 매개변수 설정', 'Google Analytics Debugger 사용'] },
  ] },
];

export function PaperPreview({ paper, compact = false, style }) {
  const samples = Array.isArray(paper?.samples) ? paper.samples : [];
  const label = paper?.label || '문제지';
  const count = Number(paper?.count) || 0;

  return <div className={`paper-preview preview-${paper?.kind || 'custom'}${compact ? ' paper-preview--compact' : ''}`} style={style} aria-hidden="true">
    <div className="preview-sheet">
      <div className="preview-sheet-brand"><BrandLogo decorative /></div>
      <div className="preview-sheet-title">{label}</div>
      <div className="preview-sheet-subtitle">개념을 확인하는 작은 시작</div>
      {samples.slice(0, compact ? 1 : 2).map((sample, index) => <div className="preview-question" key={`${sample.title}-${index}`}>
        <div><b>{String(index + 1).padStart(2, '0')}</b><strong>{sample.title}</strong></div>
        {(sample.options || []).slice(0, compact ? 2 : 3).map((option, optionIndex) => <span className="preview-option" key={`${option}-${optionIndex}`}><i />{option}</span>)}
      </div>)}
    </div>
    <span className="preview-count">{count}문항</span>
  </div>;
}
