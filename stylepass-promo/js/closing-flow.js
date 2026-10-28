/* 마지막 섹션 흐름도(N개 종목스타일 조합 → 22개 파워스타일 완성): 흐름도가 하단 고정 버튼 위로 60% 이상 보이면
 * 왼쪽부터 원 → 화살표 → 박스 순서로 0.28초 간격을 두고, 왼쪽에서 살짝 미끄러지며 부드럽게 나타납니다(한 번).
 * JS·IntersectionObserver가 없거나 모션 감소 설정이면 애니메이션 없이 그대로 보입니다. */
(() => {
  'use strict';
  const flow = document.querySelector('.closing-flow');
  if (!flow || !('IntersectionObserver' in window)) return;
  flow.classList.add('closing-flow--animated');
  const cta = document.querySelector('.sign-up');
  const observer = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= 0.6)) return;
    observer.disconnect();
    flow.classList.add('is-shown');
  }, { threshold: [0, 0.6], rootMargin: `0px 0px -${cta ? cta.offsetHeight : 0}px 0px` });
  observer.observe(flow);
})();
