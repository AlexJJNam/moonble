/* 스타일 성과 바텀시트: "스타일 성과 자세히 보기" 버튼을 누르면 성과 페이지(portfolio/style_portfolio.html)를
 * 아래에서 올라오는 시트 안 iframe으로 보여 줍니다. 엑스퍼트 소개 시트와 같은 동작입니다.
 * - 성과 화면을 내려 본 만큼 버튼 영역 윗변의 막대가 차오르고, 끝에 닿으면 '틱!'과 함께 버튼 글자에 불이 켜집니다.
 * - 닫기: 닫기 버튼, 바깥 영역, Esc, 안드로이드 뒤로가기(window.onAppBackPressed).
 * - 진행 막대는 같은 출처(같은 서버의 사본)일 때만 읽을 수 있습니다. 다른 출처면 막대만 숨기고 나머지는 그대로 동작합니다. */
(() => {
  'use strict';
  const modal = document.getElementById('portfolio-sheet');
  if (!modal) return;
  const sheet = modal.querySelector('.sheet');
  const status = modal.querySelector('.sheet-status');
  const message = modal.querySelector('.sheet-message');
  const retry = modal.querySelector('.sheet-retry');
  const closeButton = modal.querySelector('.sheet-close');
  const progressTrack = modal.querySelector('.sheet-progress');
  const progressBar = progressTrack.querySelector('span');
  const LOAD_TIMEOUT = 15000;
  let frame = modal.querySelector('.sheet-frame');
  let state = 'idle'; // idle → loading → ready
  let style = 'value';
  let win = null; // 같은 출처 iframe의 window (다른 출처면 null)
  let isOpen = false;
  let opener = null;
  let hideTimer;
  let tickTimer;
  let loadTimer;

  // 성과 화면을 내려 본 비율만큼 막대를 채웁니다.
  let progressFrame = null;
  let reachedEnd = false;
  const updateProgress = () => {
    progressFrame = null;
    let ratio = 0;
    if (win && state === 'ready') {
      const doc = win.document.scrollingElement || win.document.documentElement;
      const max = doc.scrollHeight - win.innerHeight;
      ratio = max <= 0 ? 0 : Math.min(1, Math.max(0, doc.scrollTop / max));
    }
    progressBar.style.transform = `scaleX(${ratio})`;
    // 100%인 동안만 버튼 글자에 불이 켜집니다.
    progressTrack.classList.toggle('is-complete', ratio >= 0.999);
    // 끝에 닿으면 오른쪽 끝 '틱!'을 한 번 보여 줍니다. 95% 아래로 올렸다가 다시 닿으면 또 보입니다.
    if (ratio >= 0.999 && !reachedEnd) {
      reachedEnd = true;
      clearTimeout(tickTimer);
      progressTrack.classList.remove('is-tick');
      void progressTrack.offsetWidth;
      progressTrack.classList.add('is-tick');
      tickTimer = setTimeout(() => progressTrack.classList.remove('is-tick'), 600);
    } else if (ratio < 0.95) {
      reachedEnd = false;
    }
  };
  const scheduleProgress = () => { if (!progressFrame) progressFrame = requestAnimationFrame(updateProgress); };
  const resetProgress = () => {
    reachedEnd = false;
    clearTimeout(tickTimer);
    progressTrack.classList.remove('is-tick');
    updateProgress();
  };

  // 성과 페이지 안의 탭을 눌러 스타일을 맞추고 맨 위부터 보여 줍니다.
  const applyStyle = () => {
    if (!win) return;
    const tab = win.document.querySelector(`.tab[data-port="${style}"]`);
    if (tab && tab.getAttribute('aria-selected') !== 'true') tab.click();
    win.scrollTo(0, 0);
    resetProgress();
  };

  const showStatus = (text, canRetry) => {
    status.hidden = false;
    status.classList.toggle('is-error', canRetry);
    message.textContent = text;
    retry.hidden = !canRetry;
  };

  const onFrameLoad = () => {
    if (state !== 'loading') return; // 처음 빈 iframe(about:blank)의 load는 무시
    try { if (frame.contentWindow.location.href === 'about:blank') return; } catch (error) { /* 다른 출처: 실제 페이지 */ }
    clearTimeout(loadTimer);
    try {
      win = frame.contentWindow;
      const doc = win.document; // 다른 출처면 여기서 예외
      doc.documentElement.style.overscrollBehavior = 'contain';
      win.addEventListener('scroll', scheduleProgress, { passive: true });
      win.addEventListener('resize', scheduleProgress);
      doc.addEventListener('keydown', event => {
        if (event.key === 'Escape') { event.preventDefault(); requestClose(); }
      });
      // 탭 전환 등으로 내용 높이가 바뀌면 다시 계산합니다.
      if (win.ResizeObserver) new win.ResizeObserver(scheduleProgress).observe(doc.body);
    } catch (error) {
      win = null;
    }
    progressTrack.hidden = !win;
    state = 'ready';
    status.hidden = true;
    applyStyle();
  };

  const startLoad = () => {
    state = 'loading';
    win = null;
    showStatus('성과 화면을 불러오는 중입니다.', false);
    clearTimeout(loadTimer);
    loadTimer = setTimeout(() => {
      if (state === 'loading') showStatus('성과 화면을 불러오지 못했습니다. 네트워크 상태를 확인해 주세요.', true);
    }, LOAD_TIMEOUT);
    // 다시 시도할 때는 새 iframe으로 바꿔 넣어 뒤로가기 기록이 쌓이지 않게 합니다.
    if (frame.src || frame.srcdoc) {
      const fresh = frame.cloneNode(false);
      fresh.removeAttribute('src');
      fresh.removeAttribute('srcdoc');
      frame.replaceWith(fresh);
      frame = fresh;
    }
    frame.addEventListener('load', onFrameLoad);
    const inline = window.__PORTFOLIO_INLINE__; // 단일 파일 미리보기 전용(빌드 시 삽입)
    if (inline) frame.srcdoc = inline;
    else frame.src = `${frame.dataset.src}?style=${encodeURIComponent(style)}`;
  };

  const open = (nextStyle, trigger) => {
    clearTimeout(hideTimer);
    style = nextStyle === 'core' ? 'core' : 'value';
    opener = trigger || document.activeElement;
    isOpen = true;
    modal.hidden = false;
    if (state === 'idle') startLoad();
    else if (state === 'ready') applyStyle();
    resetProgress();
    document.documentElement.classList.add('is-sheet-open');
    void modal.offsetWidth;
    modal.classList.add('is-open');
    closeButton.focus({ preventScroll: true });
    // 안드로이드 뒤로가기로 시트만 닫히도록 기록을 하나 추가합니다.
    if (!history.state || !history.state.portfolioSheet) history.pushState({ portfolioSheet: true }, '');
  };

  let closing = false;
  const hide = () => {
    closing = false;
    if (!isOpen) return;
    isOpen = false;
    modal.classList.remove('is-open');
    document.documentElement.classList.remove('is-sheet-open');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    hideTimer = setTimeout(() => { modal.hidden = true; }, reduce ? 0 : 320);
    if (opener && opener.focus) opener.focus({ preventScroll: true });
  };
  // 닫기 버튼·배경·Esc는 뒤로가기와 같은 경로로 닫아 기록을 맞춥니다.
  const requestClose = () => {
    if (closing) return;
    if (history.state && history.state.portfolioSheet) {
      closing = true;
      history.back();
    } else {
      hide();
    }
  };
  window.addEventListener('popstate', () => { if (isOpen) hide(); });

  // 앱(Flutter)에서 안드로이드 뒤로가기를 받으면 먼저 호출하는 함수입니다.
  // 시트가 열려 있으면 닫고 true를, 아니면 false를 돌려줍니다. false면 앱이 원래대로 WebView를 닫습니다.
  window.onAppBackPressed = () => {
    if (!isOpen) return false;
    requestClose();
    return true;
  };

  window.openPortfolioSheet = style => open(style, document.activeElement);
  // 버튼을 누르는 순간부터 미리 불러와 표시를 앞당깁니다.
  document.querySelectorAll('[data-portfolio]').forEach(button => {
    button.addEventListener('pointerdown', () => {
      if (state !== 'idle') return;
      style = button.dataset.portfolio;
      startLoad();
    }, { passive: true });
  });
  modal.querySelectorAll('[data-sheet-close]').forEach(el => el.addEventListener('click', requestClose));
  retry.addEventListener('click', startLoad);

  modal.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); requestClose(); return; }
    if (event.key !== 'Tab') return;
    const focusable = [...sheet.querySelectorAll('button:not([hidden]), iframe')];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  // 배경을 끌어도 뒤 페이지가 움직이지 않게 합니다.
  modal.querySelector('.sheet-backdrop').addEventListener('touchmove', event => event.preventDefault(), { passive: false });
})();
