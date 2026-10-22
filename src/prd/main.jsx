import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { cachedAuthSession, getSessionSafely, supabase, loginUrl } from '../supabase.js';
import { hasProfile, profileOf } from '../profile.js';
import { ProfileForm } from './profile-form.jsx';
import { SiteFooter } from '../site-footer.jsx';
import { AppHeader } from '../app-header.jsx';
import { setStorageUser } from './storage.js';
import { useRoute, useRouter } from './navigation.jsx';
import PrdList from './app/list/page';
import { PrdStudio } from './components/prd-studio';
import { Toaster } from './components/ui/toaster';
import '../design-system.css';
import './app/globals.css';
import './shell.css';

const initialSession = cachedAuthSession();
const initialUser = initialSession?.user || null;
if (initialUser) setStorageUser(initialUser);

class WorkspaceBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <p role="alert" className="profile-card">PRD 데이터를 불러오지 못했습니다. 브라우저 저장 공간을 확인한 뒤 새로고침해주세요. 기존 데이터는 삭제하지 않았습니다.</p>;
    return this.props.children;
  }
}
function Workspace() {
  const [user, setUser] = useState(initialUser);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const route = useRoute();
  const router = useRouter();
  const path = route.split('?')[0];
  const showFooter = path !== '/register-name' && !path.startsWith('/edit/');
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) accept(session);
      else if (event === 'SIGNED_OUT') accept(null);
    });
    getSessionSafely().then(({ session, error }) => {
      if (error || !session) { if (alive) window.location.replace(loginUrl()); return; }
      accept(session);
    });
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
  if (!user) return <div className="workspace-check" role="status" aria-label="PRD 여는 중"><span className="moonble-spinner" aria-hidden="true" /></div>;
  const initial = !hasProfile(user);
  const profile = profileOf(user);
  if (path === '/my-page') {
    window.location.replace(new URL('./account.html', window.location.href));
    return <div className="workspace-check" role="status"><span className="moonble-spinner" aria-hidden="true" /><span className="mb-sr-only">내 계정으로 이동 중</span></div>;
  }
  return <>
    <AppHeader active="prd" user={user} pending={pending} error={error} onLogout={logout} />
    {initial || path === '/register-name'
      ? <ProfileForm key={`${user.id}:${initial}`} user={user} initial={initial} onSaved={updated => {
          setStorageUser(updated); setUser(updated);
          if (initial) window.location.replace(new URL('./quiz.html', window.location.href).href);
        }} />
      : <WorkspaceBoundary key={user.id}>
          {path.startsWith('/edit/')
            ? <PrdStudio key={route} prdId={path === '/edit/new' ? undefined : path.slice('/edit/'.length)} />
            : <PrdList key={`${user.id}:${profile.name}:${profile.companyName}`} />}
        </WorkspaceBoundary>}
    {showFooter && <SiteFooter />}
    <Toaster />
  </>;
}
createRoot(document.getElementById('root')).render(<Workspace />);
