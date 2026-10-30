// 일지에 문제지 풀이 기록 첨부(선택 기능). 일지에는 풀이 기록 id만 연결하고 결과는 원본에서 읽는다.
// 첨부 해제·일지 삭제는 연결만 지운다. 틀린 문제 보기·다시 풀기는 기존 풀이 화면(재풀이 모드)을 그대로 쓴다.
import React, { useEffect, useMemo, useState } from 'react';
import { Check, Plus, Search, X } from 'lucide-react';
import { readAchievementHistory, syncAchievementHistory } from '../achievement-history.js';
import { getCustomBank, getCustomBankMix } from '../custom-bank.js';
import { attachAttempts, detachAttachment, listAttachments, listRetries } from './journal-api.js';
import { dayLabel, seoulDateKey, seoulTimeLabel } from './journal-model.js';
import { Sheet } from './journal-ui.jsx';

const BUILT_IN_PAPERS = ['basics', 'advanced', 'random'];

function attemptWhen(date) {
  return `${dayLabel(seoulDateKey(date))} ${seoulTimeLabel(date)}`;
}
function scoreLine(attempt) {
  const total = Number(attempt.total) || 0;
  const correct = Number(attempt.correct) || 0;
  const rate = total ? Math.round((correct / total) * 100) : 0;
  return `${total}문항 · 정답 ${correct} · ${rate}%`;
}
function resultHref(attempt) {
  const key = attempt.bankId ? `bank:${attempt.bankId}` : `paper:${attempt.paperId}`;
  return `./quiz.html?achievementPaper=${encodeURIComponent(key)}#achievement`;
}

// 틀린 문제를 다시 불러올 수 있는지(원본 문제지가 남아 있고 문항이 그대로인지)
function wrongSource(userId, attempt) {
  const wrongIds = attempt.wrongIds || [];
  if (!wrongIds.length) return { ids: [], reason: '' };
  if (attempt.paperId === 'shared') return { ids: [], reason: '공유받아 푼 문제지는 틀린 문제를 다시 불러올 수 없어요.' };
  let questions = null;
  if (attempt.paperId === 'mix') questions = getCustomBankMix(userId, attempt.groupId);
  else if (attempt.bankId) questions = getCustomBank(userId, attempt.bankId);
  else if (BUILT_IN_PAPERS.includes(attempt.paperId) || attempt.paperId === 'retry') return { ids: wrongIds, reason: '' };
  if (!questions) return { ids: [], reason: '원본 문제지가 삭제돼 틀린 문제를 불러올 수 없어요.' };
  const ids = wrongIds.filter(id => questions.some(question => question.id === id));
  return ids.length ? { ids, reason: '' } : { ids: [], reason: '문제지가 바뀌어 틀린 문제를 찾을 수 없어요.' };
}

function openWrong(attempt, ids, mode, returnKey) {
  try {
    sessionStorage.setItem('moonble:retry-question-ids', JSON.stringify(ids));
    sessionStorage.setItem('moonble:retry-meta', JSON.stringify({
      paperId: attempt.paperId, bankId: attempt.bankId, groupId: attempt.groupId,
      paperTitle: attempt.paperTitle, paperDescription: attempt.paperDescription,
      attemptId: attempt.id, wrongAnswers: attempt.wrongAnswers || null,
      returnUrl: `./prd.html#/journal/daily/${returnKey}`,
    }));
  } catch { /* 이동은 계속한다. */ }
  window.location.href = `./solve.html?paper=retry${mode === 'review' ? '&review=1' : ''}#quiz`;
}

export function AttachmentSection({ userId, entryId, dateKey, ensureEntry }) {
  const [items, setItems] = useState([]);
  const [retries, setRetries] = useState([]);
  const [picker, setPicker] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  useEffect(() => {
    if (!entryId) { setItems([]); return undefined; }
    let alive = true;
    listAttachments(entryId).then(list => { if (alive) { setItems(list); setError(''); } }).catch(loadError => { if (alive) setError(loadError.message); });
    return () => { alive = false; };
  }, [entryId]);
  useEffect(() => {
    const ids = items.map(item => item.attemptId);
    if (!ids.length) { setRetries([]); return undefined; }
    let alive = true;
    listRetries(ids).then(rows => { if (alive) setRetries(rows); });
    return () => { alive = false; };
  }, [items]);

  async function attach(attemptIds) {
    const saved = await ensureEntry();
    if (!saved?.id) throw new Error('일지를 먼저 저장하지 못했어요. 다시 시도해 주세요.');
    await attachAttempts(userId, saved.id, attemptIds);
    setItems(await listAttachments(saved.id));
    setPicker(false);
  }
  async function detach(item) {
    setBusy(item.id); setError('');
    try { await detachAttachment(item.id); setItems(current => current.filter(row => row.id !== item.id)); }
    catch (detachError) { setError(detachError.message); }
    finally { setBusy(''); }
  }

  return <section className="jr-block jr-attachments" aria-label="풀이 기록">
    {items.length > 0 && <>
      <h3 className="jr-label">첨부한 풀이 기록</h3>
      <ul className="jr-attempts">
        {items.map(item => {
          const attempt = item.attempt;
          if (!attempt) return <li key={item.id} className="is-missing"><div><strong>풀이 기록을 찾을 수 없어요</strong><small>원본 기록이 지워졌거나 볼 수 없는 상태예요.</small></div>
            <button type="button" className="jr-icon-button" aria-label="첨부 해제" disabled={busy === item.id} onClick={() => detach(item)}><X size={16} aria-hidden="true" /></button></li>;
          const own = retries.filter(row => row.retry_of === attempt.id);
          const latest = own[0];
          const wrong = wrongSource(userId, attempt);
          return <li key={item.id}>
            <div className="jr-attempt-copy">
              <strong>{attempt.paperTitle}{attempt.paperId === 'retry' && <em>재풀이</em>}</strong>
              <small>{attemptWhen(attempt.date)} 완료 · {scoreLine(attempt)}</small>
              {latest && <small>다시 풀기 {own.length}회 · 최근 {latest.correct_count}/{latest.total_count} 정답 ({latest.score}%)</small>}
              <div className="jr-attempt-actions">
                <a href={resultHref(attempt)}>결과 보기</a>
                {wrong.ids.length > 0 && <button type="button" onClick={() => openWrong(attempt, wrong.ids, 'review', dateKey)}>틀린 문제 보기 {wrong.ids.length}</button>}
                {wrong.ids.length > 0 && <button type="button" onClick={() => openWrong(attempt, wrong.ids, 'retry', dateKey)}>다시 풀기</button>}
              </div>
              {wrong.reason && <small className="jr-attempt-note">{wrong.reason}</small>}
            </div>
            <button type="button" className="jr-icon-button" aria-label={`${attempt.paperTitle} 첨부 해제`} disabled={busy === item.id} onClick={() => detach(item)}><X size={16} aria-hidden="true" /></button>
          </li>;
        })}
      </ul>
    </>}
    {error && <p className="jr-inline-error" role="alert">{error}</p>}
    <button type="button" className="jr-attach-button" onClick={() => setPicker(true)}><Plus size={16} aria-hidden="true" />풀이 기록 첨부하기</button>
    {picker && <AttemptPicker userId={userId} dateKey={dateKey} attachedIds={items.map(item => item.attemptId)} onClose={() => setPicker(false)} onAttach={attach} />}
  </section>;
}

// 풀이 기록 고르기: 이 날 푼 기록을 먼저 보여주고, 다른 날 기록은 검색해서 고른다.
function AttemptPicker({ userId, dateKey, attachedIds, onClose, onAttach }) {
  const [records, setRecords] = useState(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    // 이 기기에만 있는 기록도 서버에 올린 뒤 고른다(첨부는 서버 기록 id로 연결한다).
    syncAchievementHistory(userId).then(list => { if (alive) setRecords(list); }).catch(() => { if (alive) setRecords(readAchievementHistory(userId)); });
    return () => { alive = false; };
  }, [userId]);
  const needle = query.trim().toLocaleLowerCase();
  const visible = useMemo(() => (records || []).filter(record => !needle || String(record.paperTitle || '').toLocaleLowerCase().includes(needle)), [records, needle]);
  const sameDay = visible.filter(record => seoulDateKey(record.date) === dateKey);
  const others = visible.filter(record => seoulDateKey(record.date) !== dateKey);
  const toggle = id => setSelected(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  async function submit() {
    setBusy(true); setError('');
    try { await onAttach(selected); }
    catch (attachError) { setError(attachError.message); setBusy(false); }
  }
  const row = record => {
    const attached = attachedIds.includes(record.id);
    const on = selected.includes(record.id);
    return <li key={record.id}>
      <button type="button" aria-pressed={on} disabled={attached} onClick={() => toggle(record.id)}>
        <span className={`jr-check${on ? ' is-on' : ''}`} aria-hidden="true">{on && <Check size={14} strokeWidth={3} />}</span>
        <span className="jr-picker-copy"><strong>{record.paperTitle || '문제지'}{record.paperId === 'retry' && <em>재풀이</em>}</strong><small>{attemptWhen(record.date)} · {scoreLine(record)}</small></span>
        {attached && <small className="jr-picker-attached">첨부됨</small>}
      </button>
    </li>;
  };
  return <Sheet title="풀이 기록 첨부하기" onClose={onClose} wide footer={<>
    {error && <p className="jr-inline-error" role="alert">{error}</p>}
    <button type="button" className="jr-primary" disabled={!selected.length || busy} onClick={submit}>{busy ? '첨부 중' : selected.length ? `${selected.length}개 첨부하기` : '첨부할 기록을 골라주세요'}</button>
  </>}>
    <label className="jr-search"><Search size={16} aria-hidden="true" /><span className="mb-sr-only">문제지 이름으로 찾기</span>
      <input type="search" value={query} maxLength={50} placeholder="문제지 이름으로 찾기" onChange={event => setQuery(event.target.value)} />
    </label>
    {records === null ? <p className="jr-muted" role="status">풀이 기록을 불러오고 있어요.</p>
      : !records.length ? <p className="jr-muted">아직 푼 문제지가 없어요. 문제지를 풀면 여기에서 고를 수 있어요.</p>
        : <>
          <h3 className="jr-picker-group">{dayLabel(dateKey)}에 푼 문제지</h3>
          {sameDay.length ? <ul className="jr-picker-list">{sameDay.map(row)}</ul> : <p className="jr-muted">{needle ? '이 날 기록 중 찾는 문제지가 없어요.' : '이 날 푼 문제지가 없어요. 아래에서 다른 날 기록을 고를 수 있어요.'}</p>}
          <h3 className="jr-picker-group">다른 날 푼 문제지</h3>
          {others.length ? <ul className="jr-picker-list">{others.map(row)}</ul> : <p className="jr-muted">{needle ? '찾는 문제지가 없어요.' : '다른 날 기록이 없어요.'}</p>}
        </>}
  </Sheet>;
}
