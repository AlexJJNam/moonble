import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Trash2 } from 'lucide-react';
import { loginUrl, supabase } from './supabase.js';
import { hasProfile } from './profile.js';
import { ProfileForm } from './prd/profile-form.jsx';
import { PrivacyRequest } from './prd/privacy-request.jsx';
import { SiteFooter } from './site-footer.jsx';
import { AppHeader } from './app-header.jsx';
import './design-system.css';
import './prd/shell.css';
import './account-page.css';

function LocalData({ user }) {
  const prefixes = useMemo(() => [`moonble:${user.id}:`, `moonble:user:${user.id}:`], [user.id]);
  const [count, setCount] = useState(() => Object.keys(localStorage).filter(key => prefixes.some(prefix => key.startsWith(prefix))).length);
  const [confirming, setConfirming] = useState(false);

  function clearData() {
    if (!confirming) { setConfirming(true); return; }
    Object.keys(localStorage).filter(key => prefixes.some(prefix => key.startsWith(prefix))).forEach(key => localStorage.removeItem(key));
    setCount(0);
    setConfirming(false);
  }

  return <section className="profile-card local-data-card">
    <h2 className="mb-section-title">이 기기의 저장 데이터</h2>
    <p>PRD, 직접 만든 문제지와 풀이 기록은 계정별로 이 브라우저에 저장됩니다. 다른 기기와 자동으로 동기화되지 않습니다.</p>
    <p className="local-data-count">저장 항목 <strong>{count}</strong>개</p>
    <button className="account-danger" type="button" onClick={clearData}><Trash2 size={17} />{confirming ? '정말 모두 삭제하기' : '이 기기의 내 데이터 삭제'}</button>
    {confirming && <p className="account-danger-note" role="alert">삭제한 로컬 데이터는 복구할 수 없습니다. 계정과 프로필은 삭제되지 않습니다.</p>}
  </section>;
}

function AccountPage() {
  const [user, setUser] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!supabase) { window.location.replace(loginUrl()); return; }
    let alive = true;
    const accept = session => {
      if (!alive) return;
      if (!session) { window.location.replace(loginUrl()); return; }
      if (!hasProfile(session.user)) { window.location.replace(new URL('./prd.html#/register-name', location.href)); return; }
      setUser(session.user);
      document.documentElement.removeAttribute('data-auth-pending');
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => accept(session));
    supabase.auth.getSession().then(({ data, error: sessionError }) => sessionError ? window.location.replace(loginUrl()) : accept(data.session)).catch(() => window.location.replace(loginUrl()));
    return () => { alive = false; subscription.unsubscribe(); };
  }, []);

  async function logout() {
    setPending(true); setError('');
    try {
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
      if (signOutError) throw signOutError;
    } catch { setError('로그아웃하지 못했습니다. 다시 시도해주세요.'); setPending(false); }
  }

  if (!user) return <div className="workspace-check" role="status"><span className="moonble-spinner" aria-hidden="true" /><span className="mb-sr-only">계정 정보 확인 중</span></div>;
  return <>
    <AppHeader active="account" user={user} pending={pending} error={error} onLogout={logout} />
    <main className="account-main">
      <div className="account-heading"><h1 className="mb-page-title">내 계정</h1><p>프로필과 이 기기에 저장된 데이터를 관리할 수 있어요.</p></div>
      <ProfileForm user={user} initial={false} onSaved={setUser} />
      <LocalData user={user} />
      <PrivacyRequest user={user} />
    </main>
    <SiteFooter />
  </>;
}

createRoot(document.getElementById('root')).render(<AccountPage />);
