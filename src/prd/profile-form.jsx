import React, { useState } from 'react';
import { supabase } from '../supabase.js';
import { profileOf } from '../profile.js';

export function ProfileForm({ user, initial, editing = initial, onSaved }) {
  const profile = profileOf(user);
  const [name, setName] = useState(profile.name);
  const [company, setCompany] = useState(profile.companyName);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [celebrating, setCelebrating] = useState(false);
  async function save(event) {
    event.preventDefault();
    setError('');
    if (!name.trim() || !company.trim()) { setError('이름과 회사명을 입력해주세요.'); return; }
    setPending(true);
    try {
      const { data, error: saveError } = await supabase.auth.updateUser({ data: { name: name.trim(), companyName: company.trim() } });
      if (saveError) throw saveError;
      onSaved(data.user);
      setCelebrating(true);
    } catch { setError('저장하지 못했습니다. 입력한 내용은 유지됩니다. 잠시 후 다시 시도해주세요.'); }
    finally { setPending(false); }
  }
  if (!initial && !editing && !celebrating) return null;
  return <div className="profile-wrap mb-page-gutter">
    {(initial || editing) && <section className="profile-card profile-form-card" aria-label={initial ? undefined : '내 정보 수정'}>
      {initial && <h1>Moonble에 오신 것을 환영합니다</h1>}
      {initial && <p>Moonble을 시작하기 전에 이름과 회사를 알려주세요.</p>}
      <form onSubmit={save}>
        <fieldset disabled={pending}>
          <label htmlFor="profile-email">이메일</label>
          <input id="profile-email" value={user.email || ''} disabled />
          <label htmlFor="profile-name">이름</label>
          <input id="profile-name" autoComplete="name" maxLength={50} required value={name} onChange={e => setName(e.target.value)} />
          <label htmlFor="profile-company">회사명</label>
          <input id="profile-company" autoComplete="organization" maxLength={100} required value={company} onChange={e => setCompany(e.target.value)} aria-describedby="company-hint" />
          <p id="company-hint">소속 회사가 없다면 ‘개인’으로 입력해주세요.</p>
          <button className="shell-primary" type="submit" aria-label={pending ? '내 정보 저장 중' : undefined}>{pending ? <span className="moonble-spinner" aria-hidden="true" /> : initial ? '저장하고 문제 풀기' : '내 정보 저장'}</button>
        </fieldset>
      </form>
      {error && <p role="alert">{error}</p>}
    </section>}
    {celebrating && <div className="account-profile-update-fx is-playing" role="status" aria-live="assertive" onAnimationEnd={event => {
      if (event.target === event.currentTarget && event.animationName === 'account-profile-update-out') setCelebrating(false);
    }}>
      <span className="account-profile-update-badge" aria-hidden="true"><svg viewBox="0 0 48 48"><path d="M13.5 24.8l7 7L35 17.5" /></svg></span>
      <strong>내 정보가 업데이트 되었어요!</strong>
    </div>}
  </div>;
}
