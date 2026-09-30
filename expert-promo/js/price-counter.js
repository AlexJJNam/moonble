(() => {
  'use strict';
  const card = document.querySelector('.price-card');
  const discount = card?.querySelector('[data-discount-number]');
  if (!discount) return;

  const TARGET = 55;
  // 1구간: 0 → SLOW_FROM을 FAST_DURATION(ms) 동안 일정한 속도로 빠르게 오릅니다.
  const SLOW_FROM = 40;
  const FAST_DURATION = 700;
  // 2구간: SLOW_FROM → BEAT_FROM을 SLOW_DURATION(ms) 동안 점점 느려지며 오릅니다.
  const BEAT_FROM = 50;
  const SLOW_DURATION = 1250;
  // 3구간: BEAT_FROM 다음 숫자부터 한 박자씩 오릅니다. 51, 52, 53, 54, 55 순서의 대기 시간(ms)입니다.
  // 52부터 간격이 점점 길어져 55에 가까울수록 더 천천히 멈춥니다.
  const BEATS = [280, 340, 430, 560, 760];

  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let frame;
  let timer;
  let observer;
  let started = false;
  let completed = false;

  const show = value => { discount.textContent = String(value); };
  const finish = () => {
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    observer?.disconnect();
    completed = true;
    show(TARGET);
  };
  const beat = value => {
    const index = value - BEAT_FROM - 1;
    timer = setTimeout(() => {
      if (completed) return;
      show(value);
      if (value >= TARGET) completed = true;
      else beat(value + 1);
    }, BEATS[index] ?? BEATS[BEATS.length - 1]);
  };
  const start = () => {
    if (started || completed) return;
    started = true;
    observer?.disconnect();
    if (motion.matches) return finish();
    show(0);
    let startTime;
    const tick = time => {
      if (completed) return;
      if (startTime === undefined) startTime = time;
      const elapsed = time - startTime;
      let value;
      if (elapsed < FAST_DURATION) {
        value = Math.floor(SLOW_FROM * elapsed / FAST_DURATION);
      } else {
        const progress = Math.min(1, (elapsed - FAST_DURATION) / SLOW_DURATION);
        const eased = 1 - Math.pow(1 - progress, 2);
        // 0.5를 더해 BEAT_FROM에 곡선 끝에서 머물지 않고 자연스럽게 도착하게 합니다.
        value = Math.min(BEAT_FROM, SLOW_FROM + Math.floor((BEAT_FROM - SLOW_FROM + 0.5) * eased));
      }
      show(value);
      if (value >= BEAT_FROM) beat(BEAT_FROM + 1);
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  };
  if (motion.matches) finish();
  else if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= 0.3)) start();
    }, { threshold: 0.3 });
    observer.observe(card);
  } else start();
  motion.addEventListener?.('change', event => { if (event.matches) finish(); });
})();
