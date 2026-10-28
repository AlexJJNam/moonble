/* 고정 크기 일러스트를 좁은 화면(폴드 접힘 등)에서 비율대로 축소합니다.
 * data-fit="기준폭": 요소 폭(또는 data-fit-gutter가 있으면 부모 폭 - gutter)이 기준폭보다 작을 때만 --fit을 1 미만으로 둡니다. */
(() => {
  'use strict';
  const items = [...document.querySelectorAll('[data-fit]')];
  if (!items.length) return;
  const sync = () => items.forEach(el => {
    const base = Number(el.dataset.fit);
    const gutter = el.dataset.fitGutter;
    const width = gutter ? el.parentElement.clientWidth - Number(gutter) : el.clientWidth;
    const scale = width > 0 ? Math.min(1, width / base) : 1;
    el.style.setProperty('--fit', scale.toFixed(4));
  });
  sync();
  window.addEventListener('resize', sync);
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(sync);
    items.forEach(el => observer.observe(el.dataset.fitGutter ? el.parentElement : el));
  }
})();
