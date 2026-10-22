import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { Check, LogOut, Trash2 } from 'lucide-react';
import { cachedAuthSession, getSessionSafely, loginUrl, supabase } from './supabase.js';
import { hasProfile, profileOf } from './profile.js';
import { ProfileForm } from './prd/profile-form.jsx';
import { PrivacyRequest } from './prd/privacy-request.jsx';
import { SiteFooter } from './site-footer.jsx';
import { AppHeader } from './app-header.jsx';
import './design-system.css';
import './prd/shell.css';
import './account-page.css';

let leavingAfterDeletion = false;
const initialSession = cachedAuthSession();
const initialUser = initialSession && hasProfile(initialSession.user) ? initialSession.user : null;
if (initialUser) document.documentElement.removeAttribute('data-auth-pending');

function localDataKeys(userId) {
  const prefixes = [`moonble:${userId}:`, `moonble:user:${userId}:`];
  return Object.keys(localStorage).filter(key => prefixes.some(prefix => key.startsWith(prefix)));
}

function clearLocalUserData(userId) {
  localDataKeys(userId).forEach(key => localStorage.removeItem(key));
  sessionStorage.removeItem('moonble:retry-question-ids');
}

function LocalData({ user }) {
  const [count, setCount] = useState(() => localDataKeys(user.id).length);
  const [confirming, setConfirming] = useState(false);

  function clearData() {
    if (!confirming) { setConfirming(true); return; }
    clearLocalUserData(user.id);
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

function AccountDeletion({ user }) {
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  function changeOpen(next) {
    if (pending) return;
    setOpen(next);
    if (!next) { setConfirmed(false); setError(''); }
  }

  async function deleteAccount() {
    if (!confirmed || pending) return;
    setPending(true);
    setError('');
    try {
      const { error: deleteError } = await supabase.rpc('moonble_delete_account');
      if (deleteError) throw deleteError;
      clearLocalUserData(user.id);
      leavingAfterDeletion = true;
      try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* 계정은 이미 삭제됐으므로 로그인 화면으로 이동한다. */ }
      window.location.replace(new URL('./login.html?account=deleted', window.location.href).href);
    } catch (failure) {
      if (failure?.code === 'PGRST202' || /moonble_delete_account/i.test(failure?.message || '')) {
        setError('회원 탈퇴 기능 설정이 완료되지 않았습니다. 잠시 후 다시 시도해주세요.');
      } else {
        setError('회원 탈퇴를 완료하지 못했습니다. 잠시 후 다시 시도해주세요.');
      }
      setPending(false);
    }
  }

  return <section className="profile-card account-delete-card">
    <h2 className="mb-section-title">회원 탈퇴</h2>
    <p>계정과 프로필을 영구 삭제합니다. 탈퇴한 계정은 복구할 수 없습니다.</p>
    <AlertDialog.Root open={open} onOpenChange={changeOpen}>
      <AlertDialog.Trigger asChild><button className="account-danger" type="button"><Trash2 size={17} aria-hidden="true" />회원 탈퇴</button></AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="account-delete-overlay" />
        <AlertDialog.Content className="account-delete-dialog">
          <AlertDialog.Title>회원 탈퇴할까요?</AlertDialog.Title>
          <AlertDialog.Description>계정과 프로필이 즉시 삭제되며 다시 복구할 수 없습니다.</AlertDialog.Description>
          <ul>
            <li>현재 기기에 저장된 PRD, 문제지와 풀이 기록도 함께 삭제됩니다.</li>
            <li>다른 기기의 브라우저에 남은 데이터는 해당 기기에서 직접 삭제해야 합니다.</li>
          </ul>
          <label className="account-delete-confirm">
            <input type="checkbox" checked={confirmed} disabled={pending} onChange={event => setConfirmed(event.target.checked)} />
            <span className="account-delete-check" aria-hidden="true"><Check size={16} /></span>
            <span>삭제되는 내용을 확인했고 회원 탈퇴에 동의합니다.</span>
          </label>
          {error && <p className="account-delete-error" role="alert">{error}</p>}
          <div className="account-delete-actions">
            <AlertDialog.Cancel asChild><button type="button" className="account-delete-cancel" disabled={pending}>취소</button></AlertDialog.Cancel>
            <button type="button" className="account-delete-submit" disabled={!confirmed || pending} onClick={deleteAccount}>{pending ? <span className="moonble-spinner" aria-hidden="true" /> : '탈퇴하기'}</button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  </section>;
}

function AccountPage() {
  const [user, setUser] = useState(initialUser);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!supabase) { window.location.replace(loginUrl()); return; }
    let alive = true;
    const accept = session => {
      if (!alive) return;
      if (leavingAfterDeletion) return;
      if (!session) { window.location.replace(loginUrl()); return; }
      if (!hasProfile(session.user)) { window.location.replace(new URL('./prd.html#/register-name', location.href)); return; }
      setUser(session.user);
      document.documentElement.removeAttribute('data-auth-pending');
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) accept(session);
      else if (event === 'SIGNED_OUT') window.location.replace(loginUrl());
    });
    getSessionSafely().then(({ session, error: sessionError }) => sessionError || !session ? window.location.replace(loginUrl()) : accept(session));
    return () => { alive = false; subscription.unsubscribe(); };
  }, []);

  async function logout() {
    setPending(true); setError('');
    try {
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
      if (signOutError) throw signOutError;
    } catch { setError('로그아웃하지 못했습니다. 다시 시도해주세요.'); setPending(false); }
  }

  if (!user) return <div className="workspace-check" role="status" aria-label="계정 정보 여는 중"><span className="moonble-spinner" aria-hidden="true" /></div>;
  const profile = profileOf(user);
  const profileInitial = [...(profile.name || 'M')][0];
  return <>
    <AppHeader active="account" user={user} pending={pending} error={error} onLogout={logout} />
    <main className="account-main mb-page-gutter">
      <div className="account-heading"><h1 className="mb-page-title">내 정보</h1></div>
      <section className="account-profile-summary" aria-label="현재 프로필">
        <span className="account-profile-avatar" aria-hidden="true">{profileInitial}</span>
        <div><strong>{profile.name}</strong><p>{profile.companyName}</p><small>{user.email}</small></div>
      </section>
      <ProfileForm user={user} initial={false} onSaved={setUser} />
      <section className="profile-card account-mobile-session">
        <div><h2 className="mb-section-title">로그인 관리</h2><p>현재 기기에서 Moonble 계정 사용을 마칠 수 있어요.</p></div>
        {error && <p className="account-session-error" role="alert">{error}</p>}
        <button className="account-logout-action" type="button" disabled={pending} onClick={logout}>
          {pending ? <span className="moonble-spinner" aria-hidden="true" /> : <LogOut size={18} aria-hidden="true" />}
          <span>{pending ? '로그아웃 중' : '로그아웃'}</span>
        </button>
      </section>
      <LocalData user={user} />
      <PrivacyRequest user={user} />
      <AccountDeletion user={user} />
    </main>
    <SiteFooter />
  </>;
}

createRoot(document.getElementById('root')).render(<AccountPage />);
