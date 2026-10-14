import React, { useState } from 'react';
import { supabase } from '../supabase.js';

export function PrivacyRequest({ user }) {
  const [kind, setKind] = useState('access');
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const existing = user.user_metadata?.privacy_request;
  async function submit(event) {
    event.preventDefault();
    if (!confirmed || pending) return;
    setPending(true); setError(''); setMessage('');
    try {
      const { error } = await supabase.auth.updateUser({ data: { privacy_request: { kind, requested_at: new Date().toISOString(), status: 'requested' } } });
      if (error) throw error;
      setMessage('요청 상태를 계정에 기록했습니다. 현재는 운영자가 Supabase 사용자 목록에서 수동으로 확인합니다. 계정 삭제 요청은 처리 전까지 계정이 유지됩니다.');
      setConfirmed(false);
    } catch { setError('요청을 접수하지 못했습니다. 잠시 후 다시 시도해주세요.'); }
    finally { setPending(false); }
  }
  return <section className="profile-card privacy-request"><h2 className="mb-section-title">개인정보 요청</h2><p>선택한 요청 상태를 계정에 기록합니다. 자동 알림이나 즉시 삭제 기능은 없으며 운영자가 Supabase 사용자 목록에서 수동으로 확인합니다.</p>{existing?.status === 'requested' && <p role="status">계정에 기록된 개인정보 요청이 있습니다.</p>}<form onSubmit={submit}><label htmlFor="privacy-request-kind">요청 종류</label><select id="privacy-request-kind" value={kind} disabled={pending} onChange={e => { setKind(e.target.value); setConfirmed(false); }}><option value="access">개인정보 열람</option><option value="correction">개인정보 정정 상담</option><option value="stop">개인정보 처리정지</option><option value="delete">계정 및 개인정보 삭제</option></select><label className="privacy-confirm"><input type="checkbox" checked={confirmed} required disabled={pending} onChange={e => setConfirmed(e.target.checked)} />선택한 요청 상태를 계정에 기록합니다.</label><button className="shell-primary" disabled={pending || !confirmed} aria-label={pending ? '요청 기록 중' : undefined}>{pending ? <span className="moonble-spinner" aria-hidden="true" /> : '요청 기록'}</button></form>{message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}</section>;
}
