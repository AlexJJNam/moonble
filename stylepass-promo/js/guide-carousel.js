/* 안내 카드 캐러셀: 스와이프로 한 장씩 넘김, 처음·끝에서 멈춤(반복 없음).
 * 넘김은 CSS scroll-snap이 처리하고, 여기서는 점 표시·점 탭·키보드·PC 마우스 끌기를 맞춥니다. */
(() => {
  'use strict';
  const track = document.querySelector('.guide-track');
  if (!track) return;
  const cards = [...track.children];
  const dots = [...document.querySelectorAll('.guide-dot')];
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const last = cards.length - 1;
  let current = 0;
  const step = () => (cards.length > 1 ? cards[1].offsetLeft - cards[0].offsetLeft : track.clientWidth) || 1;
  const setActive = next => {
    if (next === current) return;
    current = next;
    dots.forEach((dot, i) => {
      dot.classList.toggle('is-active', i === current);
      dot.setAttribute('aria-current', i === current ? 'true' : 'false');
    });
  };
  const goTo = target => {
    const next = Math.min(last, Math.max(0, target));
    track.scrollTo({ left: next * step(), behavior: reduce.matches ? 'auto' : 'smooth' });
    setActive(next);
  };
  let frame = 0;
  track.addEventListener('scroll', () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => setActive(Math.min(last, Math.max(0, Math.round(track.scrollLeft / step())))));
  }, { passive: true });
  dots.forEach((dot, i) => dot.addEventListener('click', () => goTo(i)));
  track.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight') { event.preventDefault(); goTo(current + 1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); goTo(current - 1); }
  });
  // PC 브라우저: 마우스로 끌면 한 장씩 넘깁니다. 터치는 기본 스크롤을 그대로 씁니다.
  let dragX = null;
  let startLeft = 0;
  track.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    dragX = event.clientX;
    startLeft = track.scrollLeft;
    track.classList.add('is-dragging');
  });
  window.addEventListener('pointermove', event => {
    if (dragX === null) return;
    track.scrollLeft = startLeft - (event.clientX - dragX);
  });
  window.addEventListener('pointerup', event => {
    if (dragX === null) return;
    const dx = event.clientX - dragX;
    dragX = null;
    track.classList.remove('is-dragging');
    goTo(Math.abs(dx) > 40 ? current + (dx < 0 ? 1 : -1) : current);
  });
})();
