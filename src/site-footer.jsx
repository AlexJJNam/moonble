import React from 'react';
import './site-footer.css';

export function SiteFooter() {
  return <footer className="site-footer no-print">
    <nav aria-label="서비스 안내">
      <a href="./privacy.html">개인정보 처리방침</a>
      <a href="./terms.html">이용 안내</a>
      <a href="https://github.com/AlexJJNam/moonble/issues" target="_blank" rel="noopener noreferrer">의견 보내기<span className="mb-sr-only"> (GitHub, 새 창)</span></a>
    </nav>
    <p>Moonble · 개인 운영 서비스</p>
    <small>© {new Date().getFullYear()} Moonble</small>
  </footer>;
}
