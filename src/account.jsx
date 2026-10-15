import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { loginUrl, supabase } from './supabase.js';
import { hasProfile } from './profile.js';
import { SiteFooter } from './site-footer.jsx';
import { AppHeader } from './app-header.jsx';

let leavingHome = false;
function requireLogin() {
  document.documentElement.setAttribute('data-auth-pending', '');
  if (leavingHome) return;
  leavingHome = true;
  window.location.replace(loginUrl());
}

function Account() {
  const solverPage = window.location.pathname.endsWith('/solve.html');
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(Boolean(supabase));
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      acceptSession(session);
    });
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!alive) return;
      if (sessionError) { requireLogin(); return; }
      acceptSession(data.session);
    }).catch(() => { if (alive) requireLogin(); });
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

  if (checking) return <div className="workspace-check" role="status"><span className="moonble-spinner" aria-hidden="true" /><span className="mb-sr-only">계정 확인 중</span></div>;
  if (!user) return null;
  return <AppHeader active="papers" variant={solverPage ? 'solver' : 'default'} user={user} pending={pending} error={error} onLogout={logout} />;
}

createRoot(document.getElementById('moonble-app-header')).render(<Account />);
createRoot(document.getElementById('moonble-footer')).render(<SiteFooter />);
