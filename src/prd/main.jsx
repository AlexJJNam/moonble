import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { supabase, loginUrl } from '../supabase.js';
import { hasProfile, profileOf } from '../profile.js';
import { ProfileForm } from './profile-form.jsx';
import { PrivacyRequest } from './privacy-request.jsx';
import { SiteFooter } from '../site-footer.jsx';
import { setStorageUser } from './storage.js';
import { useRoute, useRouter } from './navigation.jsx';
import PrdList from './app/list/page';
import { PrdStudio } from './components/prd-studio';
import { Toaster } from './components/ui/toaster';
import '../design-system.css';
import './app/globals.css';
import './shell.css';

class WorkspaceBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <p role="alert" className="profile-card">PRD 데이터를 불러오지 못했습니다. 브라우저 저장 공간을 확인한 뒤 새로고침해주세요. 기존 데이터는 삭제하지 않았습니다.</p>;
    return this.props.children;
  }
}
function Workspace() {
  const [user, setUser] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const route = useRoute();
  const router = useRouter();
  const path = route.split('?')[0];
  useEffect(() => {
    if (!supabase) { window.location.replace(loginUrl()); return; }
    let alive = true;
    const accept = session => {
      if (!alive) return;
      if (!session) {
        setUser(null); setStorageUser(null);
        window.location.replace(loginUrl());
        return;
      }
      setStorageUser(session.user);
      setUser(session.user);
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => accept(session));
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) { if (alive) window.location.replace(loginUrl()); return; }
      accept(data.session);
    }).catch(() => { if (alive) window.location.replace(loginUrl()); });
    return () => { alive = false; subscription.unsubscribe(); setStorageUser(null); };
  }, []);
  async function logout() {
    setPending(true); setError('');
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
    } catch { setError('로그아웃하지 못했습니다. 다시 시도해주세요.'); }
    finally { setPending(false); }
  }
  if (!user) return <p className="profile-card" role="status">로그인 상태를 확인하고 있습니다…</p>;
  const initial = !hasProfile(user);
  const profile = profileOf(user);
  return <>
    <header className="workspace-header no-print">
      <a href="#/list" className="workspace-logo" aria-label="Moonble PRD 홈"><svg viewBox="0 0 140 28" role="img" aria-label="moonble"><text x="0" y="21" fontFamily="'Pretendard', ui-sans-serif, sans-serif" fontWeight="800" fontSize="28" letterSpacing="-0.6" fill="#3182f6">moonble</text></svg></a>
      <nav aria-label="주 메뉴"><a href="#/list" aria-current={path !== '/my-page' ? 'page' : undefined}>PRD</a><a href="./quiz.html">문제풀이</a></nav>
      <div className="workspace-account"><span>{profile.name ? `${profile.name}님` : user.email}</span><a href="#/my-page" aria-current={path === '/my-page' ? 'page' : undefined}>내 정보 수정</a><button disabled={pending} aria-label={pending ? '로그아웃 처리 중' : undefined} onClick={logout}>{pending ? <span className="moonble-spinner" aria-hidden="true" /> : '로그아웃'}</button></div>
    </header>
    {error && <p role="alert" className="shell-error">{error}</p>}
    {initial || path === '/my-page' || path === '/register-name'
      ? <ProfileForm key={`${user.id}:${initial}`} user={user} initial={initial} onSaved={updated => {
          setStorageUser(updated); setUser(updated);
          if (initial) router.replace('/list');
        }} />
      : <WorkspaceBoundary key={user.id}>
          <p className="storage-note no-print">PRD 문서는 현재 브라우저에 저장됩니다.</p>
          {path.startsWith('/edit/')
            ? <PrdStudio key={route} prdId={path === '/edit/new' ? undefined : path.slice('/edit/'.length)} />
            : <PrdList key={`${user.id}:${profile.name}:${profile.companyName}`} />}
        </WorkspaceBoundary>}
    {!initial && path === '/my-page' && <PrivacyRequest user={user} />}
    <SiteFooter />
    <Toaster />
  </>;
}
createRoot(document.getElementById('root')).render(<Workspace />);
