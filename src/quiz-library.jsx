import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowRight, BookOpen, FileText, LayoutGrid, List, LogOut, Search, Settings2 } from 'lucide-react';
import { loginUrl, supabase } from './supabase.js';
import { hasProfile, profileOf } from './profile.js';
import './design-system.css';
import './quiz-library.css';

const papers = [
  { id: 'basics', label: 'GA4 핵심 개념', description: '이벤트부터 보고서까지, 분석의 기본기를 다져보세요.', count: 20, level: '기본', topics: '데이터 모델 · 이벤트 · 보고서', samples: [
    { title: 'GA4의 데이터 모델은 무엇인가요?', options: ['세션 기반', '페이지뷰 기반', '이벤트 기반'] },
    { title: 'DebugView를 활성화하는 방법은?', options: ['debug_mode 매개변수 설정', 'Google Analytics Debugger 사용'] },
  ] },
  { id: 'advanced', label: 'GA4 실무 응용', description: '전자상거래와 데이터 품질, 실무에 필요한 개념을 익혀보세요.', count: 20, level: '심화', topics: '전자상거래 · 탐색 · 데이터 품질', samples: [
    { title: '전자상거래 items 배열에 포함되는 정보는?', options: ['상품 ID와 이름', '가격과 수량', '쿠폰과 할인'] },
    { title: '탐색에서 활용할 수 있는 분석 기법은?', options: ['퍼널 탐색', '경로 탐색', '코호트 탐색'] },
  ] },
  { id: 'random', label: '전체 랜덤 문제지', description: '전체 문제은행에서 새로운 20문항을 만나보세요.', count: 20, level: '랜덤', topics: '전체 범위 · 매번 새로운 조합', samples: [
    { title: 'BigQuery 연결로 할 수 있는 일은?', options: ['원시 이벤트 데이터 분석', 'SQL로 데이터 조회'] },
    { title: '앱의 화면 조회에 사용하는 이벤트는?', options: ['screen_view', 'page_view', 'first_visit'] },
  ] },
];
const filters = ['전체', '기본', '심화', '랜덤'];

function PaperPreview({ paper }) {
  return <div className={`paper-preview preview-${paper.id}`} aria-hidden="true">
    <div className="preview-sheet">
      <div className="preview-sheet-brand"><span>moonble</span><span>GA4</span></div>
      <div className="preview-sheet-title">{paper.label}</div>
      <div className="preview-sheet-subtitle">개념을 확인하는 작은 시작</div>
      {paper.samples.map((sample, index) => <div className="preview-question" key={sample.title}>
        <div><b>{String(index + 1).padStart(2, '0')}</b><strong>{sample.title}</strong></div>
        {sample.options.map(option => <span className="preview-option" key={option}><i />{option}</span>)}
      </div>)}
    </div>
    <span className="preview-tag">미리보기</span>
    <span className="preview-open"><ArrowRight size={18} /></span>
  </div>;
}

function QuizLibrary() {
  const [user, setUser] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('전체');
  const [view, setView] = useState('grid');
  useEffect(() => {
    if (!supabase) { window.location.replace(loginUrl()); return; }
    let alive = true;
    const accept = session => {
      if (!alive) return;
      if (!session) { window.location.replace(loginUrl()); return; }
      if (!hasProfile(session.user)) { window.location.replace(new URL('./prd.html', location.href)); return; }
      setUser(session.user);
      document.documentElement.removeAttribute('data-auth-pending');
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => accept(session));
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) { if (alive) window.location.replace(loginUrl()); return; }
      accept(data.session);
    }).catch(() => { if (alive) window.location.replace(loginUrl()); });
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
  if (!user) return <div className="quiz-check" role="status"><span className="moonble-spinner" aria-hidden="true" /><span className="mb-sr-only">로그인 상태 확인 중</span></div>;
  const profile = profileOf(user);
  const search = query.trim().toLocaleLowerCase();
  const visiblePapers = papers.filter(paper => (filter === '전체' || paper.level === filter) && `${paper.label} ${paper.description} ${paper.topics} ${paper.level}`.toLocaleLowerCase().includes(search));
  return <div className="quiz-workspace">
    <a className="quiz-skip" href="#paper-library">문제지 목록으로 건너뛰기</a>
    <aside className="quiz-sidebar">
      <a className="quiz-logo" href="./prd.html" aria-label="Moonble PRD 홈">moonble</a>
      <div className="quiz-workspace-label">워크스페이스</div>
      <nav className="quiz-navigation" aria-label="주 메뉴">
        <a href="./prd.html"><FileText size={20} />PRD</a>
        <a href="./quiz.html" aria-current="page"><BookOpen size={20} />문제풀이</a>
      </nav>
      <div className="quiz-sidebar-note"><BookOpen size={20} /><strong>하나씩 풀며 쌓는 실력</strong><p>부담 없이 시작하고,<br />틀린 문제는 다시 살펴보세요.</p></div>
      <div className="quiz-account">
        <a className="quiz-profile" href="./prd.html#/my-page" aria-label="내 정보 수정"><span className="quiz-avatar">{profile.name.slice(0, 1)}</span><span><strong>{profile.name}님</strong><small>{profile.companyName}</small></span><Settings2 size={16} /></a>
        <button disabled={pending} aria-label={pending ? '로그아웃 처리 중' : undefined} onClick={logout}>{pending ? <span className="moonble-spinner" aria-hidden="true" /> : <><LogOut size={16} />로그아웃</>}</button>
        {error && <p className="quiz-error" role="alert">{error}</p>}
      </div>
    </aside>
    <div className="quiz-content">
      <header className="quiz-topbar"><span>문제풀이</span><span className="quiz-topbar-caption">배우고, 풀고, 내 것으로</span></header>
      <main className="quiz-main" id="paper-library" tabIndex={-1}>
        <div className="quiz-title"><div><h1 className="mb-page-title">나의 문제지</h1><p>오늘은 어떤 개념을 익혀볼까요?</p></div><span className="quiz-subject">Google Analytics 4</span></div>
        <div className="quiz-library-tools">
          <div className="quiz-filters" role="group" aria-label="문제지 분류">{filters.map(item => <button key={item} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item}</button>)}</div>
          <div className="quiz-display-tools">
            <label className="quiz-search"><Search size={18} aria-hidden="true" /><span className="mb-sr-only">문제지 검색</span><input type="search" placeholder="문제지 검색" value={query} onChange={event => setQuery(event.target.value)} /></label>
            <div className="quiz-view-toggle" role="group" aria-label="보기 방식"><button aria-label="카드 보기" aria-pressed={view === 'grid'} onClick={() => setView('grid')}><LayoutGrid size={18} /></button><button aria-label="목록 보기" aria-pressed={view === 'list'} onClick={() => setView('list')}><List size={18} /></button></div>
          </div>
        </div>
        <div className="quiz-results"><p role="status">{filter === '전체' ? '전체 문제지' : `${filter} 문제지`} <strong>{visiblePapers.length}</strong></p><span>문제지를 선택하면 풀이가 시작돼요</span></div>
        <section className={`paper-grid${view === 'list' ? ' paper-list' : ''}`} aria-label="문제지 목록">
          {visiblePapers.map(paper => <a className="paper-card" key={paper.id} href={`./index.html?view=quiz&paper=${paper.id}#quiz`} aria-label={`${paper.label} · ${paper.count}문항 문제 풀기`}>
            <PaperPreview paper={paper} />
            <div className="paper-info"><div className="paper-meta"><span className={`paper-badge badge-${paper.id}`}>{paper.level}</span><span>{paper.count}문항</span></div><h2 className="mb-card-title">{paper.label}</h2><p>{paper.description}</p><div className="paper-footer"><span>{paper.topics}</span><ArrowRight size={16} aria-hidden="true" /></div></div>
          </a>)}
        </section>
        {!visiblePapers.length && <div className="quiz-empty"><Search size={28} aria-hidden="true" /><h2 className="mb-card-title">검색 결과가 없어요</h2><p>다른 검색어나 분류로 찾아보세요.</p><button onClick={() => { setQuery(''); setFilter('전체'); }}>전체 문제지 보기</button></div>}
        <p className="quiz-library-note">미리보기는 예시 문항이에요. 풀이를 시작하면 선택한 범위에서 20문항이 출제됩니다.</p>
      </main>
    </div>
  </div>;
}
createRoot(document.getElementById('root')).render(<QuizLibrary />);
