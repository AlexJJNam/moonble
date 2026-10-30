// 일지·회고 편집 화면: 문서처럼 제목 → (기분) → 자유 글 → 질문 → (태그) → (풀이 기록) → 저장 상태.
// 입력하면 잠시 뒤 자동 저장한다. 저장은 한 번에 하나씩 순서대로 보내 늦게 온 응답이 새 입력을 덮지 않고,
// 저장하지 못한 내용은 이 기기에 남겨 새로고침·날짜 이동·네트워크 실패에도 잃지 않는다.
import React, { useEffect, useId, useRef, useState } from 'react';
import { BODY_COPY, LIMITS, QUESTIONS, emptyEntry, hasContent, seoulTimeLabel } from './journal-model.js';
import { clearLocalDraft, deleteEntry, getEntry, readLocalDraft, saveEntry, writeLocalDraft } from './journal-api.js';
import { AutoTextarea, MoodPicker, TagEditor } from './journal-ui.jsx';
import { AttachmentSection } from './journal-attachments.jsx';

const SAVE_DELAY = 900;
const RETRY_DELAY = 8000;

function useJournalDocument(userId, kind, start, { onSaved, onDeleted }) {
  const [entry, setEntry] = useState(() => emptyEntry(kind, start));
  const [load, setLoad] = useState({ status: 'loading', notice: '', attempt: 0 });
  const [save, setSave] = useState({ phase: 'idle', message: '', code: '', at: null });
  const callbacks = useRef({ onSaved, onDeleted });
  callbacks.current = { onSaved, onDeleted };
  const ref = useRef(null);
  if (!ref.current) {
    const c = {
      entry: emptyEntry(kind, start), version: 0, savedVersion: 0, base: null,
      chain: Promise.resolve(), timer: 0, retryTimer: 0, alive: true, deleting: false,
      show(next) { c.entry = next; if (c.alive) setEntry(next); },
      status(next) { if (c.alive) setSave({ phase: 'idle', message: '', code: '', at: null, ...next }); },
      dirty() { return c.version !== c.savedVersion; },
      change(patch) {
        if (c.deleting) return;
        const next = { ...c.entry, ...(typeof patch === 'function' ? patch(c.entry) : patch) };
        c.version += 1;
        c.show(next);
        writeLocalDraft(userId, next, c.base);
        c.status({ phase: 'dirty' });
        window.clearTimeout(c.timer);
        c.timer = window.setTimeout(() => c.flush().catch(() => {}), SAVE_DELAY);
      },
      // 저장 요청을 줄 세운다. 차례가 오면 그때의 최신 내용을 보낸다.
      flush(options = {}) {
        window.clearTimeout(c.timer);
        const run = c.chain.then(() => c.saveNow(options));
        c.chain = run.catch(() => {});
        return run;
      },
      async saveNow({ force = false } = {}) {
        window.clearTimeout(c.retryTimer);
        const snapshot = c.entry;
        const version = c.version;
        if (c.deleting) return snapshot;
        if (version === c.savedVersion && (snapshot.id || !force)) return snapshot;
        // 빈 일지는 만들지 않는다(첨부처럼 꼭 필요할 때만 force).
        if (!snapshot.id && !hasContent(snapshot) && !force) {
          c.savedVersion = version;
          clearLocalDraft(userId, kind, start);
          c.status({ phase: 'idle' });
          return snapshot;
        }
        c.status({ phase: 'saving' });
        try {
          const saved = await saveEntry(userId, snapshot);
          c.base = saved.updatedAt;
          c.savedVersion = Math.max(c.savedVersion, version);
          // 서버 응답으로 글을 덮지 않고 id·시각만 받는다(그 사이 더 쓴 내용 보호).
          const merged = { ...c.entry, id: saved.id, createdAt: saved.createdAt, updatedAt: saved.updatedAt };
          c.show(merged);
          if (c.version === version) { clearLocalDraft(userId, kind, start); c.status({ phase: 'saved', at: saved.updatedAt }); }
          else writeLocalDraft(userId, merged, c.base);
          callbacks.current.onSaved?.(merged);
          return merged;
        } catch (error) {
          c.status({ phase: 'failed', message: error.message, code: error.code });
          if (c.alive && !['missing', 'denied', 'auth'].includes(error.code)) c.retryTimer = window.setTimeout(() => { if (c.dirty()) c.flush().catch(() => {}); }, RETRY_DELAY);
          throw error;
        }
      },
      async remove() {
        c.deleting = true;
        window.clearTimeout(c.timer);
        window.clearTimeout(c.retryTimer);
        await c.chain;
        try {
          if (c.entry.id) await deleteEntry(c.entry.id);
        } catch (error) { c.deleting = false; throw error; }
        clearLocalDraft(userId, kind, start);
        c.version = 0; c.savedVersion = 0; c.base = null;
        c.show(emptyEntry(kind, start));
        c.status({ phase: 'idle' });
        c.deleting = false;
        callbacks.current.onDeleted?.(kind, start);
      },
    };
    ref.current = c;
  }
  const c = ref.current;

  useEffect(() => {
    let cancelled = false;
    c.alive = true;
    const local = readLocalDraft(userId, kind, start);
    getEntry(kind, start).then(remote => {
      if (cancelled) return;
      c.base = remote?.updatedAt || null;
      if (local) {
        // 이 기기에서 저장하지 못한 내용이 있으면 그걸 이어서 저장한다.
        const next = { ...local.entry, id: remote?.id || null, createdAt: remote?.createdAt || null, updatedAt: remote?.updatedAt || null };
        c.version = c.savedVersion + 1;
        c.show(next);
        setLoad(current => ({ ...current, status: 'ready', notice: remote && local.base !== remote.updatedAt ? '다른 기기에서 바뀐 내용이 있었어요. 이 기기에서 저장하지 못한 내용으로 이어서 저장했어요.' : '' }));
        c.flush().catch(() => {});
      } else {
        c.show(remote || emptyEntry(kind, start));
        setLoad(current => ({ ...current, status: 'ready', notice: '' }));
        c.status(remote ? { phase: 'saved', at: remote.updatedAt } : { phase: 'idle' });
      }
    }).catch(error => {
      if (cancelled) return;
      if (local || error.code === 'missing') {
        if (local) { c.version = c.savedVersion + 1; c.show(local.entry); }
        setLoad(current => ({ ...current, status: 'ready', notice: error.code === 'missing' ? error.message : '' }));
        c.status(local ? { phase: 'failed', message: error.message, code: error.code } : { phase: 'idle' });
      } else setLoad(current => ({ ...current, status: 'error', notice: error.message }));
    });
    // 다른 기기에서 고친 내용: 화면으로 돌아왔을 때 이 기기에 저장할 내용이 없으면 새로 불러온다.
    const refresh = () => {
      if (document.visibilityState !== 'visible' || c.dirty() || c.deleting) return;
      getEntry(kind, start).then(remote => {
        if (!c.alive || c.dirty() || !remote || remote.updatedAt === c.base) return;
        c.base = remote.updatedAt;
        c.show(remote);
        c.status({ phase: 'saved', at: remote.updatedAt });
      }).catch(() => {});
    };
    const online = () => { if (c.dirty()) c.flush().catch(() => {}); };
    const leave = () => { if (c.dirty()) c.flush().catch(() => {}); };
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('online', online);
    window.addEventListener('pagehide', leave);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('online', online);
      window.removeEventListener('pagehide', leave);
      // 다른 날짜로 옮겨도 쓰던 내용은 바로 저장한다(실패해도 이 기기에 남아 있다).
      if (c.dirty()) c.flush().catch(() => {});
      c.alive = false;
      window.clearTimeout(c.retryTimer);
    };
  }, [load.attempt]);

  return {
    entry, load, save,
    change: patch => c.change(patch),
    flush: options => c.flush(options),
    retry: () => c.flush().catch(() => {}),
    remove: () => c.remove(),
    reload: () => setLoad(current => ({ status: 'loading', notice: '', attempt: current.attempt + 1 })),
  };
}

function SaveStatus({ state, onRetry }) {
  let text = '';
  if (state.phase === 'dirty' || state.phase === 'saving') text = '저장 중…';
  else if (state.phase === 'saved') text = state.at ? `저장됨 · ${seoulTimeLabel(state.at)}` : '저장됨';
  else if (state.phase === 'idle') text = '쓰기 시작하면 자동으로 저장돼요.';
  if (state.phase === 'failed') {
    return <p className="jr-save is-failed" role="alert">
      <span>{state.message || '저장하지 못했어요.'} 쓴 내용은 이 기기에 남아 있어요.</span>
      {state.code !== 'missing' && <button type="button" onClick={onRetry}>다시 시도</button>}
    </p>;
  }
  return <p className="jr-save" role="status" aria-live="polite">{text}</p>;
}

export function EntryEditor({ userId, kind, start, tagSuggestions = [], onSaved, onDeleted }) {
  const ids = useId();
  const doc = useJournalDocument(userId, kind, start, { onSaved, onDeleted });
  const { entry, load, save, change } = doc;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  if (load.status === 'loading') return <div className="jr-doc is-loading" role="status" aria-label="일지 불러오는 중"><span className="moonble-spinner" aria-hidden="true" /></div>;
  if (load.status === 'error') return <div className="jr-doc jr-doc-error" role="alert"><strong>일지를 불러오지 못했어요</strong><p>{load.notice}</p><button type="button" onClick={doc.reload}>다시 시도</button></div>;
  const body = BODY_COPY[kind];
  async function remove() {
    setDeleting(true); setDeleteError('');
    try { await doc.remove(); setConfirmDelete(false); }
    catch (error) { setDeleteError(error.message); }
    finally { setDeleting(false); }
  }
  return <article className="jr-doc" aria-label={kind === 'daily' ? '일간 일지' : kind === 'weekly' ? '주간 회고' : '월간 회고'}>
    {load.notice && <p className="jr-notice">{load.notice}</p>}
    <input className="jr-title" value={entry.title} maxLength={LIMITS.title} placeholder="제목 (선택)" aria-label="제목" onChange={event => change({ title: event.target.value })} />
    {kind === 'daily' && <section className="jr-block is-mood"><h3 className="jr-label">오늘의 기분</h3><MoodPicker value={entry.mood} onChange={mood => change({ mood })} /></section>}
    <section className="jr-block">
      <h3 className="jr-label" id={`${ids}-body`}>{body.label}</h3>
      <AutoTextarea className="is-body" minRows={kind === 'daily' ? 5 : 3} value={entry.body} maxLength={LIMITS.body} placeholder={body.prompt} aria-labelledby={`${ids}-body`} onChange={value => change({ body: value })} />
    </section>
    {QUESTIONS[kind].map(question => <section key={question.key} className="jr-block">
      <h3 className="jr-label" id={`${ids}-${question.key}`}>{question.label}</h3>
      <AutoTextarea value={entry.answers[question.key] || ''} maxLength={LIMITS.answer} placeholder={question.prompt} aria-labelledby={`${ids}-${question.key}`}
        onChange={value => change(current => ({ answers: { ...current.answers, [question.key]: value } }))} />
    </section>)}
    {kind === 'daily' && <section className="jr-block"><h3 className="jr-label">태그</h3><TagEditor tags={entry.tags} suggestions={tagSuggestions} onChange={tags => change({ tags })} /></section>}
    {kind === 'daily' && <AttachmentSection userId={userId} entryId={entry.id} dateKey={start} ensureEntry={() => doc.flush({ force: true })} />}
    <footer className="jr-doc-footer">
      <SaveStatus state={save} onRetry={doc.retry} />
      {entry.id && !confirmDelete && <button type="button" className="jr-delete" onClick={() => setConfirmDelete(true)}>삭제</button>}
    </footer>
    {confirmDelete && <div className="jr-confirm" role="alertdialog" aria-labelledby={`${ids}-confirm`}>
      <p id={`${ids}-confirm`}>{kind === 'daily' ? '이 일지를 삭제할까요? 첨부한 풀이 기록과 문제지는 그대로 남아요.' : '이 회고를 삭제할까요?'}</p>
      {deleteError && <small role="alert">{deleteError}</small>}
      <div><button type="button" onClick={() => setConfirmDelete(false)} disabled={deleting}>취소</button><button type="button" className="is-danger" onClick={remove} disabled={deleting}>{deleting ? '삭제 중' : '삭제'}</button></div>
    </div>}
  </article>;
}
