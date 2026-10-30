import React, { useEffect, useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { AccountDialog } from './account-dialog.jsx';
import { ProfileUpdateEffect } from './profile-update-effect.jsx';
import { UserAvatar } from './user-avatar.jsx';
import { prepareProfileAvatar, resetProfileAvatar, saveProfileAvatar } from './profile-avatar.js';

export function ProfilePhotoEditor({ user, onSaved }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(null);
  const [preview, setPreview] = useState('');
  const [preparing, setPreparing] = useState(false);
  const [action, setAction] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const inputRef = useRef(null);
  const hasPhoto = Boolean(user?.user_metadata?.avatarPath);
  const busy = preparing || Boolean(action);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function changeOpen(next) {
    if (busy) return;
    setOpen(next);
    setDraft(null);
    setPreview('');
    setError('');
  }

  async function selectFile(file) {
    if (!file || busy) return;
    setDraft(null);
    setPreview('');
    setError('');
    setPreparing(true);
    try {
      const prepared = await prepareProfileAvatar(file);
      setDraft(prepared);
      setPreview(URL.createObjectURL(prepared.file));
    } catch (failure) {
      setError(failure.message || '이미지를 불러오지 못했어요. 다른 사진을 선택해주세요.');
    } finally { setPreparing(false); }
  }

  async function save() {
    if (!draft || busy) return;
    setAction('save');
    setError('');
    try {
      const updatedUser = await saveProfileAvatar(user, draft);
      onSaved(updatedUser);
      setOpen(false);
      setDraft(null);
      setPreview('');
      setSuccess('프로필 사진이 업데이트 되었어요!');
    } catch (failure) {
      setError(failure.message || '프로필 사진을 저장하지 못했어요. 다시 시도해주세요.');
    } finally { setAction(''); }
  }

  async function reset() {
    if (!hasPhoto || busy) return;
    setAction('reset');
    setError('');
    try {
      const updatedUser = await resetProfileAvatar(user);
      onSaved(updatedUser);
      setOpen(false);
      setDraft(null);
      setPreview('');
      setSuccess('기본 프로필로 변경되었어요!');
    } catch (failure) {
      setError(failure.message || '프로필 사진을 초기화하지 못했어요. 다시 시도해주세요.');
    } finally { setAction(''); }
  }

  return <div className="account-profile-photo">
    <UserAvatar user={user} className="account-profile-avatar" />
    <AccountDialog open={open} onOpenChange={changeOpen} busy={busy} title="프로필 사진" description="JPG 또는 PNG 이미지를 선택해 프로필 사진으로 등록하거나 기본 프로필로 초기화할 수 있어요." className="account-avatar-dialog" trigger={<button className="account-profile-camera" type="button" aria-label="프로필 사진 설정" title="프로필 사진 설정" disabled={busy}><Camera size={12} aria-hidden="true" /></button>}>
      <div className="account-avatar-body" aria-busy={busy}>
        {preview ? <span className="account-avatar-preview"><img src={preview} alt="선택한 프로필 사진 미리보기" /></span> : <UserAvatar user={user} className="account-avatar-preview" />}
        <input ref={inputRef} className="mb-sr-only" type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" tabIndex={-1} disabled={busy} aria-label="프로필 이미지 파일" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; selectFile(file); }} />
        <button className="account-avatar-select" type="button" disabled={busy} onClick={() => inputRef.current?.click()}>{preparing ? <span className="moonble-spinner" aria-hidden="true" /> : null}{preparing ? '사진 준비 중' : hasPhoto || draft ? '다른 사진 선택' : '사진 선택'}</button>
        <p className="account-avatar-file-help">JPG 또는 PNG · 최대 20MB</p>
        {hasPhoto && <button className="account-avatar-reset" type="button" disabled={busy} onClick={reset}>{action === 'reset' ? <span className="moonble-spinner" aria-hidden="true" /> : null}기본 프로필로 초기화</button>}
        {error && <p className="account-dialog-error" role="alert">{error}</p>}
      </div>
      <footer className="account-dialog-actions"><button className="is-secondary" type="button" disabled={busy} onClick={() => changeOpen(false)}>취소</button><button className="is-primary" type="button" disabled={!draft || busy} aria-label={action === 'save' ? '프로필 사진 저장 중' : undefined} onClick={save}>{action === 'save' ? <span className="moonble-spinner" aria-hidden="true" /> : '저장'}</button></footer>
    </AccountDialog>
    {success && <ProfileUpdateEffect message={success} onComplete={() => setSuccess('')} />}
  </div>;
}
