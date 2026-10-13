import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { loginUrl, supabase } from './supabase.js';
import { hasProfile, profileOf } from './profile.js';
import './quiz-library.css';

const papers = [
  { id: 'basics', label: 'GA4 핵심 개념', description: '측정과 분석의 기본 개념을 20문항으로 점검합니다.', count: 20, level: '기본' },
  { id: 'advanced', label: 'GA4 실무 응용', description: '전자상거래, 데이터 품질, 실무 설정을 집중 점검합니다.', count: 20, level: '심화' },
  { id: 'random', label: '전체 랜덤 문제지', description: '전체 문제은행에서 매번 새로운 20문항을 출제합니다.', count: 20, level: '랜덤' },
];
function QuizLibrary() {
  const [user, setUser] = useState(null);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    if (!supabase) { window.location.replace(loginUrl()); return; }
    let alive = true;
    const accept = session => {
      if (!alive) return;
      if (!session) { window.location.replace(loginUrl()); return; }
      if (!hasProfile(session.user)) { window.location.replace(new URL('./prd.html', location.href)); return; }
      setUser(session.user); document.documentElement.removeAttribute('data-auth-pending');
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => accept(session));
    supabase.auth.getSession().then(({ data }) => accept(data.session)).catch(() => window.location.replace(loginUrl()));
    return () => { alive = false; subscription.unsubscribe(); };
  }, []);
  async function logout() {
    setPending(true);
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) setPending(false);
  }
  if (!user) return <p className="quiz-check">로그인 상태를 확인하고 있습니다…</p>;
  const profile = profileOf(user);
  return <>
    <header className="quiz-header">
      <a className="quiz-logo" href="./prd.html"><svg viewBox="0 0 140 28" aria-label="moonble"><text x="0" y="21" fontFamily="'Paperlogy', sans-serif" fontWeight="800" fontSize="28" letterSpacing="-0.6" fill="#3182f6">moonble</text></svg></a>
      <nav><a href="./prd.html">PRD</a><a href="./quiz.html" aria-current="page">문제풀이</a></nav>
      <div className="quiz-account"><span>{profile.name}님</span><a href="./prd.html#/my-page">내 정보 수정</a><button disabled={pending} aria-label={pending ? '로그아웃 처리 중' : undefined} onClick={logout}>{pending ? <span className="moonble-spinner" aria-hidden="true" /> : '로그아웃'}</button></div>
    </header>
    <main className="quiz-main">
      <div className="quiz-title"><p>QUESTION SETS</p><h1>어떤 문제를 풀어볼까요?</h1><span>문제지를 고르면 바로 풀이 모드가 시작됩니다.</span></div>
      <section className="paper-grid" aria-label="문제지 목록">
        {papers.map((paper, index) => <article className="paper-card" key={paper.id}>
          <div className={`paper-cover cover-${index + 1}`} aria-hidden="true"><span>moonble</span><strong>{paper.label}</strong><small>{paper.count} QUESTIONS</small></div>
          <div className="paper-info"><div><span className="paper-badge">{paper.level}</span><span>{paper.count}문항</span></div><h2>{paper.label}</h2><p>{paper.description}</p><a href={`./index.html?view=quiz&paper=${paper.id}#quiz`}>문제 풀기 <span aria-hidden="true">→</span></a></div>
        </article>)}
      </section>
    </main>
  </>;
}
createRoot(document.getElementById('root')).render(<QuizLibrary />);
