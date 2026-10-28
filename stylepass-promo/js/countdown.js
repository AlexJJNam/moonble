/* 혜택 남은 시간 카운트다운
 * 마감 시각은 index.html의 data-deadline(한국시간 +09:00)에서 바꿉니다. 마감 후에는 종료 문구를 표시합니다. */
(() => {
  'use strict';
  const el = document.querySelector('.sign-up-countdown');
  if (!el) return;
  const deadline = Date.parse(el.dataset.deadline);
  if (Number.isNaN(deadline)) return;
  const pad = n => String(n).padStart(2, '0');
  let timer;
  const render = () => {
    const left = Math.max(0, Math.floor((deadline - Date.now()) / 1000));
    if (left === 0) {
      el.parentElement.textContent = '혜택 기간이 종료되었습니다';
      clearInterval(timer);
      return;
    }
    const d = Math.floor(left / 86400);
    const h = Math.floor(left % 86400 / 3600);
    const m = Math.floor(left % 3600 / 60);
    const s = left % 60;
    // 숫자만 빨간색(<b>)으로 표시합니다.
    el.innerHTML = `<b>${pad(d)}</b>일 <b>${pad(h)}</b>시간 <b>${pad(m)}</b>분 <b>${pad(s)}</b>초`;
  };
  render();
  timer = setInterval(render, 1000);
  // 앱이 백그라운드에서 돌아오면 바로 다시 계산합니다.
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
})();
