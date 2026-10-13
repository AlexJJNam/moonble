import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { supabase } from './supabase.js';

function Account() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(Boolean(supabase));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (alive) { setUser(session?.user ?? null); setChecking(false); }
    });
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!alive) return;
      setUser(data.session?.user ?? null);
      setChecking(false);
      if (sessionError) setError('로그인 상태 확인 실패');
    }).catch(() => { if (alive) { setChecking(false); setError('로그인 상태 확인 실패'); } });
    return () => { alive = false; subscription.unsubscribe(); };
  }, []);

  async function logout() {
    setPending(true);
    setError('');
    try {
      const { error: authError } = await supabase.auth.signOut({ scope: 'local' });
      if (authError) throw authError;
      setUser(null);
    } catch { setError('로그아웃 실패. 다시 시도해주세요.'); }
    finally { setPending(false); }
  }

  return <>
    {checking ? <span className="btn" role="status">계정 확인 중…</span> : user
      ? <button className="btn btn-ghost" type="button" disabled={pending} onClick={logout}>{pending ? '처리 중…' : '로그아웃'}</button>
      : <a className="btn btn-ghost" href="./login.html">로그인 / 회원가입</a>}
    {error && <span role="alert">{error}</span>}
  </>;
}

createRoot(document.getElementById('moonble-account')).render(<Account />);
