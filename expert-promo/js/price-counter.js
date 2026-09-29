(() => {
  'use strict';
  const card = document.querySelector('.price-card');
  const discount = card?.querySelector('[data-discount-number]');
  if (!discount) return;

  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const duration = 1600;
  let frame;
  let observer;
  let started = false;
  let completed = false;

  const render = progress => {
    const eased = 1 - Math.pow(1 - progress, 3);
    // Keep the final discount value for the last frame.
    discount.textContent = progress === 1 ? '55' : String(Math.min(54, Math.floor(55 * eased)));
  };
  const finish = () => {
    cancelAnimationFrame(frame);
    observer?.disconnect();
    completed = true;
    render(1);
  };
  const start = () => {
    if (started || completed) return;
    started = true;
    observer?.disconnect();
    if (motion.matches) return finish();
    render(0);
    let startTime;
    const tick = time => {
      if (completed) return;
      if (startTime === undefined) startTime = time;
      const progress = Math.min(1, (time - startTime) / duration);
      render(progress);
      if (progress < 1) frame = requestAnimationFrame(tick);
      else completed = true;
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
