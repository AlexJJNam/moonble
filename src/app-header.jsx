import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, BarChart3, BookOpen, FileText, LogOut, Settings2 } from 'lucide-react';
import { profileOf } from './profile.js';
import './app-header.css';

function useSolverQuestions(enabled) {
  const [items, setItems] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const navRef = useRef(null);
  const manualSelectionUntil = useRef(0);

  useEffect(() => {
    if (!enabled) return undefined;
    const container = document.getElementById('quizContainer');
    if (!container) return undefined;
    let frame = 0;

    function readCards() {
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
          label: card.querySelector('.q-title > div')?.textContent?.trim() || `${index + 1}번 문제`,
          status,
        };
      });
      setItems(current => JSON.stringify(current) === JSON.stringify(next) ? current : next);
      setActiveIndex(current => Math.min(current, Math.max(0, next.length - 1)));
    }

    function updateActive() {
      frame = 0;
      if (Date.now() < manualSelectionUntil.current) return;
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

    const observer = new MutationObserver(readCards);
    observer.observe(container, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
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
    navRef.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
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
    manualSelectionUntil.current = Date.now() + 800;
    setActiveIndex(index);
    window.scrollTo({ top, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    window.history.replaceState(null, '', `#question-${index + 1}`);
    target.focus({ preventScroll: true });
  }

  return { activeIndex, goToQuestion, items, navRef };
}

export function AppHeader({ active, error, onLogout, pending = false, user, variant = 'default' }) {
  const profile = user ? profileOf(user) : null;
  const name = profile?.name || user?.email || '내 계정';
  const initial = name.trim().slice(0, 1).toUpperCase() || 'M';
  const solver = variant === 'solver';
  const questions = useSolverQuestions(solver);

  useEffect(() => {
    document.body.classList.add('mb-has-app-sidebar');
    return () => document.body.classList.remove('mb-has-app-sidebar');
  }, []);

  return <aside className={`mb-app-header${solver ? ' mb-solver-sidebar' : ''} no-print`} aria-label={solver ? '문제풀이 탐색' : 'Moonble 워크스페이스'}>
    <div className="mb-app-header-inner">
      <a className="mb-app-logo" href="./quiz.html" aria-label="Moonble 홈">moonble</a>
      <a className="mb-app-profile" href="./account.html" aria-current={active === 'account' ? 'page' : undefined} aria-label={`${name} 계정 열기`}>
        <span className="mb-app-avatar" aria-hidden="true">{initial}</span>
        <span className="mb-app-profile-copy"><strong>{name}</strong><small>{profile?.companyName || '개인 워크스페이스'}</small></span>
        <Settings2 size={16} aria-hidden="true" />
      </a>
      {solver ? <nav className="mb-app-nav mb-solver-nav" aria-label="문제 목록">
        <div className="mb-solver-heading"><a href="./quiz.html#paper-library"><ArrowLeft size={16} aria-hidden="true" />문제지</a><strong>문제 목록</strong></div>
        <div className="mb-solver-questions" ref={questions.navRef}>
          {questions.items.map((item, index) => <a
            className={`mb-solver-question is-${item.status}`}
            href={`#${item.id}`}
            key={item.id}
            aria-current={questions.activeIndex === index ? 'true' : undefined}
            aria-label={`${index + 1}번 문제${item.status === 'answered' ? ', 답변 선택됨' : item.status === 'correct' ? ', 정답' : item.status === 'wrong' ? ', 오답' : ''}`}
            onClick={event => questions.goToQuestion(event, index)}
          ><span className="mb-solver-number">{index + 1}</span><span className="mb-solver-label">{item.label}</span><span className="mb-solver-status" aria-hidden="true" /></a>)}
        </div>
      </nav> : <nav className="mb-app-nav" aria-label="주 메뉴">
          <a href="./quiz.html#paper-library" aria-current={active === 'papers' ? 'page' : undefined}><BookOpen size={18} aria-hidden="true" />문제지</a>
          <a href="./quiz.html#achievement" aria-current={active === 'achievement' ? 'page' : undefined}><BarChart3 size={18} aria-hidden="true" />나의 성취도</a>
          <a href="./prd.html" aria-current={active === 'prd' ? 'page' : undefined}><FileText size={18} aria-hidden="true" />PRD</a>
        </nav>}
      <div className="mb-app-account">
        {error && <p className="mb-app-error" role="alert">{error}</p>}
        {onLogout && <button className="mb-app-logout" type="button" disabled={pending} aria-label={pending ? '로그아웃 처리 중' : '로그아웃'} onClick={onLogout}>
          {pending ? <span className="moonble-spinner" aria-hidden="true" /> : <><LogOut size={17} aria-hidden="true" /><span>로그아웃</span></>}
        </button>}
      </div>
    </div>
  </aside>;
}
