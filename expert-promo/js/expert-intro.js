/* 전문가 소개 팝업: 카드의 사진을 누르면 서버의 소개 PNG를 전체 화면 시트로 보여 줍니다. */
(() => {
  'use strict';
  const config = window.EXPERT_PROMO_CONFIG;
  const modal = document.getElementById('expert-intro');
  if (!config || !modal) return;

  const sheet = modal.querySelector('.intro-sheet');
  const body = modal.querySelector('.intro-body');
  const nameSlot = modal.querySelector('[data-intro-name]');
  const status = modal.querySelector('.intro-status');
  const message = modal.querySelector('.intro-message');
  const retry = modal.querySelector('.intro-retry');
  const image = modal.querySelector('.intro-image');
  const cta = modal.querySelector('.intro-cta');
  const ctaName = modal.querySelector('[data-intro-cta-name]');
  const closeButton = modal.querySelector('.intro-close');
  const progressBar = modal.querySelector('.intro-progress span');
  const progressTrack = modal.querySelector('.intro-progress');
  let tickTimer;
  const loaded = new Set();
  let current = null;
  let opener = null;
  let hideTimer;

  // 소개 이미지를 내려 본 비율만큼 초록 막대를 채웁니다.
  let progressFrame;
  let reachedEnd = false;
  const updateProgress = () => {
    progressFrame = null;
    if (!progressBar) return;
    const max = body.scrollHeight - body.clientHeight;
    const ratio = image.hidden || max <= 0 ? 0 : Math.min(1, Math.max(0, body.scrollTop / max));
    progressBar.style.transform = `scaleX(${ratio})`;
    // 100%인 동안만 버튼 글자를 연초록으로 바꿉니다.
    progressTrack?.classList.toggle('is-complete', ratio >= 0.999);
    // 끝에 닿으면 오른쪽 끝 '틱!'을 한 번 보여 줍니다. 95% 아래로 올렸다가 다시 닿으면 또 보입니다.
    if (ratio >= 0.999 && !reachedEnd) {
      reachedEnd = true;
      if (progressTrack) {
        clearTimeout(tickTimer);
        progressTrack.classList.remove('is-tick');
        void progressTrack.offsetWidth;
        progressTrack.classList.add('is-tick');
        tickTimer = setTimeout(() => progressTrack.classList.remove('is-tick'), 600);
      }
    } else if (ratio < 0.95) {
      reachedEnd = false;
    }
  };
  const scheduleProgress = () => { if (!progressFrame) progressFrame = requestAnimationFrame(updateProgress); };
  body.addEventListener('scroll', scheduleProgress, { passive: true });

  const productOf = key => config.products[key];
  const nameOf = key => document.querySelector(`[data-expert="${key}"]`)?.dataset.name || '';
  const imageUrl = key => {
    const product = productOf(key);
    return product.introImage || config.introImage.replace('{expertId}', encodeURIComponent(product.expertId));
  };

  // 같은 주소의 이미지는 한 번 받으면 브라우저 캐시에서 다시 씁니다.
  const preload = key => {
    if (!key || loaded.has(key)) return;
    const probe = new Image();
    probe.decoding = 'async';
    probe.src = imageUrl(key);
  };

  const showStatus = (text, canRetry) => {
    status.hidden = false;
    status.classList.toggle('is-error', canRetry);
    message.textContent = text;
    retry.hidden = !canRetry;
  };

  const loadImage = (key, bustCache) => {
    const name = nameOf(key);
    image.hidden = true;
    image.alt = `${name} 엑스퍼트 소개`;
    showStatus('소개 이미지를 불러오는 중입니다.', false);
    image.onload = () => {
      if (current !== key) return;
      loaded.add(key);
      status.hidden = true;
      image.hidden = false;
      scheduleProgress();
    };
    image.onerror = () => {
      if (current !== key) return;
      showStatus('소개 이미지를 불러오지 못했습니다. 네트워크 상태를 확인해 주세요.', true);
    };
    const url = imageUrl(key);
    // 같은 이미지를 다시 열면 load 이벤트가 오지 않으므로 바로 보여 줍니다.
    if (!bustCache && image.src === url && image.complete && image.naturalWidth) {
      image.onload();
      return;
    }
    image.src = bustCache ? `${url}${url.includes('?') ? '&' : '?'}retry=${Date.now()}` : url;
  };

  const lockPage = locked => {
    document.documentElement.classList.toggle('is-intro-open', locked);
  };

  const open = (key, trigger) => {
    if (!productOf(key)) return;
    clearTimeout(hideTimer);
    current = key;
    opener = trigger || null;
    nameSlot.textContent = nameOf(key);
    cta.dataset.expert = key;
    ctaName.textContent = nameOf(key);
    cta.setAttribute('aria-label', `${nameOf(key)} 평생반값 혜택받기`);
    loadImage(key, false);
    modal.hidden = false;
    // 표시된 뒤에 맨 위로 돌려야 이전 스크롤 위치가 남지 않습니다.
    body.scrollTop = 0;
    reachedEnd = false;
    clearTimeout(tickTimer);
    progressTrack?.classList.remove('is-tick');
    updateProgress();
    lockPage(true);
    void modal.offsetWidth;
    modal.classList.add('is-open');
    closeButton.focus({ preventScroll: true });
    // 안드로이드 뒤로가기로 팝업만 닫히도록 기록을 하나 추가합니다.
    if (!history.state || !history.state.expertIntro) history.pushState({ expertIntro: true }, '');
  };

  const hide = () => {
    closing = false;
    if (!current) return;
    current = null;
    modal.classList.remove('is-open');
    lockPage(false);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    hideTimer = setTimeout(() => { modal.hidden = true; }, reduce ? 0 : 280);
    opener?.focus({ preventScroll: true });
  };

  // 닫기 버튼·배경·Esc는 뒤로가기와 같은 경로로 닫아 기록을 맞춥니다.
  let closing = false;
  const requestClose = () => {
    // 닫는 중에 다시 요청이 오면(빠른 연속 뒤로가기 등) 기록을 한 번 더 되돌리지 않습니다.
    if (closing) return;
    if (history.state && history.state.expertIntro) {
      closing = true;
      history.back();
    } else {
      hide();
    }
  };

  window.addEventListener('popstate', () => { if (current) hide(); });

  // 앱(Flutter)에서 안드로이드 뒤로가기를 받으면 먼저 호출하는 함수입니다.
  // 팝업이 열려 있으면 닫고 true를, 아니면 false를 돌려줍니다. false면 앱이 원래대로 WebView를 닫습니다.
  window.onAppBackPressed = () => {
    if (!current) return false;
    requestClose();
    return true;
  };

  document.querySelectorAll('[data-intro]').forEach(button => {
    const key = button.dataset.intro;
    button.addEventListener('pointerdown', () => preload(key), { passive: true });
    button.addEventListener('click', () => open(key, button));
  });
  modal.querySelectorAll('[data-intro-close]').forEach(el => el.addEventListener('click', requestClose));
  retry.addEventListener('click', () => current && loadImage(current, true));
  cta.addEventListener('click', () => {
    const product = productOf(cta.dataset.expert);
    if (product) window.join(product.expertId, product.productId, product.discountPct, product.discountAmt);
  });

  modal.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); requestClose(); return; }
    if (event.key !== 'Tab') return;
    const focusable = [...sheet.querySelectorAll('button:not([hidden])')];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  // 카드가 화면에 EXPAND_DELAY 동안 계속 보이면 돋보기 표시를 펼쳐 '소개 보기' 글자를 보여 줍니다.
  const EXPAND_DELAY = 3000;
  if ('IntersectionObserver' in window) {
    const timers = new Map();
    const hintObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const hint = entry.target.querySelector('.portrait-hint');
        if (!hint || hint.classList.contains('is-expanded')) return;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
          if (!timers.has(hint)) {
            timers.set(hint, setTimeout(() => {
              hint.classList.add('is-expanded');
              timers.delete(hint);
              hintObserver.unobserve(entry.target);
            }, EXPAND_DELAY));
          }
        } else {
          clearTimeout(timers.get(hint));
          timers.delete(hint);
        }
      });
    }, { threshold: [0, 0.6], rootMargin: '0px 0px -80px 0px' });
    document.querySelectorAll('.expert-card').forEach(card => hintObserver.observe(card));
  } else {
    document.querySelectorAll('.portrait-hint').forEach(hint => hint.classList.add('is-expanded'));
  }

  // 배경을 끌어도 뒤 페이지가 움직이지 않게 합니다.
  modal.querySelector('.intro-backdrop').addEventListener('touchmove', event => event.preventDefault(), { passive: false });
})();
