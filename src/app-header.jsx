import React, { useEffect, useRef, useState } from 'react';
import { BarChart3, BookOpen, ChevronLeft, CircleHelp, FileText, LogOut, PanelLeftClose, PanelLeftOpen, Settings2, Sparkles, UserRound } from 'lucide-react';
import { profileOf } from './profile.js';
import { BrandLogo } from './brand-logo.jsx';
import './app-header.css';

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

export function AppHeader({ active, error, onLogout, pending = false, user, variant = 'default' }) {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('moonble:sidebar-collapsed') === 'true'; }
    catch { return false; }
  });
  const [sidebarHidden, setSidebarHidden] = useState(() => {
    try { return sessionStorage.getItem('moonble:sidebar-hidden') === 'true'; }
    catch { return false; }
  });
  const [mobileHeaderHidden, setMobileHeaderHidden] = useState(false);
  const profile = user ? profileOf(user) : null;
  const name = profile?.name || user?.email || '내 계정';
  const initial = name.trim().slice(0, 1).toUpperCase() || 'M';
  const solver = variant === 'solver';
  const questions = useSolverQuestions(solver);

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

  return <aside hidden={sidebarHidden} className={`mb-app-header${solver ? ' mb-solver-sidebar' : ''}${collapsed ? ' is-collapsed' : ''}${mobileHeaderHidden ? ' is-mobile-hidden' : ''} no-print`} aria-label={solver ? '문제풀이 탐색' : 'Moonble 워크스페이스'}>
    <div className="mb-app-header-inner">
      <div className="mb-app-brand-row">
        <a className="mb-app-logo" href="./quiz.html" aria-label="Moonble 홈"><BrandLogo decorative /></a>
        <span className="mb-sidebar-help">
          <button type="button" aria-label="사이드바 단축키 안내"><CircleHelp size={17} aria-hidden="true" /></button>
          <span role="tooltip"><kbd>Shift</kbd>와 <kbd>\</kbd>를 함께 누르면 사이드바가 사라지고, 다시 누르면 나타나요.</span>
        </span>
      </div>
      <a className="mb-app-profile" href="./account.html" aria-current={active === 'account' ? 'page' : undefined} aria-label={`${name} 계정 열기`}>
        <span className="mb-app-avatar" aria-hidden="true">{initial}</span>
        <span className="mb-app-profile-copy"><strong>{name}</strong><small>{profile?.companyName || '개인 워크스페이스'}</small></span>
        <Settings2 size={16} aria-hidden="true" />
      </a>
      {solver ? <nav className="mb-app-nav mb-solver-nav" aria-label="문제 목록">
        <div className="mb-solver-heading"><a href="./quiz.html#paper-library"><ChevronLeft size={18} aria-hidden="true" /><span>문제지</span></a><strong>문제 목록</strong></div>
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
      </nav> : <nav className="mb-app-nav" aria-label="주 메뉴">
          <a href="./quiz.html#paper-library" aria-current={active === 'papers' ? 'page' : undefined}><BookOpen size={18} aria-hidden="true" /><span>문제지</span></a>
          <a href="./quiz.html#create" aria-current={active === 'create' ? 'page' : undefined}><Sparkles size={18} aria-hidden="true" /><span>문제 생성하기</span></a>
          <a href="./quiz.html#achievement" aria-current={active === 'achievement' ? 'page' : undefined}><BarChart3 size={18} aria-hidden="true" /><span>나의 성취도</span></a>
          <a href="./prd.html" aria-current={active === 'prd' ? 'page' : undefined}><FileText size={18} aria-hidden="true" /><span>PRD</span></a>
          <a className="mb-app-my" href="./account.html" aria-current={active === 'account' ? 'page' : undefined}><UserRound size={18} aria-hidden="true" /><span>MY</span></a>
        </nav>}
      <div className="mb-app-account">
        {error && <p className="mb-app-error" role="alert">{error}</p>}
        {onLogout && <button className="mb-app-logout" type="button" disabled={pending} aria-label={pending ? '로그아웃 처리 중' : '로그아웃'} onClick={onLogout}>
          {pending ? <span className="moonble-spinner" aria-hidden="true" /> : <><LogOut size={17} aria-hidden="true" /><span>로그아웃</span></>}
        </button>}
      </div>
    </div>
    <button className="mb-sidebar-toggle" type="button" aria-expanded={!collapsed} aria-label={collapsed ? '사이드바 펼치기' : '사이드바 접기'} onClick={() => setCollapsed(value => !value)}>
      {collapsed ? <PanelLeftOpen size={16} aria-hidden="true" /> : <PanelLeftClose size={16} aria-hidden="true" />}
    </button>
  </aside>;
}
