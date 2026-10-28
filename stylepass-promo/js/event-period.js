/* 혜택 기간 리본 (expert-promo와 동일 동작)
 * 원래 자리를 지나 스크롤하면 화면 상단에 고정되며 가로로 펼쳐지고 안내 문구가 위로 롤링됩니다.
 * 고정 4초 후 닫기 버튼이 나타나고, 닫으면 이번 방문 동안 다시 고정하지 않습니다. */
(() => {
  'use strict';
  const periodSlot = document.querySelector('.event-period-slot');
  const period = periodSlot?.querySelector('.event-period');
  if (!period) return;
  let pinned = false;
  let dismissed = false;
  let closeTimer;
  const closeButton = period.querySelector('.period-close');
  const restorePeriod = () => {
    clearTimeout(closeTimer);
    closeButton.hidden = true;
    period.classList.remove('is-sticky', 'is-expanded');
    period.style.removeProperty('--period-start-width');
    periodSlot.append(period);
    pinned = false;
  };
  const syncPeriod = () => {
    const rect = periodSlot.getBoundingClientRect();
    // 자리가 화면에 그려지지 않은 상태(높이 0)에서는 고정하지 않습니다.
    const shouldPin = !dismissed && rect.height > 0 && rect.top <= 0;
    if (shouldPin === pinned) return;
    if (shouldPin) {
      pinned = true;
      period.style.setProperty('--period-start-width', `${rect.width}px`);
      document.body.append(period);
      period.classList.add('is-sticky');
      // 시작 폭을 먼저 적용한 뒤 화면 폭으로 펼칩니다.
      void period.offsetWidth;
      period.classList.add('is-expanded');
      closeTimer = setTimeout(() => { closeButton.hidden = false; }, 4000);
    } else {
      restorePeriod();
    }
  };
  closeButton.addEventListener('click', () => {
    // 이번 방문 동안 고정 리본을 닫고, 원래 자리의 기간 표시는 유지합니다.
    dismissed = true;
    restorePeriod();
  });
  window.addEventListener('scroll', syncPeriod, { passive: true });
  window.addEventListener('resize', syncPeriod);
  window.addEventListener('pageshow', syncPeriod);
  syncPeriod();
})();
