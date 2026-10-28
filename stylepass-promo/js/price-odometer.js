/* 혜택가 숫자 롤링: pocketfolio 총자산 금액의 odometer 효과(odo())를 그대로 옮겼습니다.
 * 숫자 자리마다 0~9 띠를 두고, 0에서 목표 숫자까지 1초 동안 굴러 올라갑니다(자리마다 0.045초씩 늦게 출발).
 * 숫자 전체가 하단 고정 버튼 위로 다 보이는 순간 한 번만 시작합니다. 그 전에는 0에서 멈춰 있습니다.
 * 다 굴러가면 원래 글자로 되돌려, 멈춘 뒤 모습이 정적 숫자와 픽셀 단위까지 같습니다.
 * JS·IntersectionObserver가 없거나 모션 감소 설정이면 숫자를 그대로 보여 줍니다. */
(() => {
  'use strict';
  const el = document.querySelector('[data-odometer]');
  if (!el || !('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  // pocketfolio odo() 그대로: 화면 낭독기는 sr-only 문구만 읽습니다.
  function odo(text){let k=0;const slots=[...text].map(ch=>/\d/.test(ch)?`<span class="odo-d"><span class="odo-s" style="--n:${ch};--k:${k++}">${'0123456789'.split('').map(d=>`<span>${d}</span>`).join('')}</span></span>`:`<span class="odo-c">${ch}</span>`).join('');
    return `<span class="odo"><span class="sr-only">${text}</span><span class="odo-in" aria-hidden="true">${slots}</span></span>`;}
  const text = el.textContent.trim();
  el.classList.add('odo-wait');
  el.innerHTML = odo(text);
  const strips = el.querySelectorAll('.odo-s');
  strips[strips.length - 1].addEventListener('animationend', () => { el.textContent = text; }, { once: true });
  const cta = document.querySelector('.sign-up');
  const observer = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= 0.99)) return;
    observer.disconnect();
    el.classList.remove('odo-wait');
  }, { threshold: [0, 0.99], rootMargin: `0px 0px -${cta ? cta.offsetHeight : 0}px 0px` });
  observer.observe(el);
})();
