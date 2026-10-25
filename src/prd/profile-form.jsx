import React, { useEffect, useState } from 'react';
import { ChevronRight, Pencil, Plus, UserRound } from 'lucide-react';
import { supabase } from '../supabase.js';
import { profileOf } from '../profile.js';

export function ProfileForm({ user, initial, editing = initial, onSaved, onEditToggle, onEditComplete }) {
  const profile = profileOf(user);
  const metadata = user?.user_metadata || {};
  const [name, setName] = useState(profile.name);
  const [company, setCompany] = useState(profile.companyName);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [celebrating, setCelebrating] = useState(false);
  useEffect(() => {
    if (!editing) {
      setName(profile.name);
      setCompany(profile.companyName);
      setError('');
    }
  }, [editing, profile.name, profile.companyName]);
  async function save(event) {
    event.preventDefault();
    setError('');
    if (!name.trim() || !company.trim()) { setError('이름과 회사명을 입력해주세요.'); return; }
    setPending(true);
    try {
      const { data, error: saveError } = await supabase.auth.updateUser({ data: { name: name.trim(), companyName: company.trim() } });
      if (saveError) throw saveError;
      onSaved(data.user);
      setName(name.trim());
      setCompany(company.trim());
      onEditComplete?.();
      setCelebrating(true);
    } catch { setError('저장하지 못했습니다. 입력한 내용은 유지됩니다. 잠시 후 다시 시도해주세요.'); }
    finally { setPending(false); }
  }
  const celebration = celebrating && <div className="account-profile-update-fx is-playing" role="status" aria-live="assertive" onAnimationEnd={event => {
      if (event.target === event.currentTarget && event.animationName === 'account-profile-update-out') setCelebrating(false);
    }}>
      <span className="account-profile-update-badge" aria-hidden="true"><svg viewBox="0 0 48 48"><path d="M13.5 24.8l7 7L35 17.5" /></svg></span>
      <strong>내 정보가 업데이트 되었어요!</strong>
    </div>;

  if (initial) return <div className="profile-wrap mb-page-gutter">
    <section className="profile-card profile-form-card">
      <h1>Moonble에 오신 것을 환영합니다</h1>
      <p>Moonble을 시작하기 전에 이름과 회사를 알려주세요.</p>
      <form onSubmit={save}>
        <fieldset disabled={pending}>
          <label htmlFor="profile-email">이메일</label>
          <input id="profile-email" value={user.email || ''} disabled />
          <label htmlFor="profile-name">이름</label>
          <input id="profile-name" autoComplete="name" maxLength={50} required value={name} onChange={e => setName(e.target.value)} />
          <label htmlFor="profile-company">회사명</label>
          <input id="profile-company" autoComplete="organization" maxLength={100} required value={company} onChange={e => setCompany(e.target.value)} aria-describedby="company-hint" />
          <p id="company-hint">소속 회사가 없다면 ‘개인’으로 입력해주세요.</p>
          <button className="shell-primary" type="submit" aria-label={pending ? '내 정보 저장 중' : undefined}>{pending ? <span className="moonble-spinner" aria-hidden="true" /> : '저장하고 문제 풀기'}</button>
        </fieldset>
      </form>
      {error && <p role="alert">{error}</p>}
    </section>
    {celebration}
  </div>;

  const displayValue = value => typeof value === 'string' && value.trim() ? value.trim() : '없음';
  const viewRows = [
    ['이름', profile.name],
    ['영문이름', metadata.englishName || metadata.english_name],
    ['생년월일', metadata.birthDate || metadata.birth_date],
    ['휴대폰 번호', user.phone || metadata.phone],
    ['이메일', user.email],
    ['회사', profile.companyName],
  ];

  return <div className="profile-wrap mb-page-gutter">
    <section className="profile-card profile-form-card account-profile-card" aria-labelledby="account-profile-title">
      <header className="account-profile-heading">
        <h2 id="account-profile-title" className="mb-section-title">내 정보 수정</h2>
        <button className="account-profile-edit" type="button" aria-label={editing ? '내 정보 편집 취소' : '내 정보 편집'} aria-expanded={editing} disabled={pending} onClick={onEditToggle}>
          <Pencil size={17} aria-hidden="true" />
        </button>
      </header>
      {editing ? <form onSubmit={save}>
        <fieldset disabled={pending}>
          <label htmlFor="profile-email">이메일</label>
          <input id="profile-email" value={user.email || ''} disabled />
          <label htmlFor="profile-name">이름</label>
          <input id="profile-name" autoComplete="name" maxLength={50} required value={name} onChange={e => setName(e.target.value)} />
          <label htmlFor="profile-company">회사명</label>
          <input id="profile-company" autoComplete="organization" maxLength={100} required value={company} onChange={e => setCompany(e.target.value)} aria-describedby="company-hint" />
          <p id="company-hint">소속 회사가 없다면 ‘개인’으로 입력해주세요.</p>
          <button className="shell-primary" type="submit" aria-label={pending ? '내 정보 저장 중' : undefined}>{pending ? <span className="moonble-spinner" aria-hidden="true" /> : '내 정보 저장'}</button>
        </fieldset>
      </form> : <>
        <div className="account-profile-view-avatar" aria-hidden="true">
          <span><UserRound size={60} strokeWidth={1.5} /></span>
          <i><Plus size={17} strokeWidth={2.5} /></i>
        </div>
        <dl className="account-profile-details">
          {viewRows.map(([label, value]) => <div className="account-profile-detail" key={label}>
            <dt>{label}</dt>
            <dd className={!value ? 'is-empty' : ''}>{displayValue(value)}<ChevronRight size={19} aria-hidden="true" /></dd>
          </div>)}
        </dl>
      </>}
      {error && <p role="alert">{error}</p>}
    </section>
    {celebration}
  </div>;
}
