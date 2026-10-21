import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BookOpen, FolderPlus, LayoutGrid, List, MoreHorizontal, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { cachedAuthSession, getSessionSafely, loginUrl, supabase } from './supabase.js';
import { hasProfile } from './profile.js';
import { SiteFooter } from './site-footer.jsx';
import {
  DEFAULT_GROUP_ID,
  clearCustomBank,
  createCustomGroup,
  deleteCustomGroup,
  getCustomBankCollection,
  setActiveCustomBank,
  setCustomBankUser,
  updateCustomBankMeta,
  updateCustomGroup,
} from './custom-bank.js';
import { QuizAchievement } from './quiz-achievement.jsx';
import { QuizCreator } from './quiz-creator.jsx';
import { AppHeader } from './app-header.jsx';
import { FlowActionButton } from './flow-action-button.jsx';
import { BrandLogo } from './brand-logo.jsx';
import { SegmentedControl } from './segmented-control.jsx';
import './design-system.css';
import './quiz-library.css';

const papers = [
  { id: 'basics', kind: 'basics', label: 'GA4 핵심 개념', description: '이벤트부터 보고서까지, 분석의 기본기를 다져보세요.', count: 20, level: '기본', topics: '데이터 모델 · 이벤트 · 보고서', samples: [
    { title: 'GA4의 데이터 모델은 무엇인가요?', options: ['세션 기반', '페이지뷰 기반', '이벤트 기반'] },
    { title: 'DebugView를 활성화하는 방법은?', options: ['debug_mode 매개변수 설정', 'Google Analytics Debugger 사용'] },
  ] },
  { id: 'advanced', kind: 'advanced', label: 'GA4 실무 응용', description: '전자상거래와 데이터 품질, 실무에 필요한 개념을 익혀보세요.', count: 20, level: '심화', topics: '전자상거래 · 탐색 · 데이터 품질', samples: [
    { title: '전자상거래 items 배열에 포함되는 정보는?', options: ['상품 ID와 이름', '가격과 수량', '쿠폰과 할인'] },
    { title: '탐색에서 활용할 수 있는 분석 기법은?', options: ['퍼널 탐색', '경로 탐색', '코호트 탐색'] },
  ] },
  { id: 'random', kind: 'random', label: '전체 랜덤 문제지', description: '전체 문제은행에서 새로운 20문항을 만나보세요.', count: 20, level: '랜덤', topics: '전체 범위 · 매번 새로운 조합', samples: [
    { title: 'BigQuery 연결로 할 수 있는 일은?', options: ['원시 이벤트 데이터 분석', 'SQL로 데이터 조회'] },
    { title: '앱의 화면 조회에 사용하는 이벤트는?', options: ['screen_view', 'page_view', 'first_visit'] },
  ] },
];
const difficulties = ['전체 난이도', '기본', '심화'];
const difficultySegments = difficulties.map(item => ({ label: item, value: item }));
const viewSegments = [
  { value: 'grid', label: '2열 카드 보기', ariaLabel: '2열 카드 보기', icon: LayoutGrid },
  { value: 'list', label: '1열 목록 보기', ariaLabel: '1열 목록 보기', icon: List },
];
const initialSession = cachedAuthSession();
const initialUser = initialSession && hasProfile(initialSession.user) ? initialSession.user : null;
if (initialUser) {
  setCustomBankUser(initialUser.id);
  document.documentElement.removeAttribute('data-auth-pending');
}

function PaperPreview({ paper }) {
  return <div className={`paper-preview preview-${paper.kind}`} aria-hidden="true">
    <div className="preview-sheet">
      <div className="preview-sheet-brand"><BrandLogo decorative /><span>{paper.kind === 'custom' ? 'CUSTOM' : 'GA4'}</span></div>
      <div className="preview-sheet-title">{paper.label}</div>
      <div className="preview-sheet-subtitle">개념을 확인하는 작은 시작</div>
      {paper.samples.map((sample, index) => <div className="preview-question" key={`${sample.title}-${index}`}>
        <div><b>{String(index + 1).padStart(2, '0')}</b><strong>{sample.title}</strong></div>
        {sample.options.map((option, optionIndex) => <span className="preview-option" key={`${option}-${optionIndex}`}><i />{option}</span>)}
      </div>)}
    </div>
    <span className="preview-count">{paper.count}문항</span>
  </div>;
}

function sectionFromHash() {
  if (window.location.hash === '#achievement') return 'achievement';
  if (window.location.hash === '#create') return 'create';
  return 'papers';
}

function ManagementDialog({ editor, groups, onChange, onClose, onSubmit }) {
  if (!editor) return null;
  const isBank = editor.type.startsWith('bank-');
  const isDelete = editor.type.endsWith('delete');
  const title = editor.type === 'bank-edit' ? '문제지 편집' : editor.type === 'bank-delete' ? '문제지를 삭제할까요?' : editor.type === 'group-create' ? '새 그룹 만들기' : editor.type === 'group-edit' ? '그룹 이름 바꾸기' : '그룹을 삭제할까요?';
  return <div className="quiz-manage-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <form className="quiz-manage-dialog" role="dialog" aria-modal="true" aria-labelledby="quiz-manage-title" onSubmit={event => { event.preventDefault(); onSubmit(); }}>
      <header><h2 id="quiz-manage-title">{title}</h2><button type="button" aria-label="닫기" onClick={onClose}><X size={19} /></button></header>
      {isDelete ? <>
        <p><strong>{editor.title || editor.name}</strong>{isBank ? ' 문제지' : ' 그룹'}를 삭제하면 되돌릴 수 없어요.</p>
        {!isBank && <p>이 그룹의 문제지는 삭제되지 않고 ‘미분류’로 이동해요.</p>}
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
  const [section, setSection] = useState(sectionFromHash);
  const refreshCollection = () => setCollection(getCustomBankCollection());
  useEffect(() => {
    const syncSection = () => setSection(sectionFromHash());
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
    if (!editor && !openMenu) return undefined;
    const closeOnEscape = event => { if (event.key === 'Escape') { setEditor(null); setOpenMenu(null); } };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [editor, openMenu]);
  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(''), 2400);
    return () => window.clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!supabase) { window.location.replace(loginUrl()); return; }
    let alive = true;
    const accept = session => {
      if (!alive) return;
      if (!session) { window.location.replace(loginUrl()); return; }
      if (!hasProfile(session.user)) { window.location.replace(new URL('./prd.html', location.href)); return; }
      setCustomBankUser(session.user.id);
      setCollection(getCustomBankCollection(session.user.id));
      setUser(session.user);
      document.documentElement.removeAttribute('data-auth-pending');
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
  if (!user) return <div className="quiz-check" role="status" aria-label="문제지 여는 중"><span className="moonble-spinner" aria-hidden="true" /></div>;
  const customPapers = collection.banks.map(bank => ({
    id: `custom:${bank.id}`,
    customBankId: bank.id,
    groupId: bank.groupId,
    label: bank.title,
    level: '내 문제지',
    count: bank.questions.length,
    description: bank.description,
    topics: `등록 ${bank.questions.length}문항 · 매회 20문항 출제`,
    kind: 'custom',
    samples: bank.questions.slice(0, 2).map(question => ({ title: question.q, options: question.options.slice(0, 3) })),
  }));
  const allPapers = [...papers, ...customPapers];
  const search = query.trim().toLocaleLowerCase();
  const visiblePapers = allPapers.filter(paper => {
    const groupMatch = activeGroup === 'all' || (paper.kind === 'custom' && paper.groupId === activeGroup);
    const difficultyMatch = difficulty === '전체 난이도' || paper.level === difficulty;
    return groupMatch && difficultyMatch && `${paper.label} ${paper.description} ${paper.topics} ${paper.level}`.toLocaleLowerCase().includes(search);
  });
  const activeCustom = collection.banks.find(bank => bank.id === collection.activeBankId) || collection.banks[0] || null;
  const groupTabs = [
    { id: 'all', name: '전체', count: papers.length + collection.banks.length },
    { id: DEFAULT_GROUP_ID, name: '미분류', count: collection.banks.filter(bank => bank.groupId === DEFAULT_GROUP_ID).length },
    ...collection.groups.map(group => ({ ...group, count: collection.banks.filter(bank => bank.groupId === group.id).length })),
  ];
  return <div className="quiz-page" onClick={() => openMenu && setOpenMenu(null)}>
    <a className="quiz-skip" href={section === 'achievement' ? '#achievement' : section === 'create' ? '#quiz-creator' : '#paper-library'}>{section === 'achievement' ? '성취도 내용으로 건너뛰기' : section === 'create' ? '문제 생성 내용으로 건너뛰기' : '문제지 목록으로 건너뛰기'}</a>
    <AppHeader active={section} user={user} pending={pending} error={error} onLogout={logout} />
    <div className="quiz-content">
      {section === 'achievement' ? <QuizAchievement userId={user.id} /> : section === 'create' ? <QuizCreator custom={activeCustom} onChange={refreshCollection} /> : <main className="quiz-main" id="paper-library" tabIndex={-1}>
        <div className="quiz-title"><div><h1 className="mb-page-title">문제지</h1><p>오늘은 어떤 개념을 익혀볼까요?</p></div><FlowActionButton className="quiz-create-button" aria-label="새 문제지 만들기" onClick={() => { window.location.hash = 'create'; }}><Plus size={18} aria-hidden="true" /><span>새 문제지<span className="quiz-create-optional"> 만들기</span></span></FlowActionButton></div>
        <div className="paper-group-bar">
          <div className="paper-group-tabs" role="tablist" aria-label="문제지 그룹">
            {groupTabs.map(group => <span className={`paper-group-tab${activeGroup === group.id ? ' is-active' : ''}`} key={group.id}>
              <button type="button" role="tab" aria-selected={activeGroup === group.id} onClick={event => { event.stopPropagation(); setActiveGroup(group.id); setOpenMenu(null); }}>{group.name}<small>{group.count}</small></button>
              {group.id !== 'all' && group.id !== DEFAULT_GROUP_ID && <button className="paper-group-more" type="button" aria-label={`${group.name} 그룹 더보기`} aria-haspopup="menu" aria-expanded={openMenu === `group:${group.id}`} onClick={event => { event.stopPropagation(); setOpenMenu(openMenu === `group:${group.id}` ? null : `group:${group.id}`); }}><MoreHorizontal size={16} /></button>}
              {openMenu === `group:${group.id}` && <span className="paper-action-menu" role="menu" onClick={event => event.stopPropagation()}><button type="button" role="menuitem" onClick={() => setEditor({ type: 'group-edit', groupId: group.id, name: group.name })}><Pencil size={15} />이름 바꾸기</button><button className="is-danger" type="button" role="menuitem" onClick={() => setEditor({ type: 'group-delete', groupId: group.id, name: group.name })}><Trash2 size={15} />삭제하기</button></span>}
            </span>)}
          </div>
          <button className="paper-group-add" type="button" onClick={event => { event.stopPropagation(); setEditor({ type: 'group-create', name: '' }); }}><FolderPlus size={16} />그룹 추가</button>
        </div>
        <div className="quiz-library-tools">
          <div className="quiz-filter-groups"><SegmentedControl className="quiz-difficulties" ariaLabel="난이도" items={difficultySegments} value={difficulty} onChange={setDifficulty} /></div>
          <div className="quiz-display-tools">
            <label className="quiz-search"><Search size={18} aria-hidden="true" /><span className="mb-sr-only">문제지 검색</span><input type="search" placeholder="문제지 검색" value={query} onChange={event => setQuery(event.target.value)} /></label>
            <SegmentedControl className="quiz-view-toggle" ariaLabel="보기 방식" iconOnly items={viewSegments} value={view} onChange={setView} />
          </div>
        </div>
        <div className="quiz-results"><p role="status">문제지 <strong>{visiblePapers.length}</strong></p><span>문제지를 선택하면 풀이가 시작돼요</span></div>
        <section className={`paper-grid${view === 'list' ? ' paper-list' : ''}`} aria-label="문제지 목록">
          {visiblePapers.map(paper => {
            const href = paper.customBankId ? `./solve.html?paper=custom&bank=${encodeURIComponent(paper.customBankId)}#quiz` : `./solve.html?paper=${paper.id}#quiz`;
            return <article className="paper-card" key={paper.id}>
              <a className="paper-card-link" href={href} aria-label={`${paper.label} · ${paper.count}문항 문제 풀기`} onClick={() => { if (paper.customBankId) setActiveCustomBank(paper.customBankId); }}>
                <PaperPreview paper={paper} />
                <div className="paper-info"><span className={`paper-file-icon icon-${paper.kind}`} aria-hidden="true"><BookOpen size={15} /></span><div className="paper-copy"><h2 className="mb-card-title">{paper.label}</h2><p><span>{paper.level}</span><i aria-hidden="true">·</i><span className="paper-description">{paper.description}</span></p></div></div>
              </a>
              {paper.customBankId && <div className="paper-card-actions">
                <button type="button" aria-label={`${paper.label} 편집 메뉴`} aria-haspopup="menu" aria-expanded={openMenu === `bank:${paper.customBankId}`} onClick={event => { event.stopPropagation(); setOpenMenu(openMenu === `bank:${paper.customBankId}` ? null : `bank:${paper.customBankId}`); }}><MoreHorizontal size={18} /></button>
                {openMenu === `bank:${paper.customBankId}` && <div className="paper-action-menu" role="menu" onClick={event => event.stopPropagation()}><button type="button" role="menuitem" onClick={() => setEditor({ type: 'bank-edit', bankId: paper.customBankId, title: paper.label, description: paper.description, groupId: paper.groupId })}><Pencil size={15} />편집</button><button className="is-danger" type="button" role="menuitem" onClick={() => setEditor({ type: 'bank-delete', bankId: paper.customBankId, title: paper.label })}><Trash2 size={15} />삭제</button></div>}
              </div>}
            </article>;
          })}
        </section>
        {!visiblePapers.length && <div className="quiz-empty"><Search size={28} aria-hidden="true" /><h2 className="mb-card-title">이 그룹에 문제지가 없어요</h2><p>새 문제지를 만들거나 다른 그룹을 선택해보세요.</p><button onClick={() => { setQuery(''); setDifficulty('전체 난이도'); setActiveGroup('all'); }}>전체 문제지 보기</button></div>}
      </main>}<SiteFooter />
    </div>
    <ManagementDialog editor={editor} groups={collection.groups} onChange={setEditor} onClose={() => { setEditor(null); setOpenMenu(null); }} onSubmit={submitEditor} />
    {notice && <p className="quiz-library-notice" role="status">{notice}</p>}
  </div>;
}
createRoot(document.getElementById('root')).render(<QuizLibrary />);
