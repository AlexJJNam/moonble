import React from 'react';
import { BrandLogo } from './brand-logo.jsx';
import { useQuizThumbnailUrl } from './quiz-thumbnail-picker.jsx';
import './paper-preview.css';

export const BUILT_IN_PAPER_PREVIEWS = [
  { id: 'basics', kind: 'basics', label: 'GA4 핵심 개념', description: '이벤트부터 보고서까지, 분석의 기본기를 다져보세요.', count: 20, level: '기본', topics: '데이터 모델 · 이벤트 · 보고서', samples: [
    { title: 'GA4의 데이터 모델은 무엇인가요?', options: ['세션 기반', '페이지뷰 기반', '이벤트 기반'] },
    { title: 'GA4에서 전환을 설정하는 올바른 방법은?', options: ['이벤트를 전환으로 표시', '목표 만들기(UA 방식)', '세그먼트 저장'] },
    { title: 'DebugView를 활성화하는 방법은?', options: ['debug_mode 매개변수 설정', 'Google Analytics Debugger 사용', '서버에서만 확인'] },
    { title: '웹에 GA4를 설치할 때 최소로 필요한 것은?', options: ['측정 ID(G-....)', 'gtag.js 또는 GTM', 'UA- 추적 ID'] },
    { title: 'GA4↔BigQuery 연결로 가능한 일은?', options: ['원시 이벤트 조회', 'SQL 맞춤 분석', '실시간 보고서만 제공'] },
    { title: 'SPA에서 정확한 페이지뷰 측정 방법은?', options: ['라우트 변경 시 page_view 전송', '새로고침에만 의존', 'screen_view만 전송'] },
  ] },
];

export function PaperPreview({ paper, compact = false, style, badge = null }) {
  const samples = Array.isArray(paper?.samples) ? paper.samples : [];
  const label = paper?.label || '문제지';
  const count = Number(paper?.count) || 0;
  const customThumbnailUrl = useQuizThumbnailUrl(paper?.thumbnailPath, paper?.thumbnailMedia);

  return <div className={`paper-preview preview-${paper?.kind || 'custom'}${compact ? ' paper-preview--compact' : ''}`} style={style} aria-hidden="true">
    {customThumbnailUrl ? <img className="paper-preview-custom-image" src={customThumbnailUrl} alt="" /> : <div className={`preview-sheet${compact ? ' preview-sheet--compact' : ' preview-solver-sheet'}`}>
      {compact ? <>
        <div className="preview-sheet-brand"><BrandLogo decorative /></div>
        <div className="preview-sheet-title">{label}</div>
        {paper?.description && <div className="preview-sheet-subtitle">{paper.description}</div>}
        {samples.slice(0, 1).map((sample, index) => <div className="preview-question" key={`${sample.title}-${index}`}>
          <div><b>{String(index + 1).padStart(2, '0')}</b><strong>{sample.title}</strong></div>
          {(sample.options || []).slice(0, 2).map((option, optionIndex) => <span className="preview-option" key={`${option}-${optionIndex}`}><i />{option}</span>)}
        </div>)}
      </> : <>
        <div className="preview-sheet-brand"><BrandLogo decorative /></div>
        <div className="preview-solver-title">{label}</div>
        {paper?.description && <div className="preview-solver-description">{paper.description}</div>}
        <div className="preview-solver-grid">
          {samples.slice(0, 6).map((sample, index) => <article className="preview-solver-card" key={`${sample.title}-${index}`}>
            <div className="preview-solver-question">
              <span className="preview-solver-number">Q{index + 1}</span>
              <strong>{sample.title}</strong>
            </div>
            <div className="preview-solver-options">
              {(sample.options || []).slice(0, 4).map((option, optionIndex) => <span className="preview-solver-option" key={`${option}-${optionIndex}`}><i /><span>{option}</span></span>)}
            </div>
          </article>)}
        </div>
      </>}
    </div>}
    {badge || <span className="preview-count">{count}문항</span>}
  </div>;
}
