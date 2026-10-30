import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AlertTriangle, Check, Copy, FileDown, FolderPlus, GripVertical, LayoutGrid, Link2, List, MoreHorizontal, Pipette, Plus, Search, Share2, Star, Trash2, X } from 'lucide-react';
import { EditIcon } from './edit-icon.jsx';
import { cachedAuthSession, getSessionSafely, loginUrl, supabase } from './supabase.js';
import { hasProfile } from './profile.js';
import { SiteFooter } from './site-footer.jsx';
import {
  DEFAULT_GROUP_ID,
  clearCustomBank,
  createCustomGroup,
  exportCustomBankPDF,
  deleteCustomGroup,
  getCustomBankCollection,
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
import { revealPage } from './page-readiness.js';
import { BUILT_IN_PAPER_PREVIEWS as papers, PaperPreview } from './paper-preview.jsx';
import { SegmentedControl } from './segmented-control.jsx';
import { CommunityPage } from './quiz-community.jsx';
import { formatRelativeDateShortYear } from './date-format.js';
import { getPaperLastActivityMap } from './paper-activity.js';
import { getFavoritePaperIds, removeFavoritePaper, toggleFavoritePaper } from './paper-favorites.js';
import { buildGroupColorMap, defaultGroupColorKey, groupColorCheckColor, groupColorPreviewStyle, groupColorStyle, groupColorSwatch, GROUP_COLOR_OPTIONS, normalizeGroupHex } from './paper-group-colors.js';
import { PublicQuizSearch } from './public-quizzes.jsx';
import { SearchField } from './search-field.jsx';
import { getMyShareVisibilities, setShareVisibility } from './public-quizzes-api.js';
import { cacheQuizShareToken, clearCachedQuizShareToken, createQuizShare, getCachedQuizShareToken, getQuizShare, quizShareUrl, revokeQuizShare } from './quiz-share.js';
import './design-system.css';
import './quiz-library.css';

const paperScopes = [
  { label: '전체', value: 'all' },
  { label: '미공개', value: 'personal' },
  { label: '일부 공개', value: 'partial' },
  { label: '공개', value: 'public' },
];
const PAPER_TOUCH_DRAG_DELAY = 1000;
const paperDragPreviewWidth = cardWidth => Math.max(112, Math.min(176, cardWidth * .52));
const supportsMousePaperDrag = () => typeof window === 'undefined'
  || !window.matchMedia
  || window.matchMedia('(pointer: fine) and (hover: hover)').matches;

function QuizLibraryTabs({ section, className = '' }) {
  return <nav className={`quiz-library-tabs${className ? ` ${className}` : ''}`} aria-label="문제지 메뉴">
    <a href="#library" aria-current={section === 'papers' ? 'page' : undefined}>나의 문제지</a>
    <a href="#public" aria-current={section === 'public' ? 'page' : undefined}>문제 서칭</a>
    <a href="#community" aria-current={section === 'community' ? 'page' : undefined}>커뮤니티</a>
  </nav>;
}

const initialSession = cachedAuthSession();
const initialUser = initialSession && hasProfile(initialSession.user) ? initialSession.user : null;
const isWorkspaceReturn = (() => {
  try {
    const navigationType = performance.getEntriesByType('navigation')[0]?.type;
    if (!['navigate', 'back_forward'].includes(navigationType) || !document.referrer) return false;
    const referrer = new URL(document.referrer);
    return referrer.origin === window.location.origin
      && ['quiz.html', 'prd.html', 'account.html', 'solve.html'].includes(referrer.pathname.split('/').pop());
  } catch { return false; }
})();
const librarySyncKey = userId => `moonble:user:${userId}:quiz-library-synced-v1`;
function libraryCacheSignature(collection) {
  // Active paper selection changes locally on the way to the solver, so only
  // fingerprint the group and paper data that was actually synchronized.
  const value = JSON.stringify([collection.groups, collection.banks]);
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return `${collection.groups.length}:${collection.banks.length}:${hash >>> 0}`;
}
function hasSyncedLibraryCache(userId, collection) {
  if (!isWorkspaceReturn || !userId) return false;
  try { return sessionStorage.getItem(librarySyncKey(userId)) === libraryCacheSignature(collection); }
  catch { return false; }
}
function markSyncedLibraryCache(userId, collection) {
  try { sessionStorage.setItem(librarySyncKey(userId), libraryCacheSignature(collection)); }
  catch { /* Storage restrictions keep the safe loading skeleton on return visits. */ }
}
function clearSyncedLibraryCache(userId) {
  if (!userId) return;
  try { sessionStorage.removeItem(librarySyncKey(userId)); }
  catch { /* Readiness remains guarded by the confirmed account and server sync. */ }
}
const sampleVisibilityKey = userId => `moonble:user:${userId}:sample-paper-hidden-v1`;
const sampleIsVisible = userId => {
  try { return !userId || localStorage.getItem(sampleVisibilityKey(userId)) !== 'true'; }
  catch { return true; }
};
if (initialUser) {
  setCustomBankUser(initialUser.id);
}

function sectionFromHash() {
  if (window.location.hash === '#achievement') return 'achievement';
  if (window.location.hash === '#create') return 'create';
  if (window.location.hash === '#community') return 'community';
  if (window.location.hash === '#public') return 'public';
  return 'papers';
}

function ManagementDialog({ editor, groups, onChange, onClose, onSubmit }) {
  const overlayRef = useRef(null);
  const [customColorOpen, setCustomColorOpen] = useState(false);
  const [customColorDraft, setCustomColorDraft] = useState('#1B64DA');
  const [customColorError, setCustomColorError] = useState('');
  const colorEditorSession = useRef(0);

  useLayoutEffect(() => {
    const session = ++colorEditorSession.current;
    const isGroupEditor = editor?.type === 'group-create' || editor?.type === 'group-edit';
    setCustomColorOpen(Boolean(isGroupEditor && normalizeGroupHex(editor?.colorKey) && !GROUP_COLOR_OPTIONS.some(option => option.key === editor.colorKey)));
    setCustomColorDraft(groupColorSwatch(editor?.colorKey));
    setCustomColorError('');
    return () => { if (colorEditorSession.current === session) colorEditorSession.current += 1; };
  }, [editor?.type, editor?.groupId]);

  function applyCustomColor(value) {
    setCustomColorDraft(value);
    setCustomColorError('');
    const color = normalizeGroupHex(value);
    if (!color) return;
    onChange(current => current && current.type === editor?.type && current.groupId === editor?.groupId ? { ...current, colorKey: color } : current);
  }

  async function pickCustomColor() {
    const session = colorEditorSession.current;
    try {
      const result = await new window.EyeDropper().open();
      if (colorEditorSession.current === session) applyCustomColor(result.sRGBHex);
    } catch (pickerError) {
      if (colorEditorSession.current === session && pickerError?.name !== 'AbortError') setCustomColorError('색상을 가져오지 못했어요. 색상 선택기나 HEX 코드를 이용해 주세요.');
    }
  }

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
  const isFavoriteDelete = editor.type === 'favorite-delete-confirm';
  const customColorSelected = (Boolean(normalizeGroupHex(editor.colorKey)) && !GROUP_COLOR_OPTIONS.some(option => option.key === editor.colorKey)) || ['blue', 'cyan'].includes(editor.colorKey);
  const customColorInvalid = !isDelete && !isBank && customColorOpen && !normalizeGroupHex(customColorDraft);
  const title = editor.type === 'bank-edit' ? '문제지 편집' : editor.type === 'bank-delete' || isSample ? '문제지를 삭제할까요?' : editor.type === 'group-create' ? '새 그룹 만들기' : editor.type === 'group-edit' ? '그룹 편집' : '그룹을 삭제할까요?';
  return <div ref={overlayRef} className="quiz-manage-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <form className={`quiz-manage-dialog${isFavoriteDelete ? ' quiz-favorite-delete-dialog' : ''}`} role="dialog" aria-modal="true" aria-labelledby={isFavoriteDelete ? undefined : 'quiz-manage-title'} aria-label={isFavoriteDelete ? '즐겨찾기 문제지 삭제 확인' : undefined} onSubmit={event => { event.preventDefault(); onSubmit(); }}>
      {isFavoriteDelete ? <>
        <div className="quiz-favorite-delete-icon" aria-hidden="true"><AlertTriangle size={25} /></div>
        <p><strong>{editor.title}</strong><br />즐겨찾기한 문제지예요.<br />그래도 삭제할까요?</p>
        <footer><button type="button" onClick={onClose}>취소할래요.</button><button className="is-danger" type="submit">삭제할래요.</button></footer>
      </> : <>
        <header><h2 id="quiz-manage-title">{title}</h2><button type="button" aria-label="닫기" onClick={onClose}><X size={19} /></button></header>
        {isDelete ? <>
          <p><strong>{editor.title || editor.name}</strong>{isBank || isSample ? ' 문제지' : ' 그룹'}를 삭제하면 되돌릴 수 없어요.</p>
          {!isBank && !isSample && <p>이 그룹의 문제지는 삭제되지 않고 ‘미분류’로 이동해요.</p>}
        </> : isBank ? <div className="quiz-manage-fields">
          <label><span>문제지 이름</span><input autoFocus type="text" maxLength="80" value={editor.title} onChange={event => onChange({ ...editor, title: event.target.value })} /></label>
          <label><span>문제지 설명</span><textarea rows="3" maxLength="160" value={editor.description} onChange={event => onChange({ ...editor, description: event.target.value })} /></label>
          <label><span>그룹</span><select value={editor.groupId} onChange={event => onChange({ ...editor, groupId: event.target.value })}><option value={DEFAULT_GROUP_ID}>미분류</option>{groups.map(group => <option value={group.id} key={group.id}>{group.name}</option>)}</select></label>
        </div> : <div className="quiz-manage-fields">
          <label><span>그룹 이름</span><input autoFocus className="quiz-group-name-preview" style={groupColorPreviewStyle(editor.colorKey)} type="text" maxLength={12} value={editor.name} onChange={event => onChange({ ...editor, name: event.target.value.slice(0, 12) })} /><small className="quiz-group-name-hint">{editor.name.length}/12자</small></label>
          <fieldset className="quiz-group-color-field"><legend>배경 색상</legend><div className="quiz-group-color-options" role="group" aria-label="배경 색상">
            {GROUP_COLOR_OPTIONS.map(option => <button key={option.key} type="button" aria-pressed={editor.colorKey === option.key} aria-label={`${option.label} 색상`} title={option.label} className={`quiz-group-color-option${editor.colorKey === option.key ? ' is-selected' : ''}`} style={{ '--group-color-swatch': option.swatch, '--group-color-check': groupColorCheckColor(option.swatch) }} onClick={() => { setCustomColorOpen(false); setCustomColorError(''); onChange({ ...editor, colorKey: option.key }); }}><span />{editor.colorKey === option.key && <Check size={13} aria-hidden="true" />}</button>)}
            <button type="button" aria-pressed={customColorSelected} aria-expanded={customColorOpen} aria-label="사용자 지정 색상" aria-controls={customColorOpen ? 'quiz-custom-color-editor' : undefined} title="사용자 지정 색상" className={`quiz-group-color-option is-custom${customColorSelected ? ' is-selected' : ''}`} style={{ '--group-color-swatch': customColorSelected ? groupColorSwatch(editor.colorKey) : '#eef0f3', '--group-color-check': customColorSelected ? groupColorCheckColor(editor.colorKey) : '#6b7684' }} onClick={() => { if (!customColorOpen) setCustomColorDraft(groupColorSwatch(editor.colorKey)); setCustomColorError(''); setCustomColorOpen(!customColorOpen); }}><span /><Plus size={15} aria-hidden="true" /></button>
          </div>{customColorOpen && <div className="quiz-custom-color-editor" id="quiz-custom-color-editor">
            <div className="quiz-custom-color-row">
              <label className="quiz-custom-color-picker"><input type="color" aria-label="색상 선택" value={normalizeGroupHex(customColorDraft) || groupColorSwatch(editor.colorKey)} onChange={event => applyCustomColor(event.target.value)} /></label>
              <label className="quiz-custom-color-hex"><span>HEX</span><input type="text" aria-label="HEX 색상 코드" aria-invalid={customColorInvalid} aria-describedby={customColorInvalid ? 'quiz-custom-color-error' : undefined} value={customColorDraft} maxLength={7} spellCheck={false} autoCapitalize="characters" placeholder="#RRGGBB" onChange={event => applyCustomColor(event.target.value)} /></label>
              {typeof window.EyeDropper === 'function' && <button className="quiz-custom-color-eyedropper" type="button" aria-label="화면에서 색상 추출" title="화면에서 색상 추출" onClick={pickCustomColor}><Pipette size={17} aria-hidden="true" /></button>}
            </div>
            {customColorInvalid && <small className="quiz-custom-color-error" id="quiz-custom-color-error" role="alert">6자리 HEX 색상 코드를 입력해 주세요.</small>}
            {customColorError && <small className="quiz-custom-color-error" role="alert">{customColorError}</small>}
          </div>}</fieldset>
        </div>}
        {editor.error && <p className="quiz-manage-error" role="alert">{editor.error}</p>}
        <footer><button type="button" onClick={onClose}>취소</button><button className={isDelete ? 'is-danger' : 'is-primary'} type="submit" disabled={customColorInvalid || (!isDelete && !(isBank ? editor.title.trim() : editor.name.trim()))}>{isDelete ? '삭제하기' : editor.type === 'group-create' ? '만들기' : '저장하기'}</button></footer>
      </>}
    </form>
  </div>;
}

function QuizLibrarySkeleton({ view }) {
  const count = view === 'list' ? 5 : 6;
  return <div className="quiz-page quiz-page-skeleton">
    <AppHeader active="papers" profileSkeleton />
    <div className="quiz-content">
      <main className="quiz-main mb-page-gutter quiz-library-main" aria-busy="true" aria-label="문제지 목록을 불러오는 중">
        <div className="quiz-skeleton-title-row"><span className="quiz-skeleton-line quiz-skeleton-title" /><span className="quiz-skeleton-button" /></div>
        <div className="quiz-skeleton-tabs" aria-hidden="true">{[76, 92, 104, 68].map((width, index) => <i key={index} style={{ width }} />)}</div>
        <div className="quiz-skeleton-tools"><span /><span /></div>
        <section className={`quiz-library-skeleton-grid${view === 'list' ? ' is-list' : ''}`} aria-hidden="true">
          {Array.from({ length: count }, (_, index) => <article className="quiz-library-skeleton-card" key={index}>
            <div className="quiz-library-skeleton-preview"><i /></div>
            <div className="quiz-library-skeleton-copy"><b /><span /><small /></div>
          </article>)}
        </section>
      </main>
    </div>
  </div>;
}

function QuizLibrary() {
  const [user, setUser] = useState(initialUser);
  const [collectionReady, setCollectionReady] = useState(() => Boolean(initialUser)
    && hasSyncedLibraryCache(initialUser.id, getCustomBankCollection(initialUser.id)));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [paperScope, setPaperScope] = useState('all');
  const [view, setView] = useState('grid');
  const [collection, setCollection] = useState(() => initialUser ? getCustomBankCollection(initialUser.id) : getCustomBankCollection());
  const [paperAccess, setPaperAccess] = useState(() => getPaperLastActivityMap(initialUser?.id));
  const paperAccessSnapshotRef = useRef(JSON.stringify(getPaperLastActivityMap(initialUser?.id)));
  const [favoritePaperIds, setFavoritePaperIds] = useState(() => getFavoritePaperIds(initialUser?.id));
  const [activeGroup, setActiveGroup] = useState('all');
  const [openMenu, setOpenMenu] = useState(null);
  const [editor, setEditor] = useState(null);
  const [notice, setNotice] = useState('');
  const [undoablePaperDelete, setUndoablePaperDelete] = useState(null);
  const [shareDialog, setShareDialog] = useState(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareError, setShareError] = useState('');
  const [shareCopied, setShareCopied] = useState(false);
  const [shareVisibilities, setShareVisibilities] = useState(null);
  const [section, setSection] = useState(sectionFromHash);
  const [sampleVisible, setSampleVisible] = useState(() => sampleIsVisible(initialUser?.id));
  const [editMode, setEditMode] = useState(false);
  const [draggedBankId, setDraggedBankId] = useState(null);
  const [touchDraggingBankId, setTouchDraggingBankId] = useState(null);
  const [dropGroupId, setDropGroupId] = useState(null);
  const [folderPulse, setFolderPulse] = useState(null);
  const [pressedBankId, setPressedBankId] = useState(null);
  const [reorderingGroupId, setReorderingGroupId] = useState(null);
  const [orderedGroupIds, setOrderedGroupIds] = useState(() => collection.groups.map(group => group.id));
  const longPressTimer = useRef(0);
  const paperDeleteTimer = useRef(0);
  const paperDeleteToken = useRef(0);
  const undoablePaperDeleteRef = useRef(null);
  const paperPressTimer = useRef(0);
  const paperTouchDrag = useRef(null);
  const dragPreviewNode = useRef(null);
  const groupPress = useRef(null);
  const groupOrderRef = useRef(orderedGroupIds);
  const bankSyncUserRef = useRef(null);
  const suppressGroupClick = useRef(false);
  const refreshCollection = () => setCollection(getCustomBankCollection());
  useLayoutEffect(() => {
    // The React skeleton has committed, so it can replace the first-paint loader.
    revealPage();
  }, []);
  useLayoutEffect(() => {
    if (user && collectionReady) document.documentElement.removeAttribute('data-auth-pending');
  }, [user, collectionReady]);
  useEffect(() => {
    const refresh = event => {
      const nextAccess = getPaperLastActivityMap(user?.id);
      const nextSnapshot = JSON.stringify(nextAccess);
      if (event?.type === 'pageshow' && event.persisted && nextSnapshot !== paperAccessSnapshotRef.current) {
        // A solver visit updated recent order while this list was in the back/forward cache.
        // Reload under the page loader so the new order is present on the first visible list frame.
        document.documentElement.setAttribute('data-page-pending', '');
        window.location.reload();
        return;
      }
      paperAccessSnapshotRef.current = nextSnapshot;
      setPaperAccess(nextAccess);
    };
    window.addEventListener('storage', refresh);
    window.addEventListener('pageshow', refresh);
    window.addEventListener('moonble:paper-access', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('pageshow', refresh);
      window.removeEventListener('moonble:paper-access', refresh);
    };
  }, [user?.id]);
  useEffect(() => {
    const refresh = event => {
      if (event?.detail?.userId && event.detail.userId !== user?.id) return;
      setFavoritePaperIds(getFavoritePaperIds(user?.id));
    };
    window.addEventListener('storage', refresh);
    window.addEventListener('pageshow', refresh);
    window.addEventListener('moonble:paper-favorites', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('pageshow', refresh);
      window.removeEventListener('moonble:paper-favorites', refresh);
    };
  }, [user?.id]);
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
    paperTouchDrag.current?.source?.style.removeProperty('--paper-touch-scale');
    paperTouchDrag.current = null;
    dragPreviewNode.current?.remove();
  }, []);
  useEffect(() => {
    const syncSection = () => {
      const nextSection = sectionFromHash();
      setSection(nextSection);
      setEditMode(false);
      finishPaperDrag(paperTouchDrag.current);
      paperTouchDrag.current = null;
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
    const commitOnPageExit = () => {
      const pendingDelete = undoablePaperDeleteRef.current;
      if (pendingDelete) finishPaperDeletion(pendingDelete.token, true);
    };
    window.addEventListener('pagehide', commitOnPageExit);
    return () => window.removeEventListener('pagehide', commitOnPageExit);
  }, []);
  useEffect(() => {
    const onSyncError = event => setNotice(event.detail?.message || '문제지를 서버에 동기화하지 못했어요.');
    window.addEventListener('moonble:custom-bank-sync-error', onSyncError);
    return () => window.removeEventListener('moonble:custom-bank-sync-error', onSyncError);
  }, []);
  useEffect(() => {
    if (!supabase) { window.location.replace(loginUrl()); return; }
    let alive = true;
    let resolvedByAuthEvent = false;
    const accept = session => {
      if (!alive) return;
      if (!session) { window.location.replace(loginUrl()); return; }
      if (!hasProfile(session.user)) { window.location.replace(new URL('./prd.html', location.href)); return; }
      const previousUserId = bankSyncUserRef.current || initialUser?.id;
      if (previousUserId && previousUserId !== session.user.id) clearSyncedLibraryCache(previousUserId);
      if (previousUserId !== session.user.id) setPaperAccessOrder({});
      setCustomBankUser(session.user.id);
      const cachedCollection = getCustomBankCollection(session.user.id);
      setCollection(cachedCollection);
      const nextPaperAccess = getPaperLastActivityMap(session.user.id);
      paperAccessSnapshotRef.current = JSON.stringify(nextPaperAccess);
      setPaperAccess(nextPaperAccess);
      setSampleVisible(sampleIsVisible(session.user.id));
      setUser(session.user);
      if (bankSyncUserRef.current !== session.user.id) {
        setCollectionReady(hasSyncedLibraryCache(session.user.id, cachedCollection));
        bankSyncUserRef.current = session.user.id;
        getMyShareVisibilities().then(map => { if (alive) setShareVisibilities(map); });
        syncCustomBankCollection(session.user.id).then(result => {
          if (!alive || bankSyncUserRef.current !== session.user.id) return;
          setCollection(result.collection);
          if (result.synced) markSyncedLibraryCache(session.user.id, result.collection);
          setCollectionReady(true);
          if (result.migrated > 0) setNotice(`${result.migrated}개 문제지를 계정에 저장했어요.`);
        }).catch(() => {
          if (alive && bankSyncUserRef.current === session.user.id) {
            // A remote read may already have merged into storage before a later
            // upload fails. Reveal that latest available snapshot, not the old one.
            setCollection(getCustomBankCollection(session.user.id));
            setCollectionReady(true);
            setNotice('문제지는 이 기기에 남아 있어요. 서버 연결을 확인하면 다시 동기화합니다.');
          }
        });
      }
    };
    const resolveSession = ({ session, error }) => {
      if (!alive || resolvedByAuthEvent) return;
      if (error || !session) { window.location.replace(loginUrl()); return; }
      accept(session);
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!alive) return;
      if (session) {
        resolvedByAuthEvent = true;
        accept(session);
      } else if (event === 'INITIAL_SESSION' || event === 'SIGNED_OUT') {
        resolvedByAuthEvent = true;
        clearSyncedLibraryCache(bankSyncUserRef.current || initialUser?.id);
        window.location.replace(loginUrl());
      }
    });
    getSessionSafely().then(({ session, error, timedOut }) => {
      if (!alive || resolvedByAuthEvent) return;
      if (timedOut) {
        // A timeout says nothing about sign-in state. Keep the skeleton until
        // the SDK finishes; cached papers must not become the loading fallback.
        supabase.auth.getSession().then(({ data, error: sessionError }) => {
          resolveSession({ session: data.session, error: sessionError });
        }).catch(sessionError => resolveSession({ session: null, error: sessionError }));
        return;
      }
      resolveSession({ session, error });
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
  function finishPaperDeletion(token, shouldDelete) {
    const pendingDelete = undoablePaperDeleteRef.current;
    if (!pendingDelete || pendingDelete.token !== token) return;
    window.clearTimeout(paperDeleteTimer.current);
    undoablePaperDeleteRef.current = null;
    setUndoablePaperDelete(null);
    if (!shouldDelete) return;
    try {
      if (pendingDelete.kind === 'bank') {
        clearCustomBank(undefined, pendingDelete.bankId);
        refreshCollection();
      } else {
        localStorage.setItem(sampleVisibilityKey(user.id), 'true');
        setSampleVisible(false);
      }
      const nextFavorites = removeFavoritePaper(user.id, pendingDelete.id);
      setFavoritePaperIds(nextFavorites);
    } catch (deleteError) {
      setNotice(deleteError.message || '문제지를 삭제하지 못했어요.');
    }
  }
  function queuePaperDeletion(paper) {
    const previousDelete = undoablePaperDeleteRef.current;
    if (previousDelete) finishPaperDeletion(previousDelete.token, true);
    const pendingDelete = {
      token: ++paperDeleteToken.current,
      id: paper.id,
      kind: paper.customBankId ? 'bank' : 'sample',
      bankId: paper.customBankId || null,
      title: paper.label,
    };
    undoablePaperDeleteRef.current = pendingDelete;
    setUndoablePaperDelete(pendingDelete);
    setEditor(null);
    setOpenMenu(null);
    paperDeleteTimer.current = window.setTimeout(() => finishPaperDeletion(pendingDelete.token, true), 5000);
  }
  function undoPaperDeletion() {
    const pendingDelete = undoablePaperDeleteRef.current;
    if (pendingDelete) finishPaperDeletion(pendingDelete.token, false);
  }
  function submitEditor() {
    try {
      if (editor.type === 'favorite-delete-confirm') {
        queuePaperDeletion(editor.paper);
      } else if (editor.type === 'bank-edit') {
        updateCustomBankMeta(editor.title, editor.description, undefined, editor.bankId, editor.groupId);
        setNotice('문제지 정보를 저장했어요.');
      } else if (editor.type === 'bank-delete') {
        const bank = collection.banks.find(item => item.id === editor.bankId);
        if (bank) queuePaperDeletion({ id: `custom:${bank.id}`, customBankId: bank.id, label: bank.title });
      } else if (editor.type === 'sample-delete') {
        const sample = papers.find(item => item.id === 'basics');
        if (sample) queuePaperDeletion(sample);
      } else if (editor.type === 'group-create') {
        const group = createCustomGroup(editor.name, undefined, editor.colorKey);
        setActiveGroup(group.id);
        setNotice('새 그룹을 만들었어요.');
      } else if (editor.type === 'group-edit') {
        updateCustomGroup(editor.groupId, editor.name, undefined, editor.colorKey);
        setNotice('그룹 정보를 저장했어요.');
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
  function beginGroupHandleDrag(event, groupId) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    window.clearTimeout(longPressTimer.current);
    groupPress.current = { id: groupId, x: event.clientX, y: event.clientY, active: true };
    suppressGroupClick.current = true;
    setReorderingGroupId(groupId);
    navigator.vibrate?.(18);
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
  const visibilityOfBank = bankId => shareVisibilities
    ? (shareVisibilities[bankId] === 'public' ? 'public' : shareVisibilities[bankId] === 'unlisted' ? 'partial' : 'personal')
    : (getCachedQuizShareToken(user?.id, bankId) ? 'partial' : 'personal');
  const rememberVisibility = (bankId, visibility) => setShareVisibilities(current => {
    const next = { ...(current || {}) };
    if (visibility === 'personal') delete next[bankId]; else next[bankId] = visibility === 'public' ? 'public' : 'unlisted';
    return next;
  });
  // 저장된 링크가 살아 있으면 쓰고, 없으면 새로 만든다.
  async function ensureShareLink(bank, meta) {
    let token = getCachedQuizShareToken(user?.id, bank.id);
    if (token) {
      try { await getQuizShare(token); }
      catch { clearCachedQuizShareToken(user?.id, bank.id); token = null; }
    }
    if (!token) token = await createQuizShare(user.id, bank);
    return { token, url: quizShareUrl(token, meta.tint, meta.groupName) };
  }
  async function openShareDialog(paper) {
    const bank = collection.banks.find(item => item.id === paper.customBankId);
    if (!bank) return;
    setOpenMenu(null);
    const groupName = paper.groupId === DEFAULT_GROUP_ID
      ? '미분류'
      : collection.groups.find(group => group.id === paper.groupId)?.name || '미분류';
    const tint = groupColorStyle(paper.groupId, groupColors)['--paper-group-tint'] || '#e8f3ff';
    const visibility = visibilityOfBank(bank.id);
    setShareDialog({ bankId: bank.id, title: bank.title, token: '', url: '', visibility, meta: { groupName, tint } });
    setShareError('');
    setShareCopied(false);
    if (visibility === 'personal') return;
    setShareBusy(true);
    try {
      const link = await ensureShareLink(bank, { groupName, tint });
      setShareDialog(current => current && { ...current, ...link });
    } catch (shareFailure) {
      setShareError(shareFailure.message || '공유 링크를 만들지 못했어요.');
    } finally {
      setShareBusy(false);
    }
  }
  // 공개 범위 선택: 미공개(공유 중지) / 일부 공개(링크) / 공개(검색 노출)
  async function chooseVisibility(next) {
    if (!shareDialog?.bankId || shareBusy || next === shareDialog.visibility) return;
    const bank = collection.banks.find(item => item.id === shareDialog.bankId);
    if (!bank) return;
    setShareBusy(true);
    setShareError('');
    try {
      if (next === 'personal') {
        await revokeQuizShare(bank.id);
        clearCachedQuizShareToken(user?.id, bank.id);
        rememberVisibility(bank.id, 'personal');
        setShareDialog(current => current && { ...current, visibility: 'personal', token: '', url: '' });
        setNotice('공유를 중지했어요. 이제 나만 볼 수 있어요.');
      } else {
        const link = shareDialog.url ? { token: shareDialog.token, url: shareDialog.url } : await ensureShareLink(bank, shareDialog.meta);
        await setShareVisibility(bank.id, next === 'public' ? 'public' : 'unlisted', link.token);
        rememberVisibility(bank.id, next);
        setShareDialog(current => current && { ...current, ...link, visibility: next });
      }
    } catch (shareFailure) {
      setShareError(shareFailure.message || '공개 범위를 바꾸지 못했어요.');
    } finally {
      setShareBusy(false);
    }
  }
  function exportPaperPDF(paper) {
    const bank = collection.banks.find(item => item.id === paper.customBankId);
    setOpenMenu(null);
    if (!bank || !exportCustomBankPDF(bank)) {
      setNotice('PDF 내보내기 창을 열지 못했어요. 팝업 허용 여부를 확인해주세요.');
      return;
    }
    setNotice('PDF 저장 창을 열었어요. 인쇄 화면에서 PDF로 저장할 수 있어요.');
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
  async function shareQuizLink() {
    if (!shareDialog?.url) return;
    if (typeof navigator.share !== 'function') {
      await copyShareLink();
      return;
    }
    try {
      await navigator.share({
        title: `[문블] ${shareDialog.title}`,
        text: `${shareDialog.title} 문제지를 풀어보세요.`,
        url: shareDialog.url,
      });
    } catch (shareFailure) {
      if (shareFailure?.name === 'AbortError') return;
      await copyShareLink();
    }
  }
  function beginPaperPress(event, bankId) {
    if (event.target.closest('button, [role="button"], .paper-card-actions')) return;
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    window.clearTimeout(paperPressTimer.current);
    paperPressTimer.current = window.setTimeout(() => {
      setPressedBankId(bankId);
      navigator.vibrate?.(12);
    }, 180);
  }
  function beginPaperTouch(event, bankId) {
    if (!editMode || event.target.closest('button, [role="button"], .paper-card-actions')) return;
    if (event.touches.length !== 1) {
      const activeDrag = paperTouchDrag.current?.active;
      window.clearTimeout(paperPressTimer.current);
      paperTouchDrag.current = null;
      if (activeDrag) finishPaperDrag();
      return;
    }
    const touch = event.changedTouches[0];
    if (!touch) return;
    window.clearTimeout(paperPressTimer.current);
    const drag = {
      bankId,
      touchId: touch.identifier,
      startX: touch.clientX,
      startY: touch.clientY,
      x: touch.clientX,
      y: touch.clientY,
      lastY: touch.clientY,
      source: event.currentTarget,
      active: false,
      scrolling: false,
      targetGroupId: null,
    };
    paperTouchDrag.current = drag;
    paperPressTimer.current = window.setTimeout(() => {
      if (paperTouchDrag.current !== drag || !drag.source.isConnected) return;
      const bounds = drag.source.getBoundingClientRect();
      const preview = drag.source.cloneNode(true);
      preview.removeAttribute('draggable');
      preview.querySelector('.paper-card-actions')?.remove();
      preview.classList.remove('is-dragging', 'is-pressing', 'is-editing');
      preview.classList.add('paper-drag-preview', 'is-touch-preview');
      const previewWidth = paperDragPreviewWidth(bounds.width);
      preview.style.width = `${previewWidth}px`;
      drag.source.style.setProperty('--paper-touch-scale', String(previewWidth / bounds.width));
      document.body.appendChild(preview);
      preview.style.left = `${drag.x - preview.offsetWidth / 2}px`;
      preview.style.top = `${drag.y - Math.min(34, preview.offsetHeight / 2)}px`;
      dragPreviewNode.current = preview;
      drag.preview = preview;
      drag.active = true;
      setTouchDraggingBankId(bankId);
      setDraggedBankId(bankId);
      navigator.vibrate?.(18);
    }, PAPER_TOUCH_DRAG_DELAY);
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
    preview.style.width = `${paperDragPreviewWidth(bounds.width)}px`;
    document.body.appendChild(preview);
    dragPreviewNode.current = preview;
    event.dataTransfer.setDragImage(preview, preview.offsetWidth / 2, Math.min(34, preview.offsetHeight / 2));
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/x-moonble-bank', bankId);
    setPressedBankId(null);
    setDraggedBankId(bankId);
  }
  function finishPaperDrag(touchDrag = null) {
    window.clearTimeout(paperPressTimer.current);
    if (touchDrag?.source) touchDrag.source.style.removeProperty('--paper-touch-scale');
    dragPreviewNode.current?.remove();
    dragPreviewNode.current = null;
    setTouchDraggingBankId(null);
    setPressedBankId(null);
    setDraggedBankId(null);
    setDropGroupId(null);
  }
  useEffect(() => {
    function moveTouchPaper(event) {
      const drag = paperTouchDrag.current;
      if (!drag || drag.touchId == null) return;
      if (event.touches.length !== 1) {
        window.clearTimeout(paperPressTimer.current);
        paperTouchDrag.current = null;
        if (drag.active) finishPaperDrag(drag);
        return;
      }
      const touch = Array.from(event.changedTouches).find(item => item.identifier === drag.touchId);
      if (!touch) return;
      drag.x = touch.clientX;
      drag.y = touch.clientY;
      if (!drag.active) {
        if (Math.hypot(touch.clientX - drag.startX, touch.clientY - drag.startY) > 10) {
          window.clearTimeout(paperPressTimer.current);
          drag.scrolling = true;
          setPressedBankId(null);
        }
        if (drag.scrolling) {
          const scrollDelta = drag.lastY - touch.clientY;
          drag.lastY = touch.clientY;
          if (scrollDelta) {
            if (event.cancelable) event.preventDefault();
            const scrollRoot = document.scrollingElement || document.documentElement;
            scrollRoot.scrollTop += scrollDelta;
          }
        }
        return;
      }

      if (event.cancelable) event.preventDefault();
      const preview = drag.preview;
      if (preview) {
        preview.style.left = `${touch.clientX - preview.offsetWidth / 2}px`;
        preview.style.top = `${touch.clientY - Math.min(34, preview.offsetHeight / 2)}px`;
      }
      const pointed = document.elementFromPoint(touch.clientX, touch.clientY);
      const groupId = pointed?.closest?.('[data-group-id]')?.dataset.groupId;
      if (groupId && groupId !== 'all') {
        drag.targetGroupId = groupId;
        setDropGroupId(groupId);
      } else {
        drag.targetGroupId = null;
        setDropGroupId(null);
      }
    }

    function endTouchPaper(event) {
      const drag = paperTouchDrag.current;
      if (!drag || drag.touchId == null || !Array.from(event.changedTouches).some(item => item.identifier === drag.touchId)) return;
      window.clearTimeout(paperPressTimer.current);
      paperTouchDrag.current = null;
      if (!drag.active) return;
      if (event.type === 'touchcancel') {
        finishPaperDrag(drag);
        return;
      }
      if (drag.targetGroupId) moveBankToGroup(drag.bankId, drag.targetGroupId);
      finishPaperDrag(drag);
    }

    window.addEventListener('touchmove', moveTouchPaper, { passive: false });
    window.addEventListener('touchend', endTouchPaper, { passive: false });
    window.addEventListener('touchcancel', endTouchPaper, { passive: false });
    return () => {
      window.removeEventListener('touchmove', moveTouchPaper);
      window.removeEventListener('touchend', endTouchPaper);
      window.removeEventListener('touchcancel', endTouchPaper);
    };
  }, [collection]);

  function leaveEditMode() {
    finishPaperDrag(paperTouchDrag.current);
    paperTouchDrag.current = null;
    setEditMode(false);
    setOpenMenu(null);
  }
  function enterEditMode() {
    setEditMode(true);
    setOpenMenu(null);
    setNotice('폴더 탭으로 문제지를 드래그해 그룹을 변경할 수 있어요.');
  }
  function togglePaperFavorite(event, paper) {
    event.preventDefault();
    event.stopPropagation();
    setFavoritePaperIds(toggleFavoritePaper(user.id, paper.id));
  }
  if (!user || !collectionReady) return <QuizLibrarySkeleton view={view} />;
  const customPapers = collection.banks.filter(bank => bank.id !== undoablePaperDelete?.bankId).map(bank => ({
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
    visibility: bank.visibility || (shareVisibilities ? (shareVisibilities[bank.id] === 'public' ? 'public' : shareVisibilities[bank.id] === 'unlisted' ? 'partial' : 'personal') : (getCachedQuizShareToken(user.id, bank.id) ? 'partial' : 'personal')),
    samples: bank.questions.slice(0, 4).map(question => ({ title: question.q, options: question.options })),
  }));
  const visibleSamples = sampleVisible && undoablePaperDelete?.kind !== 'sample' ? papers : [];
  const allPapers = [...customPapers, ...visibleSamples].map(paper => ({
    ...paper,
    lastOpenedAt: paperAccess[paper.id] || null,
  }));
  const search = query.trim().toLocaleLowerCase();
  // 검색어 자동완성: 내 문제지(샘플 포함) 제목 중 검색어가 들어간 것.
  const suggestPaperTitles = term => { const needle = term.toLocaleLowerCase(); return [...new Set(allPapers.map(paper => paper.label).filter(title => title && title.toLocaleLowerCase().includes(needle)))].slice(0, 8); };
  const visiblePapers = allPapers.filter(paper => {
    const groupMatch = activeGroup === 'all' || (paper.kind === 'custom' && paper.groupId === activeGroup);
    const scopeMatch = paperScope === 'all'
      || (paperScope === 'personal' && paper.kind === 'custom' && paper.visibility === 'personal')
      || (paperScope === 'public' && (paper.kind !== 'custom' || paper.visibility === 'public'))
      || (paperScope === 'partial' && paper.kind === 'custom' && paper.visibility === 'partial');
    return groupMatch && scopeMatch && `${paper.label} ${paper.description} ${paper.topics} ${paper.level}`.toLocaleLowerCase().includes(search);
  }).sort((a, b) => {
    const aOpened = a.lastOpenedAt ? new Date(a.lastOpenedAt).getTime() : 0;
    const bOpened = b.lastOpenedAt ? new Date(b.lastOpenedAt).getTime() : 0;
    if (aOpened || bOpened) {
      if (!aOpened) return 1;
      if (!bOpened) return -1;
      return bOpened - aOpened;
    }
    return new Date(b.savedAt || 0).getTime() - new Date(a.savedAt || 0).getTime();
  });
  const activeCustom = collection.banks.find(bank => bank.id === collection.activeBankId) || collection.banks[0] || null;
  const groupTabs = [
    { id: 'all', name: '전체', count: visibleSamples.length + customPapers.length },
    ...orderedGroupIds.map(id => collection.groups.find(group => group.id === id)).filter(Boolean).map(group => ({ ...group, count: customPapers.filter(bank => bank.groupId === group.id).length })),
    { id: DEFAULT_GROUP_ID, name: '미분류', count: customPapers.filter(bank => bank.groupId === DEFAULT_GROUP_ID).length },
  ];
  const managedGroups = [...collection.groups].sort((a, b) => {
    const aIndex = orderedGroupIds.indexOf(a.id);
    const bIndex = orderedGroupIds.indexOf(b.id);
    return (aIndex < 0 ? Number.MAX_SAFE_INTEGER : aIndex) - (bIndex < 0 ? Number.MAX_SAFE_INTEGER : bIndex);
  });
  const groupColors = buildGroupColorMap(collection.groups);
  const editingPaperCards = editMode;
  const hasLibrarySection = ['papers', 'public', 'community'].includes(section);
  const libraryTitle = section === 'public' ? '문제 서칭' : section === 'community' ? '커뮤니티' : '문제지';
  return <div className={`quiz-page is-initial-reveal${editMode && section === 'papers' ? ' is-library-editing' : ''}`} onClick={() => openMenu && setOpenMenu(null)}>
    <a className="quiz-skip" href={section === 'achievement' ? '#achievement' : section === 'create' ? '#quiz-creator' : '#paper-library'}>{section === 'achievement' ? '성취도 내용으로 건너뛰기' : section === 'create' ? '문제 생성 내용으로 건너뛰기' : '문제지 목록으로 건너뛰기'}</a>
    <AppHeader active={['community', 'public'].includes(section) ? 'papers' : section} user={user} pending={pending} error={error} onLogout={logout} mobileSubnav={hasLibrarySection ? <QuizLibraryTabs section={section} /> : null} />
    <div className="quiz-content">
      {section === 'achievement' ? <QuizAchievement userId={user.id} /> : section === 'create' ? <QuizCreator custom={activeCustom} onChange={refreshCollection} /> : <main className="quiz-main mb-page-gutter quiz-library-main" id="paper-library" tabIndex={-1}>
        <QuizLibraryTabs section={section} className="quiz-library-tabs--desktop" />
        <div className="quiz-title"><div><h1 className="mb-page-title">{libraryTitle}</h1></div>{section === 'papers' && <FlowActionButton size="compact" className="quiz-create-button" aria-label="새 문제지 만들기" onClick={() => { window.location.hash = 'create'; }}><Plus size={16} aria-hidden="true" /><span>새 문제지<span className="quiz-create-optional"> 만들기</span></span></FlowActionButton>}</div>
        {section === 'community' ? <CommunityPage user={user} banks={collection.banks} /> : section === 'public' ? <PublicQuizSearch /> : <>
        <div className="paper-group-bar">
          <div className="paper-group-strip">
            <div className="paper-group-tabs" role="tablist" aria-label="문제지 그룹">
            {groupTabs.map(group => <span
              className={`paper-group-tab${activeGroup === group.id ? ' is-active' : ''}${dropGroupId === group.id ? ' is-drop-target' : ''}${folderPulse === group.id ? ' is-receiving' : ''}${reorderingGroupId === group.id ? ' is-reordering' : ''}`}
              style={groupColorStyle(group.id, groupColors)}
              data-group-id={group.id}
              data-reorder-group={group.id !== 'all' && group.id !== DEFAULT_GROUP_ID ? group.id : undefined}
              key={group.id}
              onPointerDown={group.id !== 'all' && group.id !== DEFAULT_GROUP_ID ? event => beginGroupLongPress(event, group.id) : undefined}
              onDragEnter={group.id !== 'all' ? event => { if (draggedBankId) { event.preventDefault(); setDropGroupId(group.id); } } : undefined}
              onDragOver={group.id !== 'all' ? event => { if (draggedBankId) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; } } : undefined}
              onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget)) setDropGroupId(current => current === group.id ? null : current); }}
              onDrop={group.id !== 'all' ? event => { event.preventDefault(); const bankId = event.dataTransfer.getData('application/x-moonble-bank') || draggedBankId; setDropGroupId(null); setDraggedBankId(null); moveBankToGroup(bankId, group.id); } : undefined}
            >
              <button type="button" role="tab" aria-selected={activeGroup === group.id} onClick={event => { event.stopPropagation(); if (suppressGroupClick.current) return; setActiveGroup(group.id); setOpenMenu(null); }}>{group.name}<small>{group.count}</small></button>
            </span>)}
            </div>
            <button className="paper-group-add paper-group-add--mobile" type="button" onClick={event => { event.stopPropagation(); setEditor({ type: 'group-create', name: '', colorKey: GROUP_COLOR_OPTIONS[0].key }); }}><FolderPlus size={16} />그룹 추가</button>
          </div>
          {!!collection.groups.length && <span className="paper-group-manage" role="presentation">
            <button type="button" aria-label="그룹 편집" aria-haspopup="menu" aria-expanded={openMenu === 'groups:manage'} onClick={event => { event.stopPropagation(); setOpenMenu(openMenu === 'groups:manage' ? null : 'groups:manage'); }}><MoreHorizontal size={18} /></button>
            {openMenu === 'groups:manage' && <span className="paper-action-menu paper-group-manage-menu" role="menu" onClick={event => event.stopPropagation()}>
              <strong>그룹 편집</strong>
              {managedGroups.map(group => <span className={`paper-group-manage-row${reorderingGroupId === group.id ? ' is-reordering' : ''}`} data-reorder-group={group.id} key={group.id}><button className="paper-group-reorder-handle" type="button" aria-label={`${group.name} 그룹 순서 변경`} title="드래그해서 순서 변경" onPointerDown={event => beginGroupHandleDrag(event, group.id)}><GripVertical size={16} aria-hidden="true" /></button><b>{group.name}</b><button type="button" aria-label={`${group.name} 그룹 편집`} onClick={() => setEditor({ type: 'group-edit', groupId: group.id, name: group.name, colorKey: group.colorKey || defaultGroupColorKey(group.id) })}><EditIcon size={15} /></button><button className="is-danger" type="button" aria-label={`${group.name} 삭제하기`} onClick={() => setEditor({ type: 'group-delete', groupId: group.id, name: group.name })}><Trash2 size={15} /></button></span>)}
            </span>}
          </span>}
          <button className="paper-group-add paper-group-add--desktop" type="button" onClick={event => { event.stopPropagation(); setEditor({ type: 'group-create', name: '', colorKey: GROUP_COLOR_OPTIONS[0].key }); }}><FolderPlus size={16} />그룹 추가</button>
        </div>
        <div className="quiz-library-tools">
          <div className="quiz-filter-groups"><SegmentedControl className="quiz-community-sort" ariaLabel="문제지 종류" items={paperScopes} value={paperScope} onChange={setPaperScope} /></div>
          <button type="button" className="quiz-view-toggle-button" aria-label={view === 'grid' ? '1열 목록으로 보기' : '2열 카드로 보기'} title={view === 'grid' ? '1열 목록으로 보기' : '2열 카드로 보기'}
            onClick={() => setView(current => current === 'grid' ? 'list' : 'grid')}>{view === 'grid' ? <List size={18} aria-hidden="true" /> : <LayoutGrid size={18} aria-hidden="true" />}</button>
          <SearchField className="quiz-library-search" label="문제지 검색" placeholder="문제지 제목으로 찾아보세요" value={query} onSearch={setQuery}
            suggest={suggestPaperTitles} recentKey="moonble:paper-search-recent" />
        </div>
        <section className={`paper-grid${view === 'list' ? ' paper-list' : ''}${editingPaperCards ? ' is-editing' : ''}`} aria-label="문제지 목록">
          {visiblePapers.map(paper => {
            const href = paper.customBankId ? `./solve.html?paper=custom&bank=${encodeURIComponent(paper.customBankId)}#quiz` : `./solve.html?paper=${paper.id}#quiz`;
            const menuKey = paper.customBankId ? `bank:${paper.customBankId}` : `sample:${paper.id}`;
            const paperGroupStyle = paper.customBankId ? groupColorStyle(paper.groupId, groupColors) : undefined;
            const isFavorite = favoritePaperIds.includes(paper.id);
            const CardSurface = editingPaperCards ? 'div' : 'a';
            return <article
              className={`paper-card${editingPaperCards && paper.customBankId ? ' is-editing' : ''}${draggedBankId === paper.customBankId ? ' is-dragging' : ''}${touchDraggingBankId === paper.customBankId ? ' is-touch-dragging' : ''}${pressedBankId === paper.customBankId ? ' is-pressing' : ''}`}
              data-bank-id={paper.customBankId || undefined}
              draggable={Boolean(editingPaperCards && paper.customBankId && supportsMousePaperDrag())}
              onPointerDown={paper.customBankId ? event => beginPaperPress(event, paper.customBankId) : undefined}
              onTouchStart={paper.customBankId ? event => beginPaperTouch(event, paper.customBankId) : undefined}
              onPointerUp={paper.customBankId ? event => { if (!(editingPaperCards && event.pointerType !== 'mouse')) endPaperPress(); } : undefined}
              onPointerCancel={paper.customBankId ? event => { if (!(editingPaperCards && event.pointerType !== 'mouse')) endPaperPress(); } : undefined}
              onContextMenu={editingPaperCards ? event => event.preventDefault() : undefined}
              onDragStart={editingPaperCards && paper.customBankId ? event => { if (paperTouchDrag.current) { event.preventDefault(); return; } createPaperDragPreview(event, paper.customBankId); } : undefined}
              onDragEnd={paper.customBankId ? finishPaperDrag : undefined}
              key={paper.id}
            >
              <CardSurface className="paper-card-link" {...(!editingPaperCards ? { href, 'aria-label': `${paper.label} · ${paper.count}문항 문제 풀기` } : {})} onClick={event => { if (editingPaperCards) { event.preventDefault(); return; } if (paper.customBankId) setActiveCustomBank(paper.customBankId); if (mobileSearchOpen && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); window.location.replace(href); } }}>
                <PaperPreview paper={paper} style={paperGroupStyle} />
                <div className="paper-info has-activity-caption"><div className="paper-copy"><div className="paper-name-row"><h2 className="mb-card-title">{paper.label}</h2>{editingPaperCards && paper.customBankId && <button className="paper-inline-edit" type="button" aria-label={`${paper.label} 정보 편집`} onClick={event => { event.stopPropagation(); setEditor({ type: 'bank-edit', bankId: paper.customBankId, title: paper.label, description: paper.description, groupId: paper.groupId }); }}><EditIcon size={13} aria-hidden="true" /></button>}</div><p>{paper.kind !== 'custom' && <><span>{paper.level}</span><i aria-hidden="true">·</i></>}<span className="paper-description">{paper.description}</span></p>{paper.lastOpenedAt ? <time className="paper-added-at" dateTime={paper.lastOpenedAt} title={new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(paper.lastOpenedAt))}>{formatRelativeDateShortYear(paper.lastOpenedAt)}</time> : <span className="paper-added-at is-unplayed">아직 풀이 전</span>}</div></div>
              </CardSurface>
              <button className={`paper-favorite-toggle${isFavorite ? ' is-active' : ''}`} type="button" aria-label={`${paper.label} ${isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}`} aria-pressed={isFavorite} title={isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'} onPointerDown={event => event.stopPropagation()} onClick={event => togglePaperFavorite(event, paper)}><Star size={16} fill={isFavorite ? 'currentColor' : 'none'} aria-hidden="true" /></button>
              {(paper.customBankId || paper.id === 'basics') && !editingPaperCards && <div className="paper-card-actions">
                  <button type="button" aria-label={`${paper.label} 편집 메뉴`} aria-haspopup="menu" aria-expanded={openMenu === menuKey} onClick={event => { event.stopPropagation(); setOpenMenu(openMenu === menuKey ? null : menuKey); }}><MoreHorizontal size={18} /></button>
                  {openMenu === menuKey && <div className="paper-action-menu paper-card-action-menu" role="menu" onClick={event => event.stopPropagation()}>{paper.kind === 'custom' && paper.customBankId && <><button className="paper-action-edit" type="button" role="menuitem" aria-label={`${paper.label} 편집`} onClick={enterEditMode}><EditIcon size={15} />편집</button><button type="button" role="menuitem" onClick={() => openShareDialog(paper)}><Link2 size={15} />공유 링크</button><button type="button" role="menuitem" onClick={() => exportPaperPDF(paper)}><FileDown size={15} />PDF 내보내기</button></>}<button className="is-danger" type="button" role="menuitem" onClick={() => { setOpenMenu(null); setEditor(isFavorite ? { type: 'favorite-delete-confirm', paper, title: paper.label } : (paper.customBankId ? { type: 'bank-delete', bankId: paper.customBankId, title: paper.label } : { type: 'sample-delete', title: paper.label })); }}><Trash2 size={15} />삭제</button></div>}
              </div>}
            </article>;
          })}
        </section>
        {!visiblePapers.length && (search ? <div className="quiz-empty"><Search size={28} aria-hidden="true" /><h2 className="mb-card-title">검색 결과가 없어요</h2><p>다른 검색어로 다시 찾아보세요.</p></div> : <div className="quiz-empty"><Search size={28} aria-hidden="true" /><h2 className="mb-card-title">이 그룹에 문제지가 없어요</h2><p>새 문제지를 만들거나 다른 그룹을 선택해보세요.</p><button onClick={() => { window.location.hash = 'create'; }}>문제지 만들기</button></div>)}
        {editMode && <button className="quiz-library-edit-done" type="button" aria-label="편집완료" onClick={leaveEditMode}>편집완료</button>}
        </>}
      </main>}<SiteFooter />
    </div>
    <ManagementDialog editor={editor} groups={collection.groups} onChange={setEditor} onClose={() => { setEditor(null); setOpenMenu(null); }} onSubmit={submitEditor} />
    {shareDialog && <div className="quiz-manage-overlay quiz-share-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !shareBusy) setShareDialog(null); }}><section className="quiz-manage-dialog quiz-share-dialog" role="dialog" aria-modal="true" aria-labelledby="quiz-share-title"><header><h2 id="quiz-share-title">문제지 공유</h2><button type="button" aria-label="닫기" onClick={() => !shareBusy && setShareDialog(null)}><X size={19} /></button></header>
      <p><strong>{shareDialog.title}</strong> 문제지를 누구에게 보여줄지 정해요.</p>
      <fieldset className="quiz-share-visibility" disabled={shareBusy}>
        <legend className="mb-sr-only">공개 범위</legend>
        {[{ value: 'personal', label: '미공개', copy: '나만 볼 수 있어요. 공유 링크가 중지돼요.' }, { value: 'partial', label: '일부 공개', copy: '링크를 아는 사람만 풀 수 있어요.' }, { value: 'public', label: '공개', copy: '문제 서칭에 노출되고 누구나 풀 수 있어요.' }].map(option => <label key={option.value} className={shareDialog.visibility === option.value ? 'is-selected' : ''}>
          <input type="radio" name="quiz-share-visibility" value={option.value} checked={shareDialog.visibility === option.value} onChange={() => chooseVisibility(option.value)} />
          <span><b>{option.label}</b><small>{option.copy}</small></span>
        </label>)}
      </fieldset>
      {shareBusy ? <div className="quiz-share-loading" role="status"><span className="quiz-share-spinner" aria-hidden="true" />잠시만 기다려주세요.</div>
        : shareDialog.url && shareDialog.visibility !== 'personal' ? <><label className="quiz-share-link"><span>공유 링크</span><span className="quiz-share-link-row"><input readOnly value={shareDialog.url} onFocus={event => event.currentTarget.select()} /><button type="button" aria-label={shareCopied ? '링크 복사됨' : '공유 링크 복사'} title="링크 복사" onClick={copyShareLink}>{shareCopied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}</button></span></label><div className="quiz-share-note">문제와 정답은 링크 생성 시점의 내용으로 공유돼요.{shareDialog.visibility === 'public' ? ' 공개한 문제는 제목과 설명이 검색에 보여요.' : ''}</div></> : null}{shareError && <p className="quiz-manage-error" role="alert">{shareError}</p>}
      <footer><button type="button" disabled={shareBusy} onClick={() => setShareDialog(null)}>닫기</button><button className="is-primary" type="button" disabled={shareBusy || !shareDialog.url || shareDialog.visibility === 'personal'} onClick={shareQuizLink}><Share2 size={16} aria-hidden="true" />공유하기</button></footer></section></div>}
    {notice && <p className="quiz-library-notice" role="status">{notice}</p>}
    {undoablePaperDelete && <div className="quiz-library-undo-toast" role="status" aria-live="polite" aria-atomic="true">
      <div className="quiz-library-undo-copy"><strong>“{undoablePaperDelete.title}” 문제지가 삭제되었습니다.</strong><span>실수로 삭제하셨나요?</span></div>
      <button className="quiz-library-undo-action" type="button" onClick={undoPaperDeletion}>삭제취소</button>
      <button className="quiz-library-undo-close" type="button" aria-label="복구 안내 닫기" onClick={() => finishPaperDeletion(undoablePaperDelete.token, true)}><X size={16} aria-hidden="true" /></button>
    </div>}
  </div>;
}
createRoot(document.getElementById('root')).render(<QuizLibrary />);
