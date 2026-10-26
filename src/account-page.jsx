import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { Bell, Check, CircleHelp, LogOut, UserRoundX } from 'lucide-react';
import { cachedAuthSession, getSessionSafely, loginUrl, supabase } from './supabase.js';
import { hasProfile, profileOf } from './profile.js';
import { ProfileForm } from './prd/profile-form.jsx';
import { SiteFooter } from './site-footer.jsx';
import { AppHeader } from './app-header.jsx';
import { ProfilePhotoEditor } from './profile-photo-editor.jsx';
import { clearProfileAvatarFiles } from './profile-avatar.js';
import { disableBrowserNotifications, enableBrowserNotifications, getBrowserNotificationSettings } from './browser-notifications.js';
import './design-system.css';
import './prd/shell.css';
import './account-page.css';

let leavingAfterDeletion = false;
const initialSession = cachedAuthSession();
const initialUser = initialSession && hasProfile(initialSession.user) ? initialSession.user : null;
if (initialUser) document.documentElement.removeAttribute('data-auth-pending');

function localDataKeys(userId) {
  try {
    const prefixes = [`moonble:${userId}:`, `moonble:user:${userId}:`];
    return Object.keys(localStorage).filter(key => prefixes.some(prefix => key.startsWith(prefix)));
  } catch {
    return [];
  }
}

function clearLocalUserData(userId) {
  localDataKeys(userId).forEach(key => {
    try { localStorage.removeItem(key); } catch { /* 원격 계정 삭제 결과를 브라우저 저장소 상태와 분리한다. */ }
  });
  try { sessionStorage.removeItem('moonble:retry-question-ids'); } catch { /* 현재 탭의 임시 기록만 정리한다. */ }
}

const aiProviderOptions = [
  { value: 'gemini', label: 'AI Mode' },
  { value: 'chatgpt', label: 'ChatGPT' },
];

function getAiQuestionProvider(user) {
  const saved = user?.user_metadata?.aiQuestionProvider;
  if (saved === 'chatgpt' || saved === 'gemini') return saved;
  try {
    return localStorage.getItem(`moonble:user:${user.id}:ai-question-provider`) === 'chatgpt' ? 'chatgpt' : 'gemini';
  } catch {
    return 'gemini';
  }
}

function AiQuestionPreference({ user, onUserUpdated }) {
  const [provider, setProvider] = useState(() => getAiQuestionProvider(user));
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setProvider(getAiQuestionProvider(user));
    setMessage('');
    setError('');
  }, [user.id, user.user_metadata?.aiQuestionProvider]);

  async function saveProvider(nextProvider) {
    if (pending || nextProvider === provider) return;
    const previousProvider = provider;
    setProvider(nextProvider);
    setPending(true);
    setMessage('');
    setError('');
    try {
      const { data, error: updateError } = await supabase.auth.updateUser({
        data: { ...(user.user_metadata || {}), aiQuestionProvider: nextProvider },
      });
      if (updateError) throw updateError;
      try { localStorage.setItem(`moonble:user:${user.id}:ai-question-provider`, nextProvider); } catch { /* 계정 메타데이터에 저장되어 다른 기기에서도 사용할 수 있다. */ }
      window.moonbleAiQuestionProvider = nextProvider;
      onUserUpdated(data.user);
      setMessage(`${nextProvider === 'gemini' ? 'AI Mode' : 'ChatGPT'}를 기본 AI로 저장했어요.`);
    } catch {
      setProvider(previousProvider);
      setError('설정을 저장하지 못했어요. 다시 시도해주세요.');
    } finally {
      setPending(false);
    }
  }

  return <section className="account-ai-preference" aria-labelledby="account-ai-preference-title">
    <div className="account-ai-title"><h2 id="account-ai-preference-title" className="mb-section-title">문제풀이 AI</h2><button className="account-ai-help" type="button" aria-label="문제풀이 AI 설정 안내" aria-describedby="account-ai-help-copy"><CircleHelp size={16} aria-hidden="true" /><span id="account-ai-help-copy" role="tooltip">문제풀이 중 ‘AI에게 물어보기’를 누르면 답변할 AI를 여기서 선택할 수 있어요.</span></button></div>
    <div className="account-ai-provider" role="group" aria-label="AI에게 물어보기 기본 서비스">
      {aiProviderOptions.map(option => <button
        key={option.value}
        type="button"
        className={provider === option.value ? 'is-selected' : ''}
        aria-pressed={provider === option.value}
        disabled={pending}
        onClick={() => saveProvider(option.value)}
      >{provider === option.value && <svg aria-hidden="true" className="account-ai-provider-check" viewBox="0 0 48 48"><circle cx="24" cy="24" r="24" /><path d="M13.5 24.8l7 7L35 17.5" /></svg>}{option.label}</button>)}
    </div>
    {message && <p role="status">{message}</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}

function PushNotificationPreference({ userId }) {
  const [settings, setSettings] = useState(() => getBrowserNotificationSettings(userId));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const refresh = () => setSettings(getBrowserNotificationSettings(userId));
    const onPreferenceChange = event => {
      if (!event.detail?.userId || event.detail.userId === userId) refresh();
    };
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    window.addEventListener('moonble:browser-notifications-changed', onPreferenceChange);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', refresh);
      window.removeEventListener('moonble:browser-notifications-changed', onPreferenceChange);
    };
  }, [userId]);

  async function toggleNotifications() {
    if (busy) return;
    setMessage('');
    if (settings.enabled) {
      setBusy(true);
      try {
        setSettings(await disableBrowserNotifications(userId));
      } catch {
        setMessage('푸시 알림을 끄지 못했어요. 다시 시도해주세요.');
      } finally {
        setBusy(false);
      }
      return;
    }
    if (['denied', 'unsupported', 'insecure', 'install-required', 'unconfigured'].includes(settings.permission)) {
      setMessage(settings.permission === 'denied'
        ? '브라우저 사이트 설정에서 알림을 허용해주세요.'
        : settings.permission === 'insecure'
          ? '보안 연결에서 접속해 알림을 설정해주세요.'
          : settings.permission === 'install-required'
            ? 'iPhone·iPad에서는 문블을 홈 화면에 추가한 뒤 앱에서 알림을 켤 수 있어요.'
            : settings.permission === 'unconfigured'
              ? '푸시 알림 서버 설정을 준비하고 있어요.'
              : '현재 브라우저에서는 알림을 사용할 수 없어요.');
      return;
    }
    setBusy(true);
    try {
      const next = await enableBrowserNotifications(userId);
      setSettings(next);
      if (!next.enabled) setMessage('알림 권한을 허용해주세요.');
    } catch {
      setMessage('알림 권한을 요청하지 못했어요. 브라우저 설정을 확인해주세요.');
    } finally {
      setBusy(false);
    }
  }

  const unavailable = ['denied', 'unsupported', 'insecure', 'install-required', 'unconfigured'].includes(settings.permission);
  return <section className="account-push-preference" aria-labelledby="account-push-preference-title">
    <h2 id="account-push-preference-title" className="mb-section-title">알림</h2>
    <div className="account-push-option">
      <span className="account-push-icon" aria-hidden="true"><Bell size={18} /></span>
      <span className="account-push-copy"><strong>푸시 알림</strong><small>{settings.permission === 'denied' ? '브라우저에서 차단됨' : settings.permission === 'unsupported' ? '이 브라우저에서는 사용할 수 없음' : settings.permission === 'insecure' ? '보안 연결에서 설정할 수 있음' : settings.permission === 'install-required' ? '홈 화면에 추가한 앱에서 사용 가능' : settings.permission === 'unconfigured' ? '푸시 서버 설정 대기 중' : '공유한 문제의 풀이 결과 알림'}</small></span>
      <button className={`account-push-switch${settings.enabled ? ' is-on' : ''}`} type="button" role="switch" aria-checked={settings.enabled} aria-label="푸시 알림" aria-describedby={message || unavailable ? 'account-push-help' : undefined} aria-busy={busy} disabled={busy || unavailable} onClick={toggleNotifications}><span /></button>
    </div>
    {(message || unavailable) && <p id="account-push-help" className={`account-push-message${message && settings.permission === 'denied' ? ' is-error' : ''}`} role={message ? 'status' : undefined}>{message || (settings.permission === 'denied' ? '브라우저 사이트 설정에서 문블의 알림을 허용해주세요.' : settings.permission === 'insecure' ? 'HTTPS 보안 연결에서 접속하면 알림을 켤 수 있어요.' : settings.permission === 'install-required' ? 'iPhone·iPad에서는 홈 화면에 추가한 문블 앱에서 푸시 알림을 설정할 수 있어요.' : settings.permission === 'unconfigured' ? '푸시 알림 서버 설정을 준비하고 있어요.' : '현재 브라우저에서는 알림을 지원하지 않아요.')}</p>}
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
      await clearProfileAvatarFiles(user);
      const { error: deleteError } = await supabase.rpc('moonble_delete_account');
      if (deleteError && deleteError.code !== 'P0002') throw deleteError;
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

  return <AlertDialog.Root open={open} onOpenChange={changeOpen}>
      <AlertDialog.Trigger asChild><button className="account-delete-action" type="button"><span className="account-delete-icon" aria-hidden="true"><UserRoundX size={18} /></span><span>회원 탈퇴</span></button></AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="account-delete-overlay" />
        <AlertDialog.Content className="account-delete-dialog">
          <AlertDialog.Title>회원 탈퇴할까요?</AlertDialog.Title>
          <AlertDialog.Description>계정, 프로필, 문제지, 그룹, 공유 링크와 관련 알림이 즉시 삭제되며 다시 복구할 수 없습니다.</AlertDialog.Description>
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
    </AlertDialog.Root>;
}

function AccountPage() {
  const [user, setUser] = useState(initialUser);
  const [profileEditing, setProfileEditing] = useState(false);
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
  return <>
    <AppHeader active="account" user={user} pending={pending} error={error} onLogout={logout} />
    <main className="account-main mb-page-gutter">
      <div className="account-heading"><h1 className="mb-page-title">내 정보</h1></div>
      <section className="account-profile-summary" aria-label="현재 프로필">
        <ProfilePhotoEditor user={user} onSaved={setUser} />
        <div>
          <div className="account-profile-name"><strong>{profile.name}</strong></div>
          <p>{profile.companyName}</p><small>{user.email}</small>
        </div>
      </section>
      <ProfileForm user={user} initial={false} editing={profileEditing} onEditingChange={setProfileEditing} onSaved={updatedUser => {
        setUser(updatedUser);
        setProfileEditing(false);
      }} />
      <AiQuestionPreference user={user} onUserUpdated={setUser} />
      <PushNotificationPreference userId={user.id} />
      <section className="profile-card account-mobile-session">
        <div><h2 className="mb-section-title">로그인 관리</h2></div>
        {error && <p className="account-session-error" role="alert">{error}</p>}
        <button className="account-logout-action" type="button" disabled={pending} onClick={logout}>
          <span className="account-logout-icon" aria-hidden="true">
            {pending ? <span className="moonble-spinner" /> : <LogOut size={18} />}
          </span>
          <span className="account-logout-label">{pending ? '로그아웃 중' : '로그아웃'}</span>
        </button>
        <AccountDeletion user={user} />
      </section>
    </main>
    <SiteFooter />
  </>;
}

createRoot(document.getElementById('root')).render(<AccountPage />);
