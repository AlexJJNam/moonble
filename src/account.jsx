import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { cachedAuthSession, getSessionSafely, loginUrl, supabase } from './supabase.js';
import { hasProfile } from './profile.js';
import { AppHeader } from './app-header.jsx';

let leavingHome = false;
const initialSession = cachedAuthSession();
const initialUser = initialSession && hasProfile(initialSession.user) ? initialSession.user : null;

function syncAiQuestionProvider(user) {
  const saved = user?.user_metadata?.aiQuestionProvider;
  if (saved === 'chatgpt' || saved === 'gemini') {
    window.moonbleAiQuestionProvider = saved;
    return;
  }
  try {
    window.moonbleAiQuestionProvider = localStorage.getItem(`moonble:user:${user.id}:ai-question-provider`) === 'chatgpt' ? 'chatgpt' : 'gemini';
  } catch {
    window.moonbleAiQuestionProvider = 'gemini';
  }
}

if (initialUser) {
  window.moonbleUserId = initialUser.id;
  syncAiQuestionProvider(initialUser);
  document.documentElement.removeAttribute('data-auth-pending');
}

function requireLogin() {
  document.documentElement.setAttribute('data-auth-pending', '');
  if (leavingHome) return;
  leavingHome = true;
  window.location.replace(loginUrl());
}

function Account() {
  const solverPage = window.location.pathname.endsWith('/solve.html');
  const [user, setUser] = useState(initialUser);
  const [checking, setChecking] = useState(Boolean(supabase) && !initialUser);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!supabase) { requireLogin(); return; }
    let alive = true;
    function acceptSession(session) {
      if (!alive || leavingHome) return;
      if (!session) { requireLogin(); return; }
      if (!hasProfile(session.user)) {
        leavingHome = true;
        window.location.replace(new URL('./prd.html', window.location.href).href);
        return;
      }
      window.moonbleUserId = session.user.id;
      syncAiQuestionProvider(session.user);
      setUser(session.user);
      setChecking(false);
      document.documentElement.removeAttribute('data-auth-pending');
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) acceptSession(session);
      else if (event === 'SIGNED_OUT') requireLogin();
    });
    getSessionSafely().then(({ session, error: sessionError }) => {
      if (!alive) return;
      if (sessionError) { requireLogin(); return; }
      acceptSession(session);
    });
    return () => { alive = false; subscription.unsubscribe(); };
  }, []);

  async function logout() {
    setPending(true);
    setError('');
    try {
      const { error: authError } = await supabase.auth.signOut({ scope: 'local' });
      if (authError) throw authError;
      setUser(null);
      requireLogin();
    } catch { setError('로그아웃 실패. 다시 시도해주세요.'); }
    finally { setPending(false); }
  }

  if (checking) return <div className="workspace-check" role="status" aria-label="계정 여는 중"><span className="moonble-spinner" aria-hidden="true" /></div>;
  if (!user) return null;
  return <AppHeader active="papers" variant={solverPage ? 'solver' : 'default'} user={user} pending={pending} error={error} onLogout={logout} />;
}

const isSharedSolve = Boolean(window.__moonbleSharedQuizToken || new URLSearchParams(window.location.search).get('paper') === 'shared');
// 공유 풀이: 문블 안의 다른 화면에서 왔으면 그 화면으로, 로그인 상태면 문제지로 가는 뒤로가기(<)를 보여준다.
// 링크만 받아 바로 연(돌아갈 곳이 없는) 경우에만 로고를 둔다.
function sharedSolveBack() {
  let fromApp = false;
  try {
    const referrer = document.referrer ? new URL(document.referrer) : null;
    fromApp = Boolean(referrer && referrer.origin === window.location.origin && !referrer.pathname.endsWith('/solve.html'));
  } catch { fromApp = false; }
  if (fromApp) return { label: '뒤로', ariaLabel: '이전 화면으로', onClick: event => { event.preventDefault(); window.history.back(); } };
  if (cachedAuthSession()?.user) return { label: '문제지', href: './quiz.html#paper-library' };
  return null;
}
const headerRoot = createRoot(document.getElementById('moonble-app-header'));
if (isSharedSolve) {
  const back = sharedSolveBack();
  headerRoot.render(<AppHeader active="papers" hideSolverBack={!back} solverBack={back} user={null} variant="solver" />);
} else {
  headerRoot.render(<Account />);
}
