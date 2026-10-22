import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { cachedAuthSession, getSessionSafely, loginUrl, supabase } from './supabase.js';
import { hasProfile } from './profile.js';
import { AppHeader } from './app-header.jsx';

let leavingHome = false;
const initialSession = cachedAuthSession();
const initialUser = initialSession && hasProfile(initialSession.user) ? initialSession.user : null;
if (initialUser) {
  window.moonbleUserId = initialUser.id;
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

createRoot(document.getElementById('moonble-app-header')).render(<Account />);
