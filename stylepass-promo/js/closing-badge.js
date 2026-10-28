/* 마지막 섹션 체크 뱃지: 엑스퍼트 '라씨의 선택' 따봉 아이콘과 같은 동작입니다.
 * 카드가 화면에 22% 이상 보이면 튀어 오르며 나타나고(한 번), 보이는 동안만 아이콘이 주기적으로 튀며 흔들립니다.
 * JS나 IntersectionObserver가 없으면 애니메이션 없이 그대로 보입니다. */
(() => {
  'use strict';
  const badge = document.querySelector('.closing-check');
  const card = badge?.closest('.closing-card');
  if (!badge || !card || !('IntersectionObserver' in window)) return;
  badge.classList.add('closing-check--animated');
  new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const visible = entry.isIntersecting && entry.intersectionRatio >= 0.22;
      badge.classList.toggle('is-in-view', visible);
      if (visible) badge.classList.add('is-revealed');
    });
  }, { threshold: [0, 0.22], rootMargin: '0px 0px -80px 0px' }).observe(card);
})();
