/* 뷰포트 진입 애니메이션: [data-reveal] 요소가 화면에 들어오면 아래에서 살짝 떠오르며 나타납니다(한 번만).
 * 같은 순간 함께 들어온 요소는 0.09초씩 차례로 나타납니다. 처음 화면에 조금이라도 보이는 요소는 바로 나타납니다.
 * 숨김 시작 여부는 index.html <head>의 js-reveal 클래스가 정합니다. */
(() => {
  'use strict';
  window.__revealReady = true;
  const root = document.documentElement;
  if (!root.classList.contains('js-reveal')) return;
  const STAGGER = 90;
  const MAX_DELAY = 360;
  const reveal = (el, order) => {
    el.style.setProperty('--reveal-delay', `${Math.min(order * STAGGER, MAX_DELAY)}ms`);
    el.classList.add('is-revealed');
    // 애니메이션이 끝나면 transform을 걷어 고정 요소·스크롤 계산에 영향이 없게 합니다.
    const done = event => {
      if (event.target !== el) return; // 자식 요소의 전환 이벤트는 무시
      el.removeEventListener('transitionend', done);
      el.removeAttribute('data-reveal');
      el.style.removeProperty('--reveal-delay');
    };
    el.addEventListener('transitionend', done);
  };
  const observer = new IntersectionObserver(entries => {
    let order = 0;
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      reveal(entry.target, order++);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0 });
  let first = 0;
  document.querySelectorAll('[data-reveal]').forEach(el => {
    if (el.getBoundingClientRect().top < window.innerHeight) reveal(el, first++);
    else observer.observe(el);
  });
  // 모션 감소 설정으로 바뀌면 남은 요소를 바로 보여 줍니다.
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  if (reduce.addEventListener) reduce.addEventListener('change', event => {
    if (!event.matches) return;
    observer.disconnect();
    root.classList.remove('js-reveal');
  });
})();
