(() => {
  'use strict';
  // Pixel custom properties avoid container-unit / typed-division requirements.
  const heroCast = document.querySelector('.hero-cast');
  const serviceCard = document.querySelector('.service-card');
  const syncArtworkSize = () => {
    if (heroCast) heroCast.style.setProperty('--cast-width', `${heroCast.clientWidth}px`);
    if (serviceCard) serviceCard.style.setProperty('--service-scale', Math.min(1, serviceCard.clientWidth / 331));
  };
  syncArtworkSize();
  window.addEventListener('resize', syncArtworkSize);
  if ('ResizeObserver' in window) {
    const artworkObserver = new ResizeObserver(syncArtworkSize);
    [heroCast, serviceCard].filter(Boolean).forEach(element => artworkObserver.observe(element));
  }
  const heroPortrait = document.querySelector('.cast-stage');
  const heroImage = heroPortrait?.querySelector('.cast-portrait img');
  if (heroImage) {
    heroPortrait.classList.add('is-entrance-pending');
    const imageReady = heroImage.decode ? heroImage.decode().catch(() => {}) : Promise.resolve();
    const revealHero = () => imageReady.then(() => {
      heroPortrait.classList.remove('is-entrance-pending');
      heroPortrait.classList.add('is-entrance-shown');
    });
    if ('IntersectionObserver' in window) {
      const heroObserver = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          heroObserver.disconnect();
          revealHero();
        }
      }, { threshold: 0.15 });
      heroObserver.observe(heroPortrait);
    } else {
      revealHero();
    }
  }
  // Keep badges visible when JavaScript or IntersectionObserver is unavailable.
  if ('IntersectionObserver' in window) {
    const badgeObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const badge = entry.target.querySelector('.recommend');
        const visible = entry.isIntersecting && entry.intersectionRatio >= 0.22;
        badge.classList.toggle('is-in-view', visible);
        if (visible) badge.classList.add('is-revealed');
      });
    }, { threshold: [0, 0.22], rootMargin: '0px 0px -80px 0px' });
    document.querySelectorAll('.recommend').forEach(badge => {
      badge.classList.add('recommend--animated');
      badgeObserver.observe(badge.closest('.expert-card'));
    });
  }
  // Portal the same bar out of the clipped hero, retaining its original space.
  const periodSlot = document.querySelector('.event-period-slot');
  const period = periodSlot?.querySelector('.event-period');
  if (period) {
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
      const shouldPin = !dismissed && rect.top <= 0;
      if (shouldPin === pinned) return;
      if (shouldPin) {
        pinned = true;
        period.style.setProperty('--period-start-width', `${rect.width}px`);
        document.body.append(period);
        period.classList.add('is-sticky');
        // Commit the starting width before expanding to the page edges.
        void period.offsetWidth;
        period.classList.add('is-expanded');
        closeTimer = setTimeout(() => { closeButton.hidden = false; }, 4000);
      } else {
        restorePeriod();
      }
    };
    closeButton.addEventListener('click', () => {
      // Dismiss the floating banner for this page visit; retain the original notice.
      dismissed = true;
      restorePeriod();
    });
    window.addEventListener('scroll', syncPeriod, { passive: true });
    window.addEventListener('resize', syncPeriod);
    window.addEventListener('pageshow', syncPeriod);
    syncPeriod();
  }
  const status = document.querySelector('.request-status');
  const statusMessage = status.querySelector('.toast-message');
  let statusTimer;
  let statusHideTimer;
  const hideStatus = () => {
    clearTimeout(statusTimer);
    clearTimeout(statusHideTimer);
    status.classList.remove('is-visible');
    statusHideTimer = setTimeout(() => { status.hidden = true; }, 220);
  };
  const showUnavailable = () => {
    clearTimeout(statusTimer);
    clearTimeout(statusHideTimer);
    status.hidden = false;
    statusMessage.textContent = '현재 신청을 진행할 수 없습니다. 고객센터로 문의해 주세요.';
    void status.offsetWidth;
    status.classList.add('is-visible');
    statusTimer = setTimeout(hideStatus, 6000);
  };
  status.querySelector('.toast-close').addEventListener('click', hideStatus);
  const validProduct = product => product &&
    ['expertId', 'productId', 'discountPct', 'discountAmt'].every(key =>
      typeof product[key] === 'string' && product[key].trim() !== '');

  const getBridge = () => {
    const bridge = window.flutter_inappwebview;
    return typeof bridge?.callHandler === 'function' ? bridge : null;
  };
  const waitForBridge = () => {
    if (getBridge()) return Promise.resolve(getBridge());
    return new Promise(resolve => {
      const finish = () => {
        clearTimeout(timeout);
        window.removeEventListener('flutterInAppWebViewPlatformReady', finish);
        resolve(getBridge());
      };
      const timeout = setTimeout(finish, 1500);
      window.addEventListener('flutterInAppWebViewPlatformReady', finish, { once: true });
    });
  };
  window.join = async function join(expertId, productId, discountPct, discountAmt) {
    const product = { expertId, productId, discountPct, discountAmt };
    if (!validProduct(product)) {
      console.warn('Expert checkout parameters are not configured.');
      return false;
    }
    const bridge = await waitForBridge();
    if (!bridge) {
      console.warn('Flutter handler not found.');
      return false;
    }
    let responseTimeout;
    try {
      const response = bridge.callHandler(
        'thinkpool_webview_handler',
        'webToApp_goLandingPageExp',
        { landingPage: 'LPTP', ...product }
      );
      await Promise.race([response, new Promise((_, reject) => {
        responseTimeout = setTimeout(() => reject(new Error('Flutter handler response timed out.')), 10000);
      })]);
      return true;
    } catch (error) {
      console.warn('Flutter checkout handler failed.', error);
      return false;
    } finally {
      clearTimeout(responseTimeout);
    }
  };

  let checkoutPending = false;
  document.querySelectorAll('[data-expert]').forEach(button => {
    button.addEventListener('click', async () => {
      if (checkoutPending) return;
      const expertKey = button.dataset.expert;
      const product = window.EXPERT_PROMO_CONFIG?.products?.[expertKey];
      const detail = { expertKey, expertName: button.dataset.name, ...(product || {}) };
      const request = new CustomEvent('expertpromo:subscribe', { detail, bubbles: true, cancelable: true });
      if (!button.dispatchEvent(request)) return;
      checkoutPending = true;
      button.setAttribute('aria-busy', 'true');
      try {
        if (!await window.join(product?.expertId, product?.productId, product?.discountPct, product?.discountAmt)) {
          showUnavailable();
        }
      } finally {
        checkoutPending = false;
        button.removeAttribute('aria-busy');
      }
    });
  });
})();
