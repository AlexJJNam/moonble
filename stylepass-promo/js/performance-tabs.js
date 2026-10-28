/* 성과 맛보기 탭: 이전 페이지의 Bootstrap 탭과 같은 동작을 Bootstrap 없이 구현하고, 흰 선택 배경이 미끄러지는 슬라이딩 효과를 더했습니다. */
(() => {
  'use strict';
  const tabs = [...document.querySelectorAll('.result-tab [role="tab"]')];
  if (!tabs.length) return;
  const bar = tabs[0].parentElement;
  const select = tab => {
    tabs.forEach(item => {
      const on = item === tab;
      item.classList.toggle('is-active', on);
      item.setAttribute('aria-selected', on ? 'true' : 'false');
      item.tabIndex = on ? 0 : -1;
      document.getElementById(item.getAttribute('aria-controls')).hidden = !on;
    });
    // 흰 선택 배경을 선택한 탭 쪽으로 미끄러뜨립니다(슬라이딩 탭).
    bar.style.setProperty('--tab-index', tabs.indexOf(tab));
  };
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', event => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      event.preventDefault();
      const next = tabs[(i + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      select(next);
      next.focus();
    });
  });
})();
