import React from 'react';
import { BarChart3, BookOpen, FileText, LogOut, UserRound } from 'lucide-react';
import { profileOf } from './profile.js';
import './app-header.css';

export function AppHeader({ active, error, onLogout, pending = false, user }) {
  const profile = user ? profileOf(user) : null;
  const name = profile?.name || user?.email || '내 계정';
  const initial = name.trim().slice(0, 1).toUpperCase() || 'M';

  return <header className="mb-app-header no-print">
    <div className="mb-app-header-inner">
      <a className="mb-app-logo" href="./quiz.html" aria-label="Moonble 홈">moonble</a>
      <nav className="mb-app-nav" aria-label="주 메뉴">
        <a href="./quiz.html#paper-library" aria-current={active === 'papers' ? 'page' : undefined}><BookOpen size={18} aria-hidden="true" />문제지</a>
        <a href="./quiz.html#achievement" aria-current={active === 'achievement' ? 'page' : undefined}><BarChart3 size={18} aria-hidden="true" />나의 성취도</a>
        <a href="./prd.html" aria-current={active === 'prd' ? 'page' : undefined}><FileText size={18} aria-hidden="true" />PRD</a>
      </nav>
      <div className="mb-app-account">
        <a className="mb-app-profile" href="./account.html" aria-current={active === 'account' ? 'page' : undefined} aria-label={`${name} 계정 열기`}>
          <span className="mb-app-avatar" aria-hidden="true">{initial}</span>
          <span>{name}</span>
          <UserRound size={16} aria-hidden="true" />
        </a>
        {onLogout && <button className="mb-app-logout" type="button" disabled={pending} aria-label={pending ? '로그아웃 처리 중' : '로그아웃'} onClick={onLogout}>
          {pending ? <span className="moonble-spinner" aria-hidden="true" /> : <><LogOut size={17} aria-hidden="true" /><span>로그아웃</span></>}
        </button>}
      </div>
    </div>
    {error && <p className="mb-app-error" role="alert">{error}</p>}
  </header>;
}
