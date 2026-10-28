/* TOP 15: 5장을 같은 자리에서 전환 효과 없이 즉시 교체(매치컷)해 "15"를 강조합니다.
 * 엑스퍼트 할인율 카운트업과 같은 리듬: 첫 바퀴는 빠르게, 둘째 바퀴는 한 박자씩 점점 느려지다가
 * 첫 장(검정 15)에서 멈춥니다. 반복하지 않습니다.
 * 화면 밖이거나 앱이 백그라운드일 때는 잠시 멈췄다가 이어서 돌고, 모션 감소 설정에서는 첫 장에 고정합니다. */
(() => {
  'use strict';
  // 각 컷 전 대기 시간(ms). 장 수(5)의 배수여야 마지막에 첫 장으로 돌아옵니다.
  // 뒤 5개는 엑스퍼트 할인율 51→55 박자(BEATS)와 같습니다.
  const DELAYS = [90, 100, 120, 150, 200, 280, 340, 430, 560, 760];
  const stage = document.querySelector('.top15-stage');
  if (!stage) return;
  const shots = [...stage.querySelectorAll('.top15-shot')];
  if (shots.length < 2) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  let index = 0;
  let step = 0;
  let timer = null;
  let inView = true;
  let ready = false;
  const show = next => {
    shots[index].classList.remove('is-active');
    index = next;
    shots[index].classList.add('is-active');
  };
  const finished = () => step >= DELAYS.length;
  const stop = () => { clearTimeout(timer); timer = null; };
  const schedule = () => {
    timer = setTimeout(() => {
      timer = null;
      step += 1;
      show(finished() ? 0 : (index + 1) % shots.length);
      if (!finished()) sync();
    }, DELAYS[step]);
  };
  const sync = () => {
    if (reduce.matches) { step = DELAYS.length; stop(); if (index !== 0) show(0); return; }
    const run = ready && !finished() && inView && !document.hidden;
    if (run && !timer) schedule();
    if (!run && timer) stop();
  };
  // 모든 장을 미리 디코딩해 교체 순간 빈 화면이 보이지 않게 합니다.
  Promise.all(shots.map(shot => (shot.decode ? shot.decode() : Promise.resolve()).catch(() => {})))
    .then(() => { ready = true; sync(); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      inView = entries.some(entry => entry.isIntersecting);
      sync();
    }).observe(stage);
  }
  document.addEventListener('visibilitychange', sync);
  if (reduce.addEventListener) reduce.addEventListener('change', sync);
})();
