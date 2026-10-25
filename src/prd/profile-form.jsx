import React, { useState } from 'react';
import { Pencil } from 'lucide-react';
import { supabase } from '../supabase.js';
import { profileOf } from '../profile.js';
import { AccountDialog } from '../account-dialog.jsx';
import { ProfileUpdateEffect } from '../profile-update-effect.jsx';

export function ProfileForm({ user, initial, editing = initial, onSaved, onEditingChange }) {
  const profile = profileOf(user);
  const [name, setName] = useState(profile.name);
  const [company, setCompany] = useState(profile.companyName);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [celebrating, setCelebrating] = useState(false);

  function changeEditing(next) {
    if (pending) return;
    if (next) {
      setName(profile.name);
      setCompany(profile.companyName);
    }
    setError('');
    onEditingChange?.(next);
  }
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
  const form = <form onSubmit={save}>
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
  </form>;

  return <div className="profile-wrap mb-page-gutter">
    <section className="profile-card profile-form-card">
      {initial ? <>
        <h1>Moonble에 오신 것을 환영합니다</h1>
        <p>Moonble을 시작하기 전에 이름과 회사를 알려주세요.</p>
        {form}
        {error && <p role="alert">{error}</p>}
      </> : <>
        <header className="profile-form-heading">
          <h2 className="mb-section-title">내 정보 수정</h2>
          <AccountDialog open={editing} onOpenChange={changeEditing} busy={pending} title="내 정보 수정" description="이름과 회사명을 수정할 수 있어요." className="profile-card profile-form-card account-profile-edit-dialog" trigger={<button className="account-profile-edit" type="button" aria-label="내 정보 수정하기" disabled={pending}><Pencil size={15} aria-hidden="true" /></button>}>
            {form}
            {error && <p className="account-dialog-error" role="alert">{error}</p>}
          </AccountDialog>
        </header>
        <dl className="profile-readonly" aria-label="내 정보">
          <div><dt>이메일</dt><dd>{user.email || '없음'}</dd></div>
          <div><dt>이름</dt><dd>{profile.name || '없음'}</dd></div>
          <div><dt>회사명</dt><dd>{profile.companyName || '없음'}</dd></div>
        </dl>
      </>}
    </section>
    {celebrating && <ProfileUpdateEffect message="내 정보가 업데이트 되었어요!" onComplete={() => setCelebrating(false)} />}
  </div>;
}
