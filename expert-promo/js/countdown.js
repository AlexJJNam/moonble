(() => {
  'use strict';
  const timer = document.getElementById('countdown');
  const bar = document.querySelector('.countdown-bar');
  const deadline = Date.parse(window.EXPERT_PROMO_CONFIG.deadline);
  const pad = value => String(value).padStart(2, '0');
  const group = (value, unit) => `<span class="cd-group"><span class="cd-num">${value}</span><span class="cd-unit">${unit}</span></span>`;
  const updateCountdown = () => {
    const remaining = deadline - Date.now();
    if (remaining <= 0 || !Number.isFinite(remaining)) {
      timer.textContent = '종료됨';
      return;
    }
    const seconds = Math.floor(remaining / 1000);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor(seconds % 86400 / 3600);
    const minutes = Math.floor(seconds % 3600 / 60);
    timer.innerHTML = group(days, '일') + group(pad(hours), '시간') + group(pad(minutes), '분') + group(pad(seconds % 60), '초');
  };
  const applyInset = () => {
    document.documentElement.style.setProperty('--countdown-inset', `${bar.getBoundingClientRect().height}px`);
  };
  // Footer padding reserves space inside its own background, without a gap below it.
  const scrollPosition = () => Math.max(0, Math.min(window.scrollY,
    Math.max(0, document.documentElement.scrollHeight - window.innerHeight)));
  let previousY = scrollPosition();
  let direction = 0;
  let travel = 0;
  const setBarHidden = hidden => {
    bar.classList.toggle('is-scroll-hidden', hidden);
    if (hidden) bar.setAttribute('aria-hidden', 'true');
    else bar.removeAttribute('aria-hidden');
  };
  window.addEventListener('scroll', () => {
    const y = scrollPosition();
    const delta = y - previousY;
    previousY = y;
    if (y <= 10) {
      travel = 0;
      direction = 0;
      setBarHidden(false);
      return;
    }
    if (!delta) return;
    const nextDirection = Math.sign(delta);
    travel = nextDirection === direction ? travel + Math.abs(delta) : Math.abs(delta);
    direction = nextDirection;
    // Ignore tiny touch/trackpad movement so the bar does not flicker.
    if (travel >= 8) {
      setBarHidden(direction > 0);
      travel = 0;
    }
  }, { passive: true });
  window.addEventListener('pageshow', () => {
    previousY = scrollPosition();
    travel = 0;
    direction = 0;
    setBarHidden(false);
  });
  updateCountdown();
  applyInset();
  setInterval(() => { updateCountdown(); applyInset(); }, 1000);
  if ('ResizeObserver' in window) new ResizeObserver(applyInset).observe(bar);
  window.addEventListener('resize', applyInset);
  window.addEventListener('pageshow', () => { updateCountdown(); applyInset(); });
  if (document.fonts) document.fonts.ready.then(applyInset);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) updateCountdown();
  });
})();
