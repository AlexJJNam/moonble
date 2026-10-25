import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BarChart3, Bell, BookOpen, ChevronLeft, FileText, LogOut, PanelLeftClose, PanelLeftOpen, Settings2, Sparkles, UserRound } from 'lucide-react';
import { profileOf } from './profile.js';
import { BrandLogo } from './brand-logo.jsx';
import { enableBrowserNotifications as requestBrowserNotifications, getBrowserNotificationSettings, deliverBrowserNotification } from './browser-notifications.js';
import { getNextQuizShareNotification } from './quiz-share.js';
import { formatRelativeDate } from './date-format.js';
import { supabase } from './supabase.js';
import './app-header.css';

const SHARE_NOTIFICATION_LIMIT = 40;

function shareNotificationStorageKey(userId) {
  return userId ? `moonble:user:${userId}:quiz-share-notifications-v1` : null;
}

function showBrowserShareNotification(userId, notification) {
  if (!getBrowserNotificationSettings(userId).enabled) return;
  deliverBrowserNotification('문블 · 공유한 문제 풀이', `${notification.title} · ${notification.score}점 (${notification.correct}/${notification.total})`).catch(() => {
    // 시스템 알림 실패가 문제 풀이 알림 목록이나 인앱 토스트를 막지 않게 한다.
  });
}

function readShareNotifications(userId) {
  try {
    const saved = JSON.parse(localStorage.getItem(shareNotificationStorageKey(userId)) || '[]');
    return Array.isArray(saved) ? saved.filter(item => item && typeof item.id === 'string').slice(0, SHARE_NOTIFICATION_LIMIT) : [];
  } catch { return []; }
}

function rememberShareNotification(userId, notification) {
  const previous = readShareNotifications(userId);
  if (previous.some(item => item.id === notification.id)) return previous;
  const next = [{ ...notification, seen: false }, ...previous].slice(0, SHARE_NOTIFICATION_LIMIT);
  try { localStorage.setItem(shareNotificationStorageKey(userId), JSON.stringify(next)); }
  catch { /* 기록을 저장하지 못해도 새 알림은 현재 화면에 표시한다. */ }
  return next;
}

function markShareNotificationsSeen(userId, notifications) {
  const next = notifications.map(notification => ({ ...notification, seen: true }));
  try { localStorage.setItem(shareNotificationStorageKey(userId), JSON.stringify(next)); }
  catch { /* 알림 목록은 현재 화면에서 계속 볼 수 있다. */ }
  return next;
}

function useSolverQuestions(enabled) {
  const [items, setItems] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const navRef = useRef(null);
  const manualSelectionUntil = useRef(0);

  useEffect(() => {
    if (!enabled) return undefined;
    let frame = 0;

    function readCards() {
      const container = document.getElementById('quizContainer');
      if (!container) {
        setItems([]);
        return;
      }
      const next = Array.from(container.querySelectorAll('.q-card')).map((card, index) => {
        card.id = `question-${index + 1}`;
        card.tabIndex = -1;
        const number = card.querySelector('.q-number');
        const status = number?.classList.contains('right')
          ? 'correct'
          : number?.classList.contains('wrong')
            ? 'wrong'
            : card.querySelector('.option-card.selected') ? 'answered' : 'idle';
        return {
          id: card.id,
          label: `문제 ${index + 1}번`,
          status,
        };
      });
      setItems(current => JSON.stringify(current) === JSON.stringify(next) ? current : next);
      setActiveIndex(current => Math.min(current, Math.max(0, next.length - 1)));
    }

    function updateActive() {
      frame = 0;
      if (Date.now() < manualSelectionUntil.current) return;
      const container = document.getElementById('quizContainer');
      if (!container) return;
      const cards = Array.from(container.querySelectorAll('.q-card'));
      if (!cards.length) return;
      const header = document.querySelector('.mb-app-header');
      const top = window.matchMedia('(max-width: 767px)').matches && header
        ? header.getBoundingClientRect().height + 16
        : 24;
      let best = 0;
      let bestDistance = Infinity;
      cards.forEach((card, index) => {
        const rect = card.getBoundingClientRect();
        const distance = Math.abs(rect.top - top);
        if (rect.bottom > top && distance < bestDistance) {
          best = index;
          bestDistance = distance;
        }
      });
      setActiveIndex(best);
    }

    function scheduleActive() {
      if (frame) return;
      frame = requestAnimationFrame(updateActive);
    }

    const observer = new MutationObserver(() => {
      readCards();
      scheduleActive();
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    readCards();
    updateActive();
    window.addEventListener('scroll', scheduleActive, { passive: true });
    window.addEventListener('resize', scheduleActive);
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', scheduleActive);
      window.removeEventListener('resize', scheduleActive);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [enabled]);

  useEffect(() => {
    const nav = navRef.current;
    const current = nav?.querySelector('[aria-current="true"]');
    if (!nav || !current) return;

    const navRect = nav.getBoundingClientRect();
    const currentRect = current.getBoundingClientRect();
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const behavior = reduceMotion ? 'auto' : 'smooth';

    if (window.matchMedia('(max-width: 767px)').matches) {
      const left = nav.scrollLeft + currentRect.left - navRect.left - (nav.clientWidth - currentRect.width) / 2;
      nav.scrollTo({ left: Math.max(0, left), behavior });
      return;
    }

    const top = nav.scrollTop + currentRect.top - navRect.top - (nav.clientHeight - currentRect.height) / 2;
    nav.scrollTo({ top: Math.max(0, top), behavior });
  }, [activeIndex, items.length]);

  function goToQuestion(event, index) {
    event.preventDefault();
    const target = document.getElementById(`question-${index + 1}`);
    if (!target) return;
    const header = document.querySelector('.mb-app-header');
    const topOffset = window.matchMedia('(max-width: 767px)').matches && header
      ? header.getBoundingClientRect().height + 12
      : 16;
    const top = Math.max(0, target.getBoundingClientRect().top + window.scrollY - topOffset);
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    manualSelectionUntil.current = Date.now() + 800;
    setActiveIndex(index);
    window.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
    window.history.replaceState(null, '', `#question-${index + 1}`);
    target.focus({ preventScroll: true });

    const badge = target.querySelector('.q-number');
    window.setTimeout(() => {
      target.classList.remove('is-anchor-trace');
      badge?.classList.remove('is-anchor-flash');
      void target.offsetWidth;
      target.classList.add('is-anchor-trace');

      if (reduceMotion) {
        window.setTimeout(() => target.classList.remove('is-anchor-trace'), 700);
        return;
      }

      if (badge) {
        badge.classList.add('is-anchor-flash');
        badge.addEventListener('animationend', () => badge.classList.remove('is-anchor-flash'), { once: true });
      }

      const clearTrace = event => {
        if (event.animationName !== 'mb-question-card-trace') return;
        target.classList.remove('is-anchor-trace');
        target.removeEventListener('animationend', clearTrace);
        target.removeEventListener('animationcancel', clearTrace);
      };
      target.addEventListener('animationend', clearTrace);
      target.addEventListener('animationcancel', clearTrace);
    }, reduceMotion ? 0 : 450);
  }

  return { activeIndex, goToQuestion, items, navRef };
}

export function AppHeader({ active, error, hideSolverBack = false, onLogout, pending = false, user, variant = 'default' }) {
  const activeDockIndex = Math.max(0, ['papers', 'create', 'achievement', 'prd', 'account'].indexOf(active));
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('moonble:sidebar-collapsed') === 'true'; }
    catch { return false; }
  });
  const [sidebarHidden, setSidebarHidden] = useState(() => {
    try { return sessionStorage.getItem('moonble:sidebar-hidden') === 'true'; }
    catch { return false; }
  });
  const [mobileHeaderHidden, setMobileHeaderHidden] = useState(false);
  const [shareNotification, setShareNotification] = useState(null);
  const [shareNotifications, setShareNotifications] = useState([]);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [browserNotificationSettings, setBrowserNotificationSettings] = useState(() => getBrowserNotificationSettings(user?.id));
  const [browserNotificationBusy, setBrowserNotificationBusy] = useState(false);
  const [browserNotificationError, setBrowserNotificationError] = useState('');
  const [mobileDockIndex, setMobileDockIndex] = useState(() => {
    try {
      const saved = sessionStorage.getItem('moonble:mobile-dock-index');
      const previous = saved == null ? null : Number(saved);
      return Number.isInteger(previous) && previous >= 0 && previous < 5 ? previous : activeDockIndex;
    } catch { return activeDockIndex; }
  });
  const mobileDockRef = useRef(null);
  const notificationBackRef = useRef(null);
  const notificationReturnFocusRef = useRef(null);
  const shareNotificationTimer = useRef(0);
  const shareNotificationVisible = useRef(false);
  const profile = user ? profileOf(user) : null;
  const name = profile?.name || user?.email || '내 계정';
  const nameInitial = [...name][0] || 'M';
  const solver = variant === 'solver';
  const sharedSolver = solver && hideSolverBack;
  const questions = useSolverQuestions(solver);

  useEffect(() => {
    setShareNotifications(readShareNotifications(user?.id));
    setNotificationOpen(false);
    setBrowserNotificationSettings(getBrowserNotificationSettings(user?.id));
  }, [user?.id]);

  useEffect(() => {
    const refresh = () => setBrowserNotificationSettings(getBrowserNotificationSettings(user?.id));
    const onPreferenceChange = event => {
      if (!event.detail?.userId || event.detail.userId === user?.id) {
        refresh();
        setBrowserNotificationError('');
      }
    };
    window.addEventListener('focus', refresh);
    window.addEventListener('moonble:browser-notifications-changed', onPreferenceChange);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('moonble:browser-notifications-changed', onPreferenceChange);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !supabase) return undefined;
    let alive = true;
    let checking = false;
    let interval = 0;

    async function checkSharedQuizNotifications() {
      if (!alive || checking || shareNotificationVisible.current || document.visibilityState === 'hidden') return;
      checking = true;
      try {
        const notification = await getNextQuizShareNotification();
        if (!alive || !notification?.id) return;
        setShareNotifications(rememberShareNotification(user.id, notification));
        showBrowserShareNotification(user.id, notification);
        shareNotificationVisible.current = true;
        setShareNotification(notification);
        window.clearTimeout(shareNotificationTimer.current);
        shareNotificationTimer.current = window.setTimeout(() => {
          shareNotificationVisible.current = false;
          setShareNotification(null);
          checkSharedQuizNotifications();
        }, 3200);
      } catch {
        // DB 마이그레이션 전이거나 네트워크가 끊겨도 나머지 화면 사용은 계속한다.
      } finally {
        checking = false;
      }
    }

    const resume = () => { if (document.visibilityState === 'visible') checkSharedQuizNotifications(); };
    checkSharedQuizNotifications();
    interval = window.setInterval(checkSharedQuizNotifications, 18000);
    window.addEventListener('focus', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      alive = false;
      window.clearInterval(interval);
      window.clearTimeout(shareNotificationTimer.current);
      window.removeEventListener('focus', resume);
      document.removeEventListener('visibilitychange', resume);
      shareNotificationVisible.current = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!notificationOpen) return undefined;
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    notificationBackRef.current?.focus({ preventScroll: true });
    function closeOnEscape(event) {
      if (event.key === 'Escape') setNotificationOpen(false);
    }
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.documentElement.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
      notificationReturnFocusRef.current?.focus?.({ preventScroll: true });
    };
  }, [notificationOpen]);

  function openNotifications(event) {
    notificationReturnFocusRef.current = event.currentTarget;
    if (user?.id) setShareNotifications(current => markShareNotificationsSeen(user.id, current));
    setNotificationOpen(true);
  }

  function closeNotifications() {
    setNotificationOpen(false);
  }

  async function enableBrowserNotifications() {
    if (browserNotificationBusy) return;
    setBrowserNotificationBusy(true);
    setBrowserNotificationError('');
    try {
      const settings = await requestBrowserNotifications(user?.id);
      setBrowserNotificationSettings(settings);
      if (settings.permission === 'denied') {
        setBrowserNotificationError('알림이 차단돼 있어요. 브라우저 사이트 설정에서 알림을 허용해주세요.');
      } else if (!settings.enabled && settings.permission !== 'unsupported' && settings.permission !== 'insecure') {
        setBrowserNotificationError('알림 권한을 허용한 뒤 다시 켜주세요.');
      }
    } catch {
      setBrowserNotificationError('알림 권한을 요청하지 못했어요. 브라우저 설정을 확인해주세요.');
      setBrowserNotificationSettings(getBrowserNotificationSettings(user?.id));
    } finally {
      setBrowserNotificationBusy(false);
    }
  }

  useLayoutEffect(() => {
    const nav = mobileDockRef.current;
    if (!nav) return undefined;
    const setPosition = index => {
      const link = nav.querySelectorAll('a')[index];
      if (!link) return;
      const navRect = nav.getBoundingClientRect();
      const linkRect = link.getBoundingClientRect();
      nav.style.setProperty('--mb-dock-x', `${linkRect.left + linkRect.width / 2 - navRect.left}px`);
    };
    setPosition(mobileDockIndex);
    const shouldAnimate = mobileDockIndex !== activeDockIndex;
    let transitionPending = shouldAnimate;
    let firstFrame = 0;
    let secondFrame = 0;
    if (shouldAnimate) {
      firstFrame = requestAnimationFrame(() => {
        secondFrame = requestAnimationFrame(() => {
          setPosition(activeDockIndex);
          setMobileDockIndex(activeDockIndex);
          transitionPending = false;
        });
      });
    } else {
      setMobileDockIndex(activeDockIndex);
    }
    try { sessionStorage.setItem('moonble:mobile-dock-index', String(activeDockIndex)); } catch { /* 메뉴 이동 효과 없이도 탐색은 계속 동작한다. */ }
    const updateForViewport = () => setPosition(activeDockIndex);
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { if (!transitionPending) updateForViewport(); }) : null;
    observer?.observe(nav);
    window.addEventListener('resize', updateForViewport);
    window.visualViewport?.addEventListener('resize', updateForViewport);
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      observer?.disconnect();
      window.removeEventListener('resize', updateForViewport);
      window.visualViewport?.removeEventListener('resize', updateForViewport);
    };
  }, [activeDockIndex]);

  useEffect(() => {
    document.body.classList.add('mb-has-app-sidebar');
    document.body.classList.toggle('mb-has-app-dock', !solver);
    return () => {
      document.body.classList.remove('mb-has-app-sidebar');
      document.body.classList.remove('mb-has-app-dock');
    };
  }, [solver]);

  useEffect(() => {
    document.body.classList.toggle('mb-sidebar-collapsed', collapsed);
    try { localStorage.setItem('moonble:sidebar-collapsed', String(collapsed)); } catch { /* 저장할 수 없어도 토글은 동작한다. */ }
    return () => document.body.classList.remove('mb-sidebar-collapsed');
  }, [collapsed]);

  useEffect(() => {
    document.body.classList.toggle('mb-sidebar-hidden', sidebarHidden);
    try { sessionStorage.setItem('moonble:sidebar-hidden', String(sidebarHidden)); } catch { /* 현재 탭에 저장할 수 없어도 단축키는 동작한다. */ }
    return () => document.body.classList.remove('mb-sidebar-hidden');
  }, [sidebarHidden]);

  useEffect(() => {
    function toggleSidebar(event) {
      if (!event.shiftKey || event.code !== 'Backslash' || event.repeat) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      event.preventDefault();
      setSidebarHidden(value => !value);
    }

    window.addEventListener('keydown', toggleSidebar);
    return () => window.removeEventListener('keydown', toggleSidebar);
  }, []);

  useEffect(() => {
    let previousY = window.scrollY;
    let direction = 0;
    let distance = 0;
    let frame = 0;
    let touchStartY = null;

    function updateHeader() {
      frame = 0;
      if (!window.matchMedia('(max-width: 767px)').matches) {
        setMobileHeaderHidden(false);
        previousY = window.scrollY;
        return;
      }

      const currentY = Math.max(0, window.scrollY);
      const delta = currentY - previousY;
      const nextDirection = delta > 0 ? 1 : delta < 0 ? -1 : 0;

      if (currentY < 24) {
        setMobileHeaderHidden(false);
        direction = 0;
        distance = 0;
      } else if (nextDirection) {
        if (nextDirection !== direction) {
          direction = nextDirection;
          distance = 0;
        }
        distance += Math.abs(delta);
        if (distance >= (solver ? 8 : 18)) {
          setMobileHeaderHidden(nextDirection > 0);
          distance = 0;
        }
      }
      previousY = currentY;
    }

    function scheduleHeader() {
      if (frame) return;
      frame = requestAnimationFrame(updateHeader);
    }

    function revealOnUpwardTouch(event) {
      if (!solver || !window.matchMedia('(max-width: 767px)').matches) return;
      const touch = event.touches[0];
      if (!touch) return;
      if (touchStartY === null) touchStartY = touch.clientY;
      if (touch.clientY - touchStartY < 8) return;
      setMobileHeaderHidden(false);
      direction = -1;
      distance = 0;
      previousY = Math.max(0, window.scrollY);
    }

    function startTouch(event) {
      touchStartY = event.touches[0]?.clientY ?? null;
    }

    function endTouch() {
      touchStartY = null;
    }

    function revealOnUpwardWheel(event) {
      if (!solver || event.deltaY >= 0 || !window.matchMedia('(max-width: 767px)').matches) return;
      setMobileHeaderHidden(false);
      direction = -1;
      distance = 0;
      previousY = Math.max(0, window.scrollY);
    }

    window.addEventListener('scroll', scheduleHeader, { passive: true });
    window.addEventListener('resize', scheduleHeader);
    if (solver) {
      window.addEventListener('touchstart', startTouch, { passive: true });
      window.addEventListener('touchmove', revealOnUpwardTouch, { passive: true });
      window.addEventListener('touchend', endTouch, { passive: true });
      window.addEventListener('touchcancel', endTouch, { passive: true });
      window.addEventListener('wheel', revealOnUpwardWheel, { passive: true });
    }
    return () => {
      window.removeEventListener('scroll', scheduleHeader);
      window.removeEventListener('resize', scheduleHeader);
      if (solver) {
        window.removeEventListener('touchstart', startTouch);
        window.removeEventListener('touchmove', revealOnUpwardTouch);
        window.removeEventListener('touchend', endTouch);
        window.removeEventListener('touchcancel', endTouch);
        window.removeEventListener('wheel', revealOnUpwardWheel);
      }
      if (frame) cancelAnimationFrame(frame);
    };
  }, [solver]);

  return <>
  <aside hidden={sidebarHidden} className={`mb-app-header${solver ? ' mb-solver-sidebar' : ''}${sharedSolver ? ' is-shared-solver' : ''}${collapsed ? ' is-collapsed' : ''}${mobileHeaderHidden ? ' is-mobile-hidden' : ''} no-print`} aria-label={solver ? '문제풀이 탐색' : 'Moonble 워크스페이스'}>
    <div className="mb-app-header-inner">
      <div className="mb-app-brand-row">
        <a className="mb-app-logo" href="./quiz.html" aria-label="Moonble 홈"><BrandLogo decorative />{user && <span className="mb-app-logo-avatar" aria-hidden="true">{nameInitial}</span>}</a>
        {user && <button className="mb-notification-toggle mb-notification-toggle--desktop" type="button" aria-label={`알림 ${shareNotifications.filter(item => !item.seen).length}개`} aria-expanded={notificationOpen} aria-controls="mb-notification-screen" onClick={openNotifications}>
          <Bell size={16} aria-hidden="true" />
          {shareNotifications.some(item => !item.seen) && <span className="mb-notification-badge" aria-label={`${shareNotifications.filter(item => !item.seen).length}개 안 읽은 알림`}>{Math.min(99, shareNotifications.filter(item => !item.seen).length)}</span>}
        </button>}
      </div>
      {user && <div className="mb-app-profile-row">
        <button className="mb-notification-toggle mb-notification-toggle--mobile" type="button" aria-label={`알림 ${shareNotifications.filter(item => !item.seen).length}개`} aria-expanded={notificationOpen} aria-controls="mb-notification-screen" onClick={openNotifications}>
          <Bell size={19} aria-hidden="true" />
          {shareNotifications.some(item => !item.seen) && <span className="mb-notification-badge" aria-label={`${shareNotifications.filter(item => !item.seen).length}개 안 읽은 알림`}>{Math.min(99, shareNotifications.filter(item => !item.seen).length)}</span>}
        </button>
        <a className="mb-app-profile" href="./account.html" aria-current={active === 'account' ? 'page' : undefined} aria-label={`${name} 계정 열기`}>
          <span className="mb-app-profile-avatar" aria-hidden="true">{nameInitial}</span>
          <span className="mb-app-profile-copy"><strong>{name}</strong><small>{profile?.companyName || '개인 워크스페이스'}</small></span>
          <Settings2 size={16} aria-hidden="true" />
        </a>
      </div>}
      {solver ? <nav className="mb-app-nav mb-solver-nav" aria-label="문제 목록">
        <div className="mb-solver-heading">{!hideSolverBack && <a href="./quiz.html#paper-library"><ChevronLeft size={18} aria-hidden="true" /><span>문제지</span></a>}<strong>문제 목록</strong></div>
        <div className="mb-solver-questions" ref={questions.navRef}>
          {questions.items.map((item, index) => <a
            className={`mb-solver-question is-${item.status}`}
            href={`#${item.id}`}
            key={item.id}
            aria-current={questions.activeIndex === index ? 'true' : undefined}
            aria-label={`${index + 1}번 문제${item.status === 'answered' ? ', 답변 선택됨' : item.status === 'correct' ? ', 정답' : item.status === 'wrong' ? ', 오답' : ''}`}
            onClick={event => questions.goToQuestion(event, index)}
          ><span className="mb-solver-number">{index + 1}</span><span className="mb-solver-label">{item.label}</span><span className="mb-solver-status" aria-hidden="true">{item.status === 'correct' ? 'O' : item.status === 'wrong' ? 'X' : ''}</span></a>)}
        </div>
      </nav> : <nav className="mb-app-nav" aria-label="주 메뉴" ref={mobileDockRef}>
          <a href="./quiz.html#paper-library" aria-current={active === 'papers' ? 'page' : undefined}><BookOpen size={18} aria-hidden="true" /><span>문제지</span></a>
          <a href="./quiz.html#create" aria-current={active === 'create' ? 'page' : undefined}><Sparkles size={18} aria-hidden="true" /><span>문제 생성하기</span></a>
          <a href="./quiz.html#achievement" aria-current={active === 'achievement' ? 'page' : undefined}><BarChart3 size={18} aria-hidden="true" /><span>나의 성취도</span></a>
          <a href="./prd.html" aria-current={active === 'prd' ? 'page' : undefined}><FileText size={18} aria-hidden="true" /><span>PRD</span></a>
          <a className="mb-app-my" href="./account.html" aria-current={active === 'account' ? 'page' : undefined}><UserRound size={18} aria-hidden="true" /><span>MY</span></a>
        </nav>}
      {(user || onLogout || error) && <div className="mb-app-account">
        {error && <p className="mb-app-error" role="alert">{error}</p>}
        {onLogout && <button className="mb-app-logout" type="button" disabled={pending} aria-label={pending ? '로그아웃 처리 중' : '로그아웃'} onClick={onLogout}>
          {pending ? <span className="moonble-spinner" aria-hidden="true" /> : <><LogOut size={17} aria-hidden="true" /><span>로그아웃</span></>}
        </button>}
      </div>}
    </div>
    <button className="mb-sidebar-toggle" type="button" aria-expanded={!collapsed} aria-label={collapsed ? '사이드바 펼치기' : '사이드바 접기'} onClick={() => setCollapsed(value => !value)}>
      {collapsed ? <PanelLeftOpen size={16} aria-hidden="true" /> : <PanelLeftClose size={16} aria-hidden="true" />}
    </button>
  </aside>
  {notificationOpen && <section className="mb-notification-screen" id="mb-notification-screen" role="dialog" aria-modal="true" aria-labelledby="mb-notification-title">
    <div className="mb-notification-screen-nav">
      <button ref={notificationBackRef} type="button" aria-label="알림 닫기" onClick={closeNotifications}><ChevronLeft size={24} aria-hidden="true" /></button>
    </div>
    <main className="mb-notification-screen-main">
      <header className="mb-notification-screen-heading"><h1 id="mb-notification-title">알림</h1></header>
      {!browserNotificationSettings.enabled && (() => {
        const permission = browserNotificationSettings.permission;
        const disabled = browserNotificationBusy || ['denied', 'unsupported', 'insecure'].includes(permission);
        const description = permission === 'unsupported'
          ? '현재 환경에서는 푸시 알림을 사용할 수 없어요. 아래 알림 기록에서 공유 문제 풀이 결과를 확인해주세요.'
          : permission === 'insecure'
            ? '보안 연결에서 접속하면 푸시 알림을 켤 수 있어요.'
            : permission === 'denied'
              ? '브라우저에서 알림이 차단돼 있어요. 사이트 설정에서 알림을 허용해주세요.'
              : '공유한 문제를 누군가 풀면 푸시 알림으로 알려드려요.';
        return <section className="mb-browser-alert-card" aria-label="푸시 알림 설정">
          <div className="mb-browser-alert-head"><h2>푸시 알림</h2><span className="mb-browser-alert-status">꺼짐</span></div>
          <p className="mb-browser-alert-copy">{description}</p>
          {browserNotificationError && <p className="mb-browser-alert-error" role="status">{browserNotificationError}</p>}
          <div className="mb-browser-alert-actions">
            <button type="button" className="is-primary" disabled={disabled} onClick={enableBrowserNotifications}>{browserNotificationBusy ? '알림 권한 요청 중' : permission === 'denied' ? '브라우저 설정에서 허용' : permission === 'unsupported' ? '알림 사용 불가' : permission === 'insecure' ? '보안 연결 필요' : '푸시 알림 켜기'}</button>
          </div>
        </section>;
      })()}
      {shareNotifications.length ? <div className="mb-notification-screen-list">
        {shareNotifications.map(item => <article className="mb-notification-screen-item" key={item.id}>
          <div className="mb-notification-item-heading">
            <span className="mb-notification-title"><span className="mb-notification-paper-title">{item.title}</span>{!item.seen && <i className="mb-notification-unread" aria-label="안 읽음" />}</span>
            <time className="mb-notification-meta" dateTime={item.created_at}>{formatRelativeDate(item.created_at)}</time>
          </div>
          <span className="mb-notification-copy">공유한 문제를 누군가 풀었어요.</span>
          <span className="mb-notification-copy">{item.score}점 ({item.correct}/{item.total})</span>
        </article>)}
      </div> : <div className="mb-notification-empty">
        <Bell size={30} aria-hidden="true" />
        <strong>아직 받은 알림이 없어요</strong>
        <p>문제지를 공유하면 풀이 결과를 여기서 확인할 수 있어요.</p>
      </div>}
    </main>
  </section>}
  {shareNotification && <div className={`mb-share-notification-toast${solver ? ' is-solver' : ''}`} role="status" aria-live="polite" aria-atomic="true">
    <strong>공유한 문제를 누군가 풀었어요.</strong>
    <span>{shareNotification.title} · {shareNotification.score}점 ({shareNotification.correct}/{shareNotification.total})</span>
  </div>}
  </>;
}
