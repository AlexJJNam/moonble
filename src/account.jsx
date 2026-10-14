import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { loginUrl, supabase } from './supabase.js';
import { hasProfile } from './profile.js';
import { SiteFooter } from './site-footer.jsx';

let leavingHome = false;
function requireLogin() {
  document.documentElement.setAttribute('data-auth-pending', '');
  if (leavingHome) return;
  leavingHome = true;
  window.location.replace(loginUrl());
}

function Account() {
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
      if (new URLSearchParams(window.location.search).get('view') !== 'quiz') {
        leavingHome = true;
        window.location.replace(new URL('./quiz.html', window.location.href).href);
        return;
      }
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

  return <>
    {checking ? <span className="btn" role="status" aria-label="계정 확인 중"><span className="moonble-spinner" aria-hidden="true" /></span> : user
      ? <><a className="btn btn-ghost" href="./prd.html#/my-page">내 정보 수정</a><button className="btn btn-ghost" type="button" disabled={pending} aria-label={pending ? '로그아웃 처리 중' : undefined} onClick={logout}>{pending ? <span className="moonble-spinner" aria-hidden="true" /> : '로그아웃'}</button></>
      : <a className="btn btn-ghost" href="./login.html">로그인 / 회원가입</a>}
    {error && <span role="alert">{error}</span>}
  </>;
}

createRoot(document.getElementById('moonble-account')).render(<Account />);
createRoot(document.getElementById('moonble-footer')).render(<SiteFooter />);
