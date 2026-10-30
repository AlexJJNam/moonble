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
import { WorkspaceTabs } from '../section-tabs.jsx';
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
// 시간표 설정 탭: 기능을 준비하는 동안 같은 페이지 규격으로 안내만 보여준다.
function WorkspaceSchedule() {
  return <main className="prd-list-page min-h-screen bg-white no-print">
    <div className="prd-list-shell mb-page-gutter">
      <WorkspaceTabs current="schedule" className="quiz-library-tabs--desktop" />
      <div className="prd-list-heading mb-4"><h1 className="mb-page-title">시간표 설정</h1></div>
      <section className="workspace-empty" aria-label="시간표 설정 안내">
        <strong>시간표 설정을 준비하고 있어요</strong>
        <p>곧 이곳에서 시간표를 설정할 수 있어요.</p>
      </section>
    </div>
  </main>;
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
  // 워크스페이스 상위 탭: 시간표 설정 · PRD(기본). PRD 편집 화면에서는 탭을 숨긴다.
  const workspaceSection = path === '/schedule' ? 'schedule' : (path === '/list' || path === '/' || path === '') ? 'prd' : null;
  const showTabs = Boolean(workspaceSection) && !initial;
  return <>
    <AppHeader active="prd" user={user} pending={pending} error={error} onLogout={logout} mobileSubnav={showTabs ? <WorkspaceTabs current={workspaceSection} /> : null} />
    {initial || path === '/register-name'
      ? <ProfileForm key={`${user.id}:${initial}`} user={user} initial={initial} onSaved={updated => {
          setStorageUser(updated); setUser(updated);
          if (initial) window.location.replace(new URL('./quiz.html', window.location.href).href);
        }} />
      : <WorkspaceBoundary key={user.id}>
          {path.startsWith('/edit/')
            ? <PrdStudio key={route} prdId={path === '/edit/new' ? undefined : path.slice('/edit/'.length)} />
            : workspaceSection === 'schedule'
              ? <WorkspaceSchedule />
              : <PrdList key={`${user.id}:${profile.name}:${profile.companyName}`} tabs={<WorkspaceTabs current="prd" className="quiz-library-tabs--desktop" />} />}
        </WorkspaceBoundary>}
    {showFooter && <SiteFooter />}
    <Toaster />
  </>;
}
createRoot(document.getElementById('root')).render(<Workspace />);
