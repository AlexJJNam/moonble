/* "오늘 시장은?" 말풍선 스티커 효과: 그림이 하단 고정 버튼 위로 60% 이상 보이면, 말풍선이 크게 떠 있다가
 * 그림 위에 '탁' 붙듯이 내려앉습니다(한 번). 붙는 순간 살짝 눌렸다 튀고, 떠 있을 때 넓게 퍼졌던 그림자가 바짝 붙습니다.
 * JS·IntersectionObserver가 없거나 모션 감소 설정이면 애니메이션 없이 그대로 보입니다. */
(() => {
  'use strict';
  const bubble = document.querySelector('.intro-bubble');
  const art = bubble?.closest('.intro-art');
  if (!bubble || !art || !('IntersectionObserver' in window)) return;
  bubble.classList.add('intro-bubble--animated');
  const cta = document.querySelector('.sign-up');
  const observer = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= 0.6)) return;
    observer.disconnect();
    bubble.classList.add('is-stuck');
  }, { threshold: [0, 0.6], rootMargin: `0px 0px -${cta ? cta.offsetHeight : 0}px 0px` });
  observer.observe(art);
})();
