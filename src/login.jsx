import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { authCallback, goHome, loginUrl, supabase } from './supabase.js';
import { SiteFooter } from './site-footer.jsx';
import { signupConsents } from './policy.js';
import './design-system.css';
import './login.css';

function Login() {
  const signupPage = window.location.pathname.endsWith('/signup') || window.location.pathname.endsWith('/signup.html');
  const [mode, setMode] = useState(signupPage ? 'register' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [checking, setChecking] = useState(Boolean(supabase));
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    const recovery = authCallback.recovery;
    const callbackError = authCallback.error;
    if (callbackError) {
      setError('인증 링크가 유효하지 않거나 만료됐습니다. 다시 요청해주세요.');
      window.history.replaceState(null, '', window.location.pathname);
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!alive) return;
      if (event === 'PASSWORD_RECOVERY') {
        setMode('update');
        setMessage('새 비밀번호를 입력해주세요.');
      } else if (session && !recovery && !callbackError && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')) {
        goHome();
      }
    });
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!alive) return;
      setChecking(false);
      if (sessionError) setError('로그인 상태를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.');
      if (data.session && recovery) {
        setMode('update');
        setMessage('새 비밀번호를 입력해주세요.');
      }
    }).catch(() => {
      if (alive) { setChecking(false); setError('연결을 확인한 뒤 다시 시도해주세요.'); }
    });
    return () => { alive = false; subscription.unsubscribe(); };
  }, []);

  function switchMode(next) {
    setMode(next);
    setPassword('');
    setConfirmation('');
    setVisible(false);
    setMessage('');
    setError('');
  }

  async function submit(event) {
    event.preventDefault();
    if (!supabase || pending) return;
    setError('');
    setMessage('');
    if (mode === 'register' && (!termsAccepted || !privacyAccepted)) {
      setError('필수 이용약관과 개인정보 수집·이용에 동의해주세요.');
      return;
    }
    if ((mode === 'register' || mode === 'update') && password !== confirmation) {
      setError('비밀번호 확인이 일치하지 않습니다.');
      return;
    }
    if ((mode === 'register' || mode === 'update') && (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[^a-zA-Z0-9\s]/.test(password) || /\s|[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(password))) {
      setError('비밀번호는 공백·한글 없이 영문과 특수문자를 포함해 8자 이상 입력해주세요.');
      return;
    }
    setPending(true);
    try {
      if (mode === 'login') {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) throw authError;
        goHome();
      } else if (mode === 'register') {
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(), password, options: { emailRedirectTo: loginUrl(), data: { signup_consents: signupConsents() } },
        });
        if (authError) throw authError;
        setPassword('');
        setConfirmation('');
        if (data.session) goHome();
        else setMessage('가입 요청을 처리했습니다. 받은 메일의 인증 링크를 확인해주세요. 이미 가입했다면 로그인하거나 비밀번호를 재설정해주세요.');
      } else if (mode === 'reset') {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: loginUrl() });
        if (authError) throw authError;
        setMessage('재설정 요청을 처리했습니다. 해당 계정이 있다면 이메일을 확인해주세요.');
      } else {
        const { error: authError } = await supabase.auth.updateUser({ password });
        if (authError) throw authError;
        // 재설정 후 남아 있는 복구 세션은 종료하고 새 비밀번호로 로그인하도록 합니다.
        const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
        if (signOutError) throw signOutError;
        switchMode('login');
        window.history.replaceState(null, '', window.location.pathname);
        setMessage('비밀번호를 변경했습니다. 새 비밀번호로 로그인해주세요.');
      }
    } catch (failure) {
      if (failure?.status === 429) setError('요청이 많습니다. 잠시 후 다시 시도해주세요.');
      else if (mode === 'login') setError('이메일·비밀번호와 이메일 인증 여부를 확인해주세요. 연결 상태도 확인해주세요.');
      else if (mode === 'update') setError('변경을 완료하지 못했습니다. 인증 링크를 다시 요청하거나 잠시 후 시도해주세요.');
      else setError('요청을 완료하지 못했습니다. 연결 상태를 확인하고 잠시 후 다시 시도해주세요.');
    } finally {
      setPending(false);
    }
  }

  const newPassword = mode === 'register' || mode === 'update';
  const title = { login: '로그인', register: '회원가입', reset: '비밀번호 재설정', update: '새 비밀번호 저장' }[mode];
  return <><main className="auth-page">
    <div className="gradient-backdrop" aria-hidden="true">{[1, 2, 3, 4, 5].map(n => <div key={n} className={`g${n}`} />)}</div>
    <section className="auth-card" aria-label="Moonble 계정">
      <h1 className="auth-brand"><svg viewBox="0 0 140 28" role="img" aria-label="moonble"><text x="0" y="21" fontFamily="'Pretendard', ui-sans-serif, sans-serif" fontWeight="800" fontSize="28" letterSpacing="-0.6" fill="#3182f6">moonble</text></svg></h1>
      <h2>{title}</h2>
      {!supabase && <p className="auth-message" role="status">회원가입을 준비 중입니다. 설정이 완료되면 이용할 수 있습니다.</p>}
      {checking && <p role="status" aria-label="로그인 상태 확인 중"><span className="moonble-spinner" aria-hidden="true" /></p>}
      <form onSubmit={submit}>
        <fieldset disabled={pending || checking || !supabase}>
          {mode !== 'update' && <div className="floating-field"><input id="email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} placeholder=" " /><label htmlFor="email">이메일</label></div>}
          {mode !== 'reset' && <div className="floating-field password-field"><input id="password" type={visible ? 'text' : 'password'} autoComplete={newPassword ? 'new-password' : 'current-password'} required minLength={newPassword ? 8 : undefined} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} placeholder=" " /><label htmlFor="password">비밀번호</label><button className="visibility" type="button" aria-label={visible ? '비밀번호 숨기기' : '비밀번호 표시'} aria-pressed={visible} onClick={() => setVisible(v => !v)}>{visible ? '숨기기' : '보기'}</button></div>}
          {newPassword && <><p className="auth-hint">영문·특수문자 포함 8자 이상, 공백·한글 제외</p><div className="floating-field"><input id="password-confirmation" type={visible ? 'text' : 'password'} autoComplete="new-password" required minLength={8} maxLength={128} value={confirmation} onChange={e => setConfirmation(e.target.value)} placeholder=" " /><label htmlFor="password-confirmation">비밀번호 확인</label></div></>}
          {mode === 'register' && <div className="signup-consents">
            <div className="consent-row"><label><input type="checkbox" required checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} /><span>[필수] 이용약관 동의</span></label><a href="./terms.html" target="_blank" rel="noopener noreferrer" aria-label="이용약관 내용 보기 (새 창)">보기</a></div>
            <div className="consent-row"><label><input type="checkbox" required checked={privacyAccepted} onChange={e => setPrivacyAccepted(e.target.checked)} /><span>[필수] 개인정보 수집·이용 동의</span></label><a href="./privacy.html" target="_blank" rel="noopener noreferrer" aria-label="개인정보 처리방침 보기 (새 창)">보기</a></div>
            <div className="consent-summary"><p>목적: 회원 인증, 프로필 표시, 동의 확인</p><p>항목: 이메일·비밀번호, 이름·회사명(첫 로그인 시), 동의 내역</p><p>보유 기간: 계정 이용 기간, 계정 삭제 처리 시 파기</p><p>동의를 거부할 수 있으며, 필수 항목에 동의하지 않으면 가입할 수 없습니다.</p></div>
          </div>}
          <button className="auth-submit" type="submit" aria-label={pending ? `${title} 처리 중` : undefined}>{pending ? <span className="moonble-spinner" aria-hidden="true" /> : title}</button>
        </fieldset>
      </form>
      {error && <p className="auth-error" role="alert">{error}</p>}
      {message && <p className="auth-message" role="status">{message}</p>}
      {mode === 'login' && <button className="auth-link" disabled={pending} onClick={() => switchMode('reset')}>비밀번호를 잊으셨나요?</button>}
      {mode === 'login' && <><div className="auth-separator" aria-hidden="true" /><a className="auth-create" href="./signup.html">새 계정 만들기</a></>}
      {mode === 'register' && <a className="auth-link" href="./login.html">이미 계정이 있나요? 로그인</a>}
      {(mode === 'reset' || mode === 'update') && <button className="auth-link" disabled={pending} onClick={() => switchMode('login')}>로그인으로 돌아가기</button>}
    </section>
  </main><SiteFooter /></>;
}

createRoot(document.getElementById('root')).render(<Login />);
