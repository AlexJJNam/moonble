/* Large-screen fit: 갤럭시 폴드 펼침·태블릿처럼 짧은 변이 560px 이상인 기기에서
 * 480px 디자인을 화면 폭에 맞춰 확대합니다. 모바일 브라우저와 WebView만 viewport meta를
 * 따르므로 PC 브라우저와 가로로 눕힌 일반 폰에는 영향이 없습니다. */
(() => {
  'use strict';
  const meta = document.querySelector('meta[name="viewport"]');
  if (!meta || !window.screen) return;
  const DESIGN_WIDTH = 480;
  const MIN_SHORT_SIDE = 560;
  const MAX_SCALE = 1.85;
  const BASE = 'initial-scale=1, viewport-fit=cover';
  const deviceWidth = () => {
    const { width, height } = window.screen;
    // iOS keeps screen.width in portrait; use the long side in landscape.
    const angle = screen.orientation ? screen.orientation.angle : (window.orientation || 0);
    const landscape = Math.abs(angle) === 90;
    return /iP(hone|ad|od)/.test(navigator.userAgent) && landscape ? Math.max(width, height) : width;
  };
  const apply = () => {
    const width = deviceWidth();
    const shortSide = Math.min(screen.width, screen.height);
    let content = `width=device-width, ${BASE}`;
    let fitted = false;
    if (shortSide >= MIN_SHORT_SIDE && width > DESIGN_WIDTH) {
      const scale = Math.min(width / DESIGN_WIDTH, MAX_SCALE);
      const layoutWidth = Math.max(DESIGN_WIDTH, Math.round(width / scale));
      content = `width=${layoutWidth}, viewport-fit=cover`;
      // 기기 반올림으로 1px 남는 틈을 막기 위해 폭에 딱 맞출 때는 페이지를 화면 전체로 채웁니다.
      fitted = layoutWidth === DESIGN_WIDTH;
    }
    if (meta.getAttribute('content') !== content) meta.setAttribute('content', content);
    document.documentElement.classList.toggle('is-fit-width', fitted);
  };
  apply();
  // 폴드를 접거나 펼칠 때, 화면을 돌릴 때 다시 계산합니다.
  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', apply);
})();
