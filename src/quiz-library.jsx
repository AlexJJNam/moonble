import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Check, Copy, FolderPlus, LayoutGrid, Link2, List, MoreHorizontal, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { cachedAuthSession, getSessionSafely, loginUrl, supabase } from './supabase.js';
import { hasProfile } from './profile.js';
import { SiteFooter } from './site-footer.jsx';
import {
  DEFAULT_GROUP_ID,
  clearCustomBank,
  createCustomGroup,
  deleteCustomGroup,
  getCustomBankCollection,
  reorderCustomBanks,
  reorderCustomGroups,
  setActiveCustomBank,
  setCustomBankUser,
  syncCustomBankCollection,
  updateCustomBankMeta,
  updateCustomGroup,
} from './custom-bank.js';
import { QuizAchievement } from './quiz-achievement.jsx';
import { QuizCreator } from './quiz-creator.jsx';
import { AppHeader } from './app-header.jsx';
import { FlowActionButton } from './flow-action-button.jsx';
import { BUILT_IN_PAPER_PREVIEWS as papers, PaperPreview } from './paper-preview.jsx';
import { SegmentedControl } from './segmented-control.jsx';
import { formatRelativeDate } from './date-format.js';
import { cacheQuizShareToken, clearCachedQuizShareToken, createQuizShare, getCachedQuizShareToken, getQuizShare, quizShareUrl, revokeQuizShare } from './quiz-share.js';
import './design-system.css';
import './quiz-library.css';

const difficulties = ['전체 난이도', '기본', '심화'];
const difficultySegments = difficulties.map(item => ({ label: item, value: item }));
const viewSegments = [
  { value: 'grid', label: '2열 카드 보기', ariaLabel: '2열 카드 보기', icon: LayoutGrid },
  { value: 'list', label: '1열 목록 보기', ariaLabel: '1열 목록 보기', icon: List },
];
const initialSession = cachedAuthSession();
const initialUser = initialSession && hasProfile(initialSession.user) ? initialSession.user : null;
const sampleVisibilityKey = userId => `moonble:user:${userId}:sample-paper-hidden-v1`;
const sampleIsVisible = userId => {
  try { return !userId || localStorage.getItem(sampleVisibilityKey(userId)) !== 'true'; }
  catch { return true; }
};
function buildGroupColorMap(groups) {
  const usedHues = new Set();
  const colors = new Map();
  [...groups].sort((a, b) => a.id.localeCompare(b.id)).forEach(group => {
    let hash = 2166136261;
    for (const character of group.id) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
    let hue = (hash >>> 0) % 360;
    while (usedHues.has(hue)) hue = (hue + 37) % 360;
    usedHues.add(hue);
    colors.set(group.id, {
      '--paper-group-tint': `hsl(${hue} 72% 95%)`,
      '--paper-group-color': `hsl(${hue} 48% 36%)`,
      '--paper-group-border': `hsl(${hue} 45% 86%)`,
    });
  });
  return colors;
}
function groupColorStyle(groupId, colors) {
  if (groupId === 'all') return { '--paper-group-tint': '#e8f3ff', '--paper-group-color': '#1b64da', '--paper-group-border': '#d5e8ff' };
  if (groupId === DEFAULT_GROUP_ID) return { '--paper-group-tint': '#f2f4f6', '--paper-group-color': '#667085', '--paper-group-border': '#e3e7eb' };
  return colors.get(groupId) || groupColorStyle(DEFAULT_GROUP_ID, colors);
}
if (initialUser) {
  setCustomBankUser(initialUser.id);
  document.documentElement.removeAttribute('data-auth-pending');
}

function sectionFromHash() {
  if (window.location.hash === '#achievement') return 'achievement';
  if (window.location.hash === '#create') return 'create';
  return 'papers';
}

function ManagementDialog({ editor, groups, onChange, onClose, onSubmit }) {
  const overlayRef = useRef(null);

  useEffect(() => {
    if (!editor || !window.matchMedia('(max-width: 540px)').matches) return undefined;
    const overlay = overlayRef.current;
    const viewport = window.visualViewport;
    if (!overlay || !viewport) return undefined;

    const placeAboveKeyboard = () => {
      const keyboardHeight = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      overlay.style.setProperty('--quiz-keyboard-offset', `${keyboardHeight}px`);

      const focusedField = overlay.querySelector('input:focus, textarea:focus, select:focus');
      if (focusedField) {
        window.requestAnimationFrame(() => {
          const fieldRect = focusedField.getBoundingClientRect();
          const visibleTop = viewport.offsetTop + 12;
          const visibleBottom = viewport.offsetTop + viewport.height - 12;
          if (fieldRect.top < visibleTop || fieldRect.bottom > visibleBottom) {
            focusedField.scrollIntoView({ block: 'center', behavior: 'smooth' });
          }
        });
      }
    };

    placeAboveKeyboard();
    viewport.addEventListener('resize', placeAboveKeyboard);
    viewport.addEventListener('scroll', placeAboveKeyboard);
    return () => {
      viewport.removeEventListener('resize', placeAboveKeyboard);
      viewport.removeEventListener('scroll', placeAboveKeyboard);
    };
  }, [editor?.type]);

  if (!editor) return null;
  const isBank = editor.type.startsWith('bank-');
  const isDelete = editor.type.endsWith('delete');
  const isSample = editor.type === 'sample-delete';
  const title = editor.type === 'bank-edit' ? '문제지 편집' : editor.type === 'bank-delete' || isSample ? '문제지를 삭제할까요?' : editor.type === 'group-create' ? '새 그룹 만들기' : editor.type === 'group-edit' ? '그룹 이름 바꾸기' : '그룹을 삭제할까요?';
  return <div ref={overlayRef} className="quiz-manage-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <form className="quiz-manage-dialog" role="dialog" aria-modal="true" aria-labelledby="quiz-manage-title" onSubmit={event => { event.preventDefault(); onSubmit(); }}>
      <header><h2 id="quiz-manage-title">{title}</h2><button type="button" aria-label="닫기" onClick={onClose}><X size={19} /></button></header>
      {isDelete ? <>
        <p><strong>{editor.title || editor.name}</strong>{isBank || isSample ? ' 문제지' : ' 그룹'}를 삭제하면 되돌릴 수 없어요.</p>
        {!isBank && !isSample && <p>이 그룹의 문제지는 삭제되지 않고 ‘미분류’로 이동해요.</p>}
      </> : isBank ? <div className="quiz-manage-fields">
        <label><span>문제지 이름</span><input autoFocus type="text" maxLength="80" value={editor.title} onChange={event => onChange({ ...editor, title: event.target.value })} /></label>
        <label><span>문제지 설명</span><textarea rows="3" maxLength="160" value={editor.description} onChange={event => onChange({ ...editor, description: event.target.value })} /></label>
        <label><span>그룹</span><select value={editor.groupId} onChange={event => onChange({ ...editor, groupId: event.target.value })}><option value={DEFAULT_GROUP_ID}>미분류</option>{groups.map(group => <option value={group.id} key={group.id}>{group.name}</option>)}</select></label>
      </div> : <div className="quiz-manage-fields"><label><span>그룹 이름</span><input autoFocus type="text" maxLength="24" value={editor.name} onChange={event => onChange({ ...editor, name: event.target.value })} /></label></div>}
      {editor.error && <p className="quiz-manage-error" role="alert">{editor.error}</p>}
      <footer><button type="button" onClick={onClose}>취소</button><button className={isDelete ? 'is-danger' : 'is-primary'} type="submit" disabled={!isDelete && !(isBank ? editor.title.trim() : editor.name.trim())}>{isDelete ? '삭제하기' : editor.type === 'group-create' ? '만들기' : '저장하기'}</button></footer>
    </form>
  </div>;
}

function QuizLibrary() {
  const [user, setUser] = useState(initialUser);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [difficulty, setDifficulty] = useState('전체 난이도');
  const [view, setView] = useState('grid');
  const [collection, setCollection] = useState(() => initialUser ? getCustomBankCollection(initialUser.id) : getCustomBankCollection());
  const [activeGroup, setActiveGroup] = useState('all');
  const [openMenu, setOpenMenu] = useState(null);
  const [editor, setEditor] = useState(null);
  const [notice, setNotice] = useState('');
  const [shareDialog, setShareDialog] = useState(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareError, setShareError] = useState('');
  const [shareCopied, setShareCopied] = useState(false);
  const [section, setSection] = useState(sectionFromHash);
  const [sampleVisible, setSampleVisible] = useState(() => sampleIsVisible(initialUser?.id));
  const [editMode, setEditMode] = useState(false);
  const [draggedBankId, setDraggedBankId] = useState(null);
  const [dropGroupId, setDropGroupId] = useState(null);
  const [folderPulse, setFolderPulse] = useState(null);
  const [pressedBankId, setPressedBankId] = useState(null);
  const [dropBankTarget, setDropBankTarget] = useState(null);
  const [reorderingGroupId, setReorderingGroupId] = useState(null);
  const [orderedGroupIds, setOrderedGroupIds] = useState(() => collection.groups.map(group => group.id));
  const longPressTimer = useRef(0);
  const paperPressTimer = useRef(0);
  const paperTouchDrag = useRef(null);
  const dragPreviewNode = useRef(null);
  const groupPress = useRef(null);
  const groupOrderRef = useRef(orderedGroupIds);
  const bankSyncUserRef = useRef(null);
  const suppressGroupClick = useRef(false);
  const refreshCollection = () => setCollection(getCustomBankCollection());
  useEffect(() => {
    if (reorderingGroupId) return;
    const next = collection.groups.map(group => group.id);
    groupOrderRef.current = next;
    setOrderedGroupIds(next);
  }, [collection.groups, reorderingGroupId]);
  useEffect(() => {
    groupOrderRef.current = orderedGroupIds;
  }, [orderedGroupIds]);
  useEffect(() => {
    function move(event) {
      const press = groupPress.current;
      if (!press) return;
      if (!press.active) {
        if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > 9) {
          window.clearTimeout(longPressTimer.current);
          groupPress.current = null;
        }
        return;
      }
      event.preventDefault();
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest?.('[data-reorder-group]');
      const targetId = target?.dataset.reorderGroup;
      if (!targetId || targetId === press.id) return;
      setOrderedGroupIds(current => {
        const from = current.indexOf(press.id);
        const to = current.indexOf(targetId);
        if (from < 0 || to < 0 || from === to) return current;
        const next = current.slice();
        next.splice(from, 1);
        next.splice(to, 0, press.id);
        groupOrderRef.current = next;
        return next;
      });
    }
    function end() {
      window.clearTimeout(longPressTimer.current);
      const press = groupPress.current;
      groupPress.current = null;
      if (!press?.active) return;
      try {
        reorderCustomGroups(groupOrderRef.current);
        refreshCollection();
        setNotice('그룹 순서를 바꿨어요.');
      } catch (reorderError) {
        setNotice(reorderError.message || '그룹 순서를 저장하지 못했어요.');
      }
      setReorderingGroupId(null);
      window.setTimeout(() => { suppressGroupClick.current = false; }, 60);
    }
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.clearTimeout(longPressTimer.current);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, []);
  useEffect(() => () => {
    window.clearTimeout(paperPressTimer.current);
    paperTouchDrag.current = null;
    dragPreviewNode.current?.remove();
  }, []);
  useEffect(() => {
    const syncSection = () => {
      setSection(sectionFromHash());
      setEditMode(false);
      paperTouchDrag.current = null;
      finishPaperDrag();
    };
    window.addEventListener('hashchange', syncSection);
    return () => window.removeEventListener('hashchange', syncSection);
  }, []);
  useEffect(() => {
    const refresh = () => refreshCollection();
    window.addEventListener('storage', refresh);
    window.addEventListener('pageshow', refresh);
    return () => { window.removeEventListener('storage', refresh); window.removeEventListener('pageshow', refresh); };
  }, []);
  useEffect(() => {
    if (!editor && !openMenu && !editMode) return undefined;
    const closeOnEscape = event => {
      if (event.key !== 'Escape') return;
      if (editor) setEditor(null);
      else if (openMenu) setOpenMenu(null);
      else leaveEditMode();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [editor, openMenu, editMode]);
  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(''), 2400);
    return () => window.clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    const onSyncError = event => setNotice(event.detail?.message || '문제지를 서버에 동기화하지 못했어요.');
    window.addEventListener('moonble:custom-bank-sync-error', onSyncError);
    return () => window.removeEventListener('moonble:custom-bank-sync-error', onSyncError);
  }, []);
  useEffect(() => {
    if (!supabase) { window.location.replace(loginUrl()); return; }
    let alive = true;
    const accept = session => {
      if (!alive) return;
      if (!session) { window.location.replace(loginUrl()); return; }
      if (!hasProfile(session.user)) { window.location.replace(new URL('./prd.html', location.href)); return; }
      setCustomBankUser(session.user.id);
      setCollection(getCustomBankCollection(session.user.id));
      setSampleVisible(sampleIsVisible(session.user.id));
      setUser(session.user);
      document.documentElement.removeAttribute('data-auth-pending');
      if (bankSyncUserRef.current !== session.user.id) {
        bankSyncUserRef.current = session.user.id;
        syncCustomBankCollection(session.user.id).then(result => {
          if (!alive) return;
          setCollection(result.collection);
          if (result.migrated > 0) setNotice(`${result.migrated}개 문제지를 계정에 저장했어요.`);
        }).catch(() => {
          if (alive) setNotice('문제지는 이 기기에 남아 있어요. 서버 연결을 확인하면 다시 동기화합니다.');
        });
      }
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) accept(session);
      else if (event === 'SIGNED_OUT') window.location.replace(loginUrl());
    });
    getSessionSafely().then(({ session, error }) => {
      if (!alive) return;
      if (error || !session) { window.location.replace(loginUrl()); return; }
      accept(session);
    });
    return () => { alive = false; subscription.unsubscribe(); };
  }, []);
  async function logout() {
    setPending(true); setError('');
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
    } catch { setError('로그아웃하지 못했습니다. 다시 시도해주세요.'); }
    finally { setPending(false); }
  }
  function submitEditor() {
    try {
      if (editor.type === 'bank-edit') {
        updateCustomBankMeta(editor.title, editor.description, undefined, editor.bankId, editor.groupId);
        setNotice('문제지 정보를 저장했어요.');
      } else if (editor.type === 'bank-delete') {
        clearCustomBank(undefined, editor.bankId);
        setNotice('문제지를 삭제했어요.');
      } else if (editor.type === 'sample-delete') {
        localStorage.setItem(sampleVisibilityKey(user.id), 'true');
        setSampleVisible(false);
        setNotice('샘플 문제지를 삭제했어요.');
      } else if (editor.type === 'group-create') {
        const group = createCustomGroup(editor.name);
        setActiveGroup(group.id);
        setNotice('새 그룹을 만들었어요.');
      } else if (editor.type === 'group-edit') {
        updateCustomGroup(editor.groupId, editor.name);
        setNotice('그룹 이름을 바꿨어요.');
      } else if (editor.type === 'group-delete') {
        deleteCustomGroup(editor.groupId);
        if (activeGroup === editor.groupId) setActiveGroup(DEFAULT_GROUP_ID);
        setNotice('그룹을 삭제하고 문제지는 미분류로 옮겼어요.');
      }
      refreshCollection();
      setEditor(null);
      setOpenMenu(null);
    } catch (submitError) {
      setEditor(current => ({ ...current, error: submitError.message || '저장하지 못했습니다.' }));
    }
  }
  function beginGroupLongPress(event, groupId) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    window.clearTimeout(longPressTimer.current);
    groupPress.current = { id: groupId, x: event.clientX, y: event.clientY, active: false };
    longPressTimer.current = window.setTimeout(() => {
      if (!groupPress.current || groupPress.current.id !== groupId) return;
      groupPress.current.active = true;
      suppressGroupClick.current = true;
      setReorderingGroupId(groupId);
      navigator.vibrate?.(18);
    }, 460);
  }
  function moveBankToGroup(bankId, groupId) {
    if (!bankId || groupId === 'all') return;
    const bank = collection.banks.find(item => item.id === bankId);
    if (!bank || bank.groupId === groupId) return;
    try {
      updateCustomBankMeta(bank.title, bank.description, undefined, bank.id, groupId);
      setFolderPulse(groupId);
      setNotice(groupId === DEFAULT_GROUP_ID ? '문제지를 미분류로 옮겼어요.' : '문제지를 그룹으로 옮겼어요.');
      refreshCollection();
      window.setTimeout(() => setFolderPulse(current => current === groupId ? null : current), 560);
    } catch (moveError) {
      setNotice(moveError.message || '문제지를 옮기지 못했어요.');
    }
  }
  async function openShareDialog(paper) {
    const bank = collection.banks.find(item => item.id === paper.customBankId);
    if (!bank) return;
    setOpenMenu(null);
    setShareDialog({ bankId: bank.id, title: bank.title, token: '', url: '' });
    setShareBusy(true);
    setShareError('');
    setShareCopied(false);
    try {
      let token = getCachedQuizShareToken(user?.id, bank.id);
      if (token) {
        try { await getQuizShare(token); }
        catch { clearCachedQuizShareToken(user?.id, bank.id); token = null; }
      }
      if (!token) token = await createQuizShare(user.id, bank);
      setShareDialog({ bankId: bank.id, title: bank.title, token, url: quizShareUrl(token) });
    } catch (shareFailure) {
      setShareError(shareFailure.message || '공유 링크를 만들지 못했어요.');
    } finally {
      setShareBusy(false);
    }
  }
  async function copyShareLink() {
    if (!shareDialog?.url) return;
    try {
      await navigator.clipboard.writeText(shareDialog.url);
    } catch {
      const input = document.createElement('textarea');
      input.value = shareDialog.url;
      input.setAttribute('readonly', '');
      input.style.position = 'fixed'; input.style.opacity = '0';
      document.body.appendChild(input); input.select();
      const copied = document.execCommand('copy'); input.remove();
      if (!copied) { setShareError('링크를 복사하지 못했어요. 주소를 길게 눌러 복사해주세요.'); return; }
    }
    setShareCopied(true);
    window.setTimeout(() => setShareCopied(false), 1800);
  }
  async function stopShareLink() {
    if (!shareDialog?.bankId) return;
    setShareBusy(true);
    setShareError('');
    try {
      await revokeQuizShare(shareDialog.bankId);
      clearCachedQuizShareToken(user?.id, shareDialog.bankId);
      setShareDialog(null);
      setNotice('공유 링크를 중지했어요.');
    } catch (shareFailure) {
      setShareError(shareFailure.message || '공유 링크를 중지하지 못했어요.');
    } finally {
      setShareBusy(false);
    }
  }
  function beginPaperPress(event, bankId) {
    if (event.target.closest('button, [role="button"], .paper-card-actions')) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    window.clearTimeout(paperPressTimer.current);
    if (event.pointerType !== 'mouse') {
      if (!editMode) return;
      const source = event.currentTarget;
      paperTouchDrag.current = {
        bankId,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        x: event.clientX,
        y: event.clientY,
        source,
        active: false,
        targetGroupId: null,
        targetBankId: null,
        position: null,
      };
      paperPressTimer.current = window.setTimeout(() => {
        const drag = paperTouchDrag.current;
        if (!drag || drag.bankId !== bankId || drag.pointerId !== event.pointerId) return;
        const bounds = source.getBoundingClientRect();
        const preview = source.cloneNode(true);
        preview.removeAttribute('draggable');
        preview.querySelector('.paper-card-actions')?.remove();
        preview.classList.remove('is-dragging', 'is-pressing', 'is-editing');
        preview.classList.add('paper-drag-preview', 'is-touch-preview');
        preview.style.width = `${Math.max(112, Math.min(176, bounds.width * .52))}px`;
        document.body.appendChild(preview);
        preview.style.left = `${drag.x - preview.offsetWidth / 2}px`;
        preview.style.top = `${drag.y - Math.min(34, preview.offsetHeight / 2)}px`;
        dragPreviewNode.current = preview;
        drag.preview = preview;
        drag.active = true;
        setPressedBankId(null);
        setDraggedBankId(bankId);
        navigator.vibrate?.(18);
      }, 170);
      return;
    }
    paperPressTimer.current = window.setTimeout(() => {
      setPressedBankId(bankId);
      navigator.vibrate?.(12);
    }, 180);
  }
  function endPaperPress() {
    window.clearTimeout(paperPressTimer.current);
    if (!draggedBankId) setPressedBankId(null);
  }
  function createPaperDragPreview(event, bankId) {
    window.clearTimeout(paperPressTimer.current);
    dragPreviewNode.current?.remove();
    const source = event.currentTarget;
    const bounds = source.getBoundingClientRect();
    const preview = source.cloneNode(true);
    preview.removeAttribute('draggable');
    preview.querySelector('.paper-card-actions')?.remove();
    preview.classList.remove('is-dragging', 'is-pressing', 'is-editing');
    preview.classList.add('paper-drag-preview');
    preview.style.width = `${Math.max(112, Math.min(176, bounds.width * .52))}px`;
    document.body.appendChild(preview);
    dragPreviewNode.current = preview;
    event.dataTransfer.setDragImage(preview, preview.offsetWidth / 2, Math.min(34, preview.offsetHeight / 2));
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/x-moonble-bank', bankId);
    setPressedBankId(null);
    setDraggedBankId(bankId);
  }
  function bankDropPosition(event) {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (view === 'list') return event.clientY >= bounds.top + bounds.height / 2 ? 'after' : 'before';
    return event.clientX >= bounds.left + bounds.width / 2 ? 'after' : 'before';
  }
  function reorderBankNear(bankId, targetBankId, position) {
    if (!bankId || !targetBankId || bankId === targetBankId) return;
    const nextOrder = collection.banks.map(bank => bank.id);
    const from = nextOrder.indexOf(bankId);
    if (from < 0 || !nextOrder.includes(targetBankId)) return;
    nextOrder.splice(from, 1);
    const target = nextOrder.indexOf(targetBankId);
    nextOrder.splice(target + (position === 'after' ? 1 : 0), 0, bankId);
    try {
      reorderCustomBanks(nextOrder);
      refreshCollection();
      setNotice('문제지 순서를 바꿨어요.');
    } catch (reorderError) {
      setNotice(reorderError.message || '문제지 순서를 저장하지 못했어요.');
    }
  }
  function finishPaperDrag() {
    window.clearTimeout(paperPressTimer.current);
    dragPreviewNode.current?.remove();
    dragPreviewNode.current = null;
    setPressedBankId(null);
    setDraggedBankId(null);
    setDropGroupId(null);
    setDropBankTarget(null);
  }
  useEffect(() => {
    function moveTouchPaper(event) {
      const drag = paperTouchDrag.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      drag.x = event.clientX;
      drag.y = event.clientY;
      if (!drag.active) {
        if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 10) {
          window.clearTimeout(paperPressTimer.current);
          paperTouchDrag.current = null;
        }
        return;
      }

      event.preventDefault();
      const preview = drag.preview;
      if (preview) {
        preview.style.left = `${event.clientX - preview.offsetWidth / 2}px`;
        preview.style.top = `${event.clientY - Math.min(34, preview.offsetHeight / 2)}px`;
      }

      const pointed = document.elementFromPoint(event.clientX, event.clientY);
      const group = pointed?.closest?.('[data-group-id]');
      const groupId = group?.dataset.groupId;
      if (groupId && groupId !== 'all') {
        drag.targetGroupId = groupId;
        drag.targetBankId = null;
        drag.position = null;
        setDropBankTarget(null);
        setDropGroupId(groupId);
        return;
      }

      const card = pointed?.closest?.('[data-bank-id]');
      const targetBankId = card?.dataset.bankId;
      if (targetBankId && targetBankId !== drag.bankId) {
        const bounds = card.getBoundingClientRect();
        const position = view === 'list'
          ? (event.clientY >= bounds.top + bounds.height / 2 ? 'after' : 'before')
          : (event.clientX >= bounds.left + bounds.width / 2 ? 'after' : 'before');
        drag.targetGroupId = null;
        drag.targetBankId = targetBankId;
        drag.position = position;
        setDropGroupId(null);
        setDropBankTarget(current => current?.id === targetBankId && current.position === position ? current : { id: targetBankId, position });
        return;
      }

      drag.targetGroupId = null;
      drag.targetBankId = null;
      drag.position = null;
      setDropGroupId(null);
      setDropBankTarget(null);
    }

    function endTouchPaper(event) {
      const drag = paperTouchDrag.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      window.clearTimeout(paperPressTimer.current);
      paperTouchDrag.current = null;
      if (!drag.active) return;
      if (event.type === 'pointercancel') {
        finishPaperDrag();
        return;
      }
      event.preventDefault();
      if (drag.targetGroupId) moveBankToGroup(drag.bankId, drag.targetGroupId);
      else if (drag.targetBankId) reorderBankNear(drag.bankId, drag.targetBankId, drag.position || 'before');
      finishPaperDrag();
    }

    window.addEventListener('pointermove', moveTouchPaper, { passive: false });
    window.addEventListener('pointerup', endTouchPaper, { passive: false });
    window.addEventListener('pointercancel', endTouchPaper, { passive: false });
    return () => {
      window.removeEventListener('pointermove', moveTouchPaper);
      window.removeEventListener('pointerup', endTouchPaper);
      window.removeEventListener('pointercancel', endTouchPaper);
    };
  }, [view, collection]);

  function leaveEditMode() {
    paperTouchDrag.current = null;
    finishPaperDrag();
    setEditMode(false);
    setOpenMenu(null);
  }
  if (!user) return <div className="quiz-check" role="status" aria-label="문제지 여는 중"><span className="moonble-spinner" aria-hidden="true" /></div>;
  const customPapers = collection.banks.map(bank => ({
    id: `custom:${bank.id}`,
    customBankId: bank.id,
    groupId: bank.groupId,
    label: bank.title,
    level: '내 문제지',
    count: bank.questions.length,
    description: bank.description,
    savedAt: bank.savedAt,
    topics: `등록 ${bank.questions.length}문항 · 매회 20문항 출제`,
    kind: 'custom',
    samples: bank.questions.slice(0, 2).map(question => ({ title: question.q, options: question.options.slice(0, 3) })),
  }));
  const visibleSamples = sampleVisible ? papers : [];
  const allPapers = [...customPapers, ...visibleSamples];
  const search = query.trim().toLocaleLowerCase();
  const visiblePapers = allPapers.filter(paper => {
    const groupMatch = activeGroup === 'all' || (paper.kind === 'custom' && paper.groupId === activeGroup);
    const difficultyMatch = difficulty === '전체 난이도' || paper.level === difficulty;
    return groupMatch && difficultyMatch && `${paper.label} ${paper.description} ${paper.topics} ${paper.level}`.toLocaleLowerCase().includes(search);
  });
  const activeCustom = collection.banks.find(bank => bank.id === collection.activeBankId) || collection.banks[0] || null;
  const groupTabs = [
    { id: 'all', name: '전체', count: visibleSamples.length + collection.banks.length },
    { id: DEFAULT_GROUP_ID, name: '미분류', count: collection.banks.filter(bank => bank.groupId === DEFAULT_GROUP_ID).length },
    ...orderedGroupIds.map(id => collection.groups.find(group => group.id === id)).filter(Boolean).map(group => ({ ...group, count: collection.banks.filter(bank => bank.groupId === group.id).length })),
  ];
  const groupColors = buildGroupColorMap(collection.groups);
  return <div className="quiz-page" onClick={() => openMenu && setOpenMenu(null)}>
    <a className="quiz-skip" href={section === 'achievement' ? '#achievement' : section === 'create' ? '#quiz-creator' : '#paper-library'}>{section === 'achievement' ? '성취도 내용으로 건너뛰기' : section === 'create' ? '문제 생성 내용으로 건너뛰기' : '문제지 목록으로 건너뛰기'}</a>
    <AppHeader active={section} user={user} pending={pending} error={error} onLogout={logout} />
    <div className="quiz-content">
      {section === 'achievement' ? <QuizAchievement userId={user.id} /> : section === 'create' ? <QuizCreator custom={activeCustom} onChange={refreshCollection} /> : <main className="quiz-main mb-page-gutter quiz-library-main" id="paper-library" tabIndex={-1}>
        <div className="quiz-title"><div><h1 className="mb-page-title">문제지</h1></div><FlowActionButton className="quiz-create-button" aria-label="새 문제지 만들기" onClick={() => { window.location.hash = 'create'; }}><Plus size={18} aria-hidden="true" /><span>새 문제지<span className="quiz-create-optional"> 만들기</span></span></FlowActionButton></div>
        <div className="paper-group-bar">
          <div className="paper-group-tabs" role="tablist" aria-label="문제지 그룹">
            {groupTabs.map(group => <span
              className={`paper-group-tab${activeGroup === group.id ? ' is-active' : ''}${dropGroupId === group.id ? ' is-drop-target' : ''}${folderPulse === group.id ? ' is-receiving' : ''}${reorderingGroupId === group.id ? ' is-reordering' : ''}`}
              style={groupColorStyle(group.id, groupColors)}
              data-group-id={group.id}
              data-reorder-group={group.id !== 'all' && group.id !== DEFAULT_GROUP_ID ? group.id : undefined}
              key={group.id}
              onPointerDown={group.id !== 'all' && group.id !== DEFAULT_GROUP_ID ? event => beginGroupLongPress(event, group.id) : undefined}
              onDragEnter={group.id !== 'all' ? event => { if (draggedBankId) { event.preventDefault(); setDropBankTarget(null); setDropGroupId(group.id); } } : undefined}
              onDragOver={group.id !== 'all' ? event => { if (draggedBankId) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; } } : undefined}
              onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget)) setDropGroupId(current => current === group.id ? null : current); }}
              onDrop={group.id !== 'all' ? event => { event.preventDefault(); const bankId = event.dataTransfer.getData('application/x-moonble-bank') || draggedBankId; setDropGroupId(null); setDraggedBankId(null); moveBankToGroup(bankId, group.id); } : undefined}
            >
              <button type="button" role="tab" aria-selected={activeGroup === group.id} onClick={event => { event.stopPropagation(); if (suppressGroupClick.current) return; setActiveGroup(group.id); setOpenMenu(null); }}>{group.name}<small>{group.count}</small></button>
            </span>)}
          </div>
          {!!collection.groups.length && <span className="paper-group-manage" role="presentation">
            <button type="button" aria-label="그룹 편집" aria-haspopup="menu" aria-expanded={openMenu === 'groups:manage'} onClick={event => { event.stopPropagation(); setOpenMenu(openMenu === 'groups:manage' ? null : 'groups:manage'); }}><MoreHorizontal size={18} /></button>
            {openMenu === 'groups:manage' && <span className="paper-action-menu paper-group-manage-menu" role="menu" onClick={event => event.stopPropagation()}>
              <strong>그룹 편집</strong>
              {collection.groups.map(group => <span className="paper-group-manage-row" key={group.id}><b>{group.name}</b><button type="button" aria-label={`${group.name} 이름 바꾸기`} onClick={() => setEditor({ type: 'group-edit', groupId: group.id, name: group.name })}><Pencil size={15} /></button><button className="is-danger" type="button" aria-label={`${group.name} 삭제하기`} onClick={() => setEditor({ type: 'group-delete', groupId: group.id, name: group.name })}><Trash2 size={15} /></button></span>)}
            </span>}
          </span>}
          <button className="paper-group-add" type="button" onClick={event => { event.stopPropagation(); setEditor({ type: 'group-create', name: '' }); }}><FolderPlus size={16} />그룹 추가</button>
        </div>
        <div className="quiz-library-tools">
          <div className="quiz-filter-groups"><SegmentedControl className="quiz-difficulties" ariaLabel="난이도" items={difficultySegments} value={difficulty} onChange={setDifficulty} /></div>
          <div className="quiz-display-tools">
            <label className="quiz-search"><Search size={18} aria-hidden="true" /><span className="mb-sr-only">문제지 검색</span><input type="search" placeholder="검색" value={query} onChange={event => setQuery(event.target.value)} /></label>
            <SegmentedControl className="quiz-view-toggle" ariaLabel="보기 방식" iconOnly items={viewSegments} value={view} onChange={setView} />
          </div>
        </div>
        <section className={`paper-grid${view === 'list' ? ' paper-list' : ''}${editMode ? ' is-editing' : ''}`} aria-label="문제지 목록">
          {visiblePapers.map(paper => {
            const href = paper.customBankId ? `./solve.html?paper=custom&bank=${encodeURIComponent(paper.customBankId)}#quiz` : `./solve.html?paper=${paper.id}#quiz`;
            const menuKey = paper.customBankId ? `bank:${paper.customBankId}` : `sample:${paper.id}`;
            const groupName = paper.customBankId
              ? (paper.groupId === DEFAULT_GROUP_ID ? '미분류' : collection.groups.find(group => group.id === paper.groupId)?.name || '미분류')
              : null;
            const paperGroupStyle = paper.customBankId ? groupColorStyle(paper.groupId, groupColors) : undefined;
            const CardSurface = editMode ? 'div' : 'a';
            return <article
              className={`paper-card${editMode && paper.customBankId ? ' is-editing' : ''}${draggedBankId === paper.customBankId ? ' is-dragging' : ''}${pressedBankId === paper.customBankId ? ' is-pressing' : ''}${dropBankTarget && dropBankTarget.id === paper.customBankId ? ` is-drop-${dropBankTarget.position}` : ''}`}
              data-bank-id={paper.customBankId || undefined}
              draggable={Boolean(paper.customBankId)}
              onPointerDown={paper.customBankId ? event => beginPaperPress(event, paper.customBankId) : undefined}
              onPointerUp={paper.customBankId ? event => { if (!(editMode && event.pointerType !== 'mouse')) endPaperPress(); } : undefined}
              onPointerCancel={paper.customBankId ? event => { if (!(editMode && event.pointerType !== 'mouse')) endPaperPress(); } : undefined}
              onContextMenu={editMode ? event => event.preventDefault() : undefined}
              onDragStart={paper.customBankId ? event => { if (paperTouchDrag.current) { event.preventDefault(); return; } createPaperDragPreview(event, paper.customBankId); } : undefined}
              onDragEnd={paper.customBankId ? finishPaperDrag : undefined}
              onDragEnter={paper.customBankId ? event => {
                if (!draggedBankId || draggedBankId === paper.customBankId) return;
                event.preventDefault();
                setDropGroupId(null);
                setDropBankTarget({ id: paper.customBankId, position: bankDropPosition(event) });
              } : undefined}
              onDragOver={paper.customBankId ? event => {
                if (!draggedBankId || draggedBankId === paper.customBankId) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                const position = bankDropPosition(event);
                setDropBankTarget(current => current?.id === paper.customBankId && current.position === position ? current : { id: paper.customBankId, position });
              } : undefined}
              onDragLeave={paper.customBankId ? event => {
                if (!event.currentTarget.contains(event.relatedTarget)) setDropBankTarget(current => current?.id === paper.customBankId ? null : current);
              } : undefined}
              onDrop={paper.customBankId ? event => {
                event.preventDefault();
                event.stopPropagation();
                const bankId = event.dataTransfer.getData('application/x-moonble-bank') || draggedBankId;
                const position = dropBankTarget?.id === paper.customBankId ? dropBankTarget.position : bankDropPosition(event);
                reorderBankNear(bankId, paper.customBankId, position);
                finishPaperDrag();
              } : undefined}
              key={paper.id}
            >
              <CardSurface className="paper-card-link" {...(!editMode ? { href, 'aria-label': `${paper.label} · ${paper.count}문항 문제 풀기` } : {})} onClick={event => { if (editMode) { event.preventDefault(); return; } if (paper.customBankId) setActiveCustomBank(paper.customBankId); }}>
                {groupName && <span className="paper-group-flag" style={paperGroupStyle} aria-hidden="true">{groupName}</span>}
                <PaperPreview paper={paper} style={paperGroupStyle} />
                <div className="paper-info"><div className="paper-copy"><div className="paper-name-row"><h2 className="mb-card-title">{paper.label}</h2>{editMode && paper.customBankId && <button className="paper-inline-edit" type="button" aria-label={`${paper.label} 정보 편집`} onClick={event => { event.stopPropagation(); setEditor({ type: 'bank-edit', bankId: paper.customBankId, title: paper.label, description: paper.description, groupId: paper.groupId }); }}><Pencil size={13} aria-hidden="true" /></button>}</div><p>{paper.kind !== 'custom' && <><span>{paper.level}</span><i aria-hidden="true">·</i></>}<span className="paper-description">{paper.description}</span></p>{paper.savedAt && <time className="paper-added-at" dateTime={paper.savedAt} title={new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(paper.savedAt))}>{formatRelativeDate(paper.savedAt)}</time>}</div></div>
              </CardSurface>
              {(paper.customBankId || paper.id === 'basics') && <div className="paper-card-actions">
                {editMode && paper.customBankId ? <button className="paper-edit-done" type="button" title="편집 완료" aria-label={`${paper.label} 편집 완료`} onClick={event => { event.stopPropagation(); leaveEditMode(); }}><span>완료</span></button> : <>
                  <button type="button" aria-label={`${paper.label} 편집 메뉴`} aria-haspopup="menu" aria-expanded={openMenu === menuKey} onClick={event => { event.stopPropagation(); setOpenMenu(openMenu === menuKey ? null : menuKey); }}><MoreHorizontal size={18} /></button>
                  {openMenu === menuKey && <div className="paper-action-menu paper-card-action-menu" role="menu" onClick={event => event.stopPropagation()}>{paper.kind === 'custom' && paper.customBankId && <><button className="paper-action-edit" type="button" role="menuitem" aria-label={`${paper.label} 편집`} onClick={() => { setEditMode(true); setOpenMenu(null); }}><Pencil size={15} />편집</button><button type="button" role="menuitem" onClick={() => openShareDialog(paper)}><Link2 size={15} />공유 링크</button></>}<button className="is-danger" type="button" role="menuitem" onClick={() => { setOpenMenu(null); setEditor(paper.customBankId ? { type: 'bank-delete', bankId: paper.customBankId, title: paper.label } : { type: 'sample-delete', title: paper.label }); }}><Trash2 size={15} />삭제</button></div>}
                </>}
              </div>}
            </article>;
          })}
        </section>
        {!visiblePapers.length && <div className="quiz-empty"><Search size={28} aria-hidden="true" /><h2 className="mb-card-title">이 그룹에 문제지가 없어요</h2><p>새 문제지를 만들거나 다른 그룹을 선택해보세요.</p><button onClick={() => { window.location.hash = 'create'; }}>문제지 만들기</button></div>}
      </main>}<SiteFooter />
    </div>
    <ManagementDialog editor={editor} groups={collection.groups} onChange={setEditor} onClose={() => { setEditor(null); setOpenMenu(null); }} onSubmit={submitEditor} />
    {shareDialog && <div className="quiz-manage-overlay quiz-share-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !shareBusy) setShareDialog(null); }}><section className="quiz-manage-dialog quiz-share-dialog" role="dialog" aria-modal="true" aria-labelledby="quiz-share-title"><header><h2 id="quiz-share-title">문제지 공유</h2><button type="button" aria-label="닫기" onClick={() => !shareBusy && setShareDialog(null)}><X size={19} /></button></header><p><strong>{shareDialog.title}</strong> 링크를 받은 사람은 로그인 없이 문제를 풀 수 있어요.</p>{shareBusy ? <div className="quiz-share-loading" role="status"><span className="quiz-share-spinner" aria-hidden="true" />공유 링크를 준비하고 있어요.</div> : shareDialog.url ? <><label className="quiz-share-link"><span>공유 링크</span><input readOnly value={shareDialog.url} onFocus={event => event.currentTarget.select()} /></label><div className="quiz-share-note">문제와 정답은 링크 생성 시점의 내용으로 공유돼요. 언제든 이 문제지의 공유 링크를 모두 중지할 수 있어요.</div></> : null}{shareError && <p className="quiz-manage-error" role="alert">{shareError}</p>}<footer>{shareDialog.url && <button className="quiz-share-revoke" type="button" disabled={shareBusy} onClick={stopShareLink}>공유 중지</button>}<button className="is-primary" type="button" disabled={shareBusy || !shareDialog.url} onClick={copyShareLink}>{shareCopied ? <><Check size={16} />복사했어요</> : <><Copy size={16} />링크 복사</>}</button></footer></section></div>}
    {notice && <p className="quiz-library-notice" role="status">{notice}</p>}
  </div>;
}
createRoot(document.getElementById('root')).render(<QuizLibrary />);
