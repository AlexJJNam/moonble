import React, { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowRight, BarChart3, BookOpen, Check, ChevronLeft, FileText, Link, Plus, Upload } from 'lucide-react';
import { hasProfile } from './profile.js';
import { cachedAuthSession, getSessionSafely, supabase } from './supabase.js';
import { SiteFooter } from './site-footer.jsx';
import './design-system.css';
import './landing.css';

function moveTo(path) {
  window.location.replace(new URL(path, window.location.href));
}

function ProductPreview() {
  return <div className="landing-preview" role="img" aria-label="문제지와 성취도, PRD 메뉴가 있는 Moonble 워크스페이스 미리보기">
    <aside className="landing-preview-sidebar">
      <strong>moonble</strong>
      <div className="landing-preview-profile"><span>김</span><i /><i /></div>
      <nav aria-label="미리보기 메뉴">
        <b><BookOpen size={15} aria-hidden="true" />문제지</b>
        <span><BarChart3 size={15} aria-hidden="true" />나의 성취도</span>
        <span><FileText size={15} aria-hidden="true" />PRD</span>
      </nav>
    </aside>
    <div className="landing-preview-content">
      <div className="landing-preview-heading"><div><small>내 워크스페이스</small><h2>문제지</h2></div><span>새 문제지 만들기</span></div>
      <div className="landing-preview-tabs"><b>전체</b><span>내 문제지</span><span>기본</span><span>심화</span></div>
      <div className="landing-preview-grid">
        <article><div className="landing-preview-sheet"><i>01</i><i>02</i><i>03</i></div><small>기본 · 20문항</small><strong>GA4 핵심 개념</strong><p>이벤트부터 보고서까지 분석의 기본기를 익혀요.</p></article>
        <article><div className="landing-preview-sheet is-blue"><i>01</i><i>02</i><i>03</i></div><small>심화 · 20문항</small><strong>GA4 실무 응용</strong><p>전자상거래와 데이터 품질을 점검해요.</p></article>
        <article><div className="landing-preview-sheet is-mint"><i>01</i><i>02</i><i>03</i></div><small>랜덤 · 20문항</small><strong>전체 랜덤 문제지</strong><p>매번 새로운 조합으로 실력을 확인해요.</p></article>
      </div>
    </div>
  </div>;
}

const features = [
  { icon: BookOpen, eyebrow: '문제지', title: '직접 만들고 바로 풉니다', copy: '기본 문제지와 직접 등록한 문제지를 한곳에서 관리하고, 필요한 순간 바로 풀이를 시작합니다.' },
  { icon: BarChart3, eyebrow: '성취도', title: '변화를 기록으로 확인합니다', copy: '회차별 점수와 단기·장기 추세를 함께 비교해 최근의 학습 흐름을 확인합니다.' },
  { icon: FileText, eyebrow: 'PRD', title: '배운 내용을 문서로 남깁니다', copy: '문제를 풀며 떠오른 생각을 PRD로 정리해 학습 기록을 실제 기획 작업으로 연결합니다.' },
];

const clamp = value => Math.min(1, Math.max(0, value));
const smooth = value => {
  const progress = clamp(value);
  return progress * progress * (3 - 2 * progress);
};

function ScrollStory() {
  const sectionRef = useRef(null);
  const stickyRef = useRef(null);

  useEffect(() => {
    const section = sectionRef.current;
    const sticky = stickyRef.current;
    if (!section || !sticky) return undefined;
    let frame = 0;
    let currentProgress = 0;
    let targetProgress = 0;
    let previousTime = 0;

    const render = progress => {
      const registered = smooth(progress / .14);
      const registerExit = smooth((progress - .14) / .12);
      const libraryIn = smooth((progress - .12) / .12);
      const select = smooth((progress - .22) / .14);
      const libraryExit = smooth((progress - .38) / .14);
      const grade = smooth((progress - .36) / .18);
      const graded = smooth((progress - .52) / .14);
      const gradeExit = smooth((progress - .68) / .13);
      const stats = smooth((progress - .7) / .22);
      const step = progress < .19 ? 1 : progress < .43 ? 2 : progress < .71 ? 3 : 4;

      sticky.dataset.step = String(step);
      sticky.style.setProperty('--story-register', registered.toFixed(3));
      sticky.style.setProperty('--story-register-opacity', (1 - registerExit).toFixed(3));
      sticky.style.setProperty('--story-register-y', `${Math.round(-18 * registerExit)}px`);
      sticky.style.setProperty('--story-select', select.toFixed(3));
      sticky.style.setProperty('--story-select-opacity', (libraryIn * (1 - libraryExit)).toFixed(3));
      sticky.style.setProperty('--story-select-x', `${Math.round((1 - libraryIn) * 38 - libraryExit * 18)}px`);
      sticky.style.setProperty('--story-grade', grade.toFixed(3));
      sticky.style.setProperty('--story-graded', graded.toFixed(3));
      sticky.style.setProperty('--story-grade-opacity', (grade * (1 - gradeExit)).toFixed(3));
      sticky.style.setProperty('--story-grade-x', `${Math.round((1 - grade) * 38 - gradeExit * 18)}px`);
      sticky.style.setProperty('--story-stats', stats.toFixed(3));
      sticky.style.setProperty('--story-stats-x', `${Math.round((1 - stats) * 42)}px`);
      sticky.style.setProperty('--story-line-offset', String(Math.round((1 - stats) * 360)));
    };

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const readProgress = () => {
      const bounds = section.getBoundingClientRect();
      const travel = Math.max(section.offsetHeight - window.innerHeight, 1);
      const stickyTop = window.innerWidth <= 767 ? 66 : 72;
      return clamp((stickyTop - bounds.top) / travel);
    };

    const animate = time => {
      const elapsed = previousTime ? Math.min(time - previousTime, 50) : 16;
      previousTime = time;
      const blend = 1 - Math.exp(-elapsed / 180);
      currentProgress += (targetProgress - currentProgress) * blend;

      if (Math.abs(targetProgress - currentProgress) < .0005) currentProgress = targetProgress;
      render(currentProgress);

      if (currentProgress === targetProgress) {
        frame = 0;
        previousTime = 0;
      } else frame = window.requestAnimationFrame(animate);
    };

    const requestUpdate = () => {
      if (reducedMotion.matches) { render(1); return; }
      targetProgress = readProgress();
      if (!frame) frame = window.requestAnimationFrame(animate);
    };
    const handleMotionChange = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      previousTime = 0;
      currentProgress = readProgress();
      targetProgress = currentProgress;
      render(reducedMotion.matches ? 1 : currentProgress);
    };

    currentProgress = readProgress();
    targetProgress = currentProgress;
    render(reducedMotion.matches ? 1 : currentProgress);
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);
    reducedMotion.addEventListener?.('change', handleMotionChange);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', requestUpdate);
      window.removeEventListener('resize', requestUpdate);
      reducedMotion.removeEventListener?.('change', handleMotionChange);
    };
  }, []);

  return <section className="landing-story" id="workflow" ref={sectionRef} aria-labelledby="workflow-title">
    <div className="landing-story-sticky" ref={stickyRef} data-step="1">
      <div className="landing-story-copy">
        <span className="landing-eyebrow">시작하는 방법</span>
        <h2 id="workflow-title">등록하고, 풀고,<br />기록을 확인합니다</h2>
        <p>문제지를 등록한 뒤 바로 풀고, 채점 결과와 기록을 한 흐름에서 확인합니다.</p>
        <ol className="landing-story-nav" aria-label="Moonble 학습 흐름">
          <li><b>01</b><span><strong>문제지 등록</strong><small>내 문제를 가져와요</small></span></li>
          <li><b>02</b><span><strong>문제지 선택</strong><small>오늘 풀 문제를 골라요</small></span></li>
          <li><b>03</b><span><strong>풀이와 채점</strong><small>답을 고르고 바로 확인해요</small></span></li>
          <li><b>04</b><span><strong>성취도 확인</strong><small>기록에서 성장 흐름을 봐요</small></span></li>
        </ol>
        <a href="./login.html">내 워크스페이스 열기<ArrowRight size={18} aria-hidden="true" /></a>
      </div>

      <div className="landing-story-demo" role="img" aria-label="문제지를 등록하고 선택한 뒤 문제를 채점하고 성취도 통계를 확인하는 Moonble 화면 애니메이션">
        <div className="story-window">
          <aside className="story-app-sidebar" aria-hidden="true">
            <strong className="story-app-logo">moonble</strong>
            <div className="story-app-profile"><i>김</i><span><b>남제정</b><small>개인 워크스페이스</small></span></div>
            <nav className="story-app-menu">
              <span className="story-app-papers"><BookOpen size={15} />문제지</span>
              <span className="story-app-achievement"><BarChart3 size={15} />나의 성취도</span>
              <span><FileText size={15} />PRD</span>
            </nav>
            <div className="story-question-menu">
              <span><ChevronLeft size={15} />문제지</span>
              <strong>문제 목록</strong>
              <ol>{[1, 2, 3, 4, 5].map(number => <li className={number === 2 ? 'is-current' : number === 1 ? 'is-done' : ''} key={number}>{number}</li>)}</ol>
            </div>
          </aside>
          <div className="story-app-main">
            <div className="story-app-topbar" aria-hidden="true"><span>내 워크스페이스</span><i>김</i></div>

            <div className="story-screen story-register-screen">
              <header><div><small>내 문제지</small><strong>문제지 등록</strong></div><span>최소 20문항</span></header>
              <article className="story-register-card">
                <div className="story-register-copy"><strong>내 문제를 Moonble로 가져오세요</strong><p>CSV 파일이나 Google Sheets 공유 링크로 간단히 등록할 수 있어요.</p></div>
                <div className="story-register-drop"><Upload size={22} aria-hidden="true" /><b>CSV 파일 선택</b><small>파일을 끌어다 놓아도 돼요</small><em><Check size={12} aria-hidden="true" />20문항 확인</em></div>
                <div className="story-register-divider">또는</div>
                <div className="story-register-link"><Link size={15} aria-hidden="true" /><span>Google Sheets 공유 링크</span><span className="story-demo-action">가져오기</span></div>
              </article>
            </div>

            <div className="story-screen story-library-screen">
              <header><div><strong>문제지</strong><small>오늘은 어떤 개념을 익혀볼까요?</small></div><span className="story-demo-action"><Plus size={13} />새 문제지 만들기</span></header>
              <div className="story-filter-row"><b>전체</b><span>기본 제공</span><span>내 문제지</span><i /> <span>전체 난이도</span><span>기본</span><span>심화</span></div>
              <div className="story-paper-grid">
                <article className="story-paper-picked">
                  <div className="story-paper-preview"><div className="story-preview-sheet"><small><b>moonble</b><em>GA4</em></small><strong>GA4 핵심 개념</strong><i /><i /><i /></div><b><Check size={13} aria-hidden="true" />선택됨</b></div>
                  <span><b>기본</b> · 20문항</span><strong>GA4 핵심 개념</strong><p>이벤트부터 보고서까지, 분석의 기본기를 다져보세요.</p>
                </article>
                <article>
                  <div className="story-paper-preview is-advanced"><div className="story-preview-sheet"><small><b>moonble</b><em>GA4</em></small><strong>GA4 실무 응용</strong><i /><i /><i /></div></div>
                  <span><b>심화</b> · 20문항</span><strong>GA4 실무 응용</strong><p>전자상거래와 데이터 품질, 실무 개념을 익혀보세요.</p>
                </article>
              </div>
            </div>

            <div className="story-screen story-question-screen">
              <header><div><small>GA4 핵심 개념</small><strong>문제 풀이</strong></div><span>2 / 20</span></header>
              <article className="story-question-card"><div className="story-question-title"><b>Q2</b><span>단일 선택</span></div>
                <p className="story-question">GA4에서 사용자 행동을 수집하는 기본 단위는 무엇인가요?</p>
                <div className="story-options">
                  <div className="story-option story-option-wrong"><i />세션<b>×</b></div>
                  <div className="story-option story-option-correct"><i />이벤트<b>○</b></div>
                  <div className="story-option"><i />사용자 속성</div>
                </div>
                <div className="story-grade-message"><Check size={17} aria-hidden="true" /><span><strong>채점 완료</strong>정답과 해설을 확인했어요.</span></div>
              </article>
            </div>

            <div className="story-screen story-stats-screen">
              <header><div><small>학습 리포트</small><strong>나의 성취도</strong></div><span>CSV 내보내기</span></header>
              <div className="story-performance"><h3>학습 실적</h3><div className="story-score-row"><div><small>최근 풀이</small><strong>오늘</strong><em>6회 완료</em></div><div><small>최근 점수</small><strong>82<em>점</em></strong></div><div><small>평균 점수</small><strong>68<em>점</em></strong></div><div><small>최고 점수</small><strong>92<em>점</em></strong></div></div></div>
              <div className="story-chart-heading"><div><strong>실력 추세</strong><small>최근 3회 평균이 장기 추세보다 6점 높아요.</small></div><p><span><i className="score" />회차 점수</span><span><i className="recent" />최근 3회</span><span><i className="long" />최근 10회</span></p></div>
              <div className="story-chart">
                <div className="story-chart-grid"><i /><i /><i /></div>
                <div className="story-bars">{['38%', '47%', '45%', '59%', '68%', '82%'].map(height => <i key={height} style={{ '--bar-height': height }} />)}</div>
                <svg viewBox="0 0 360 140" preserveAspectRatio="none" aria-hidden="true"><path className="story-line-long" d="M12 105 C54 101 78 98 105 93 S166 82 192 73 S251 61 283 49 S326 38 348 31" /><path className="story-line-recent" d="M12 112 C52 104 62 92 84 96 S132 92 152 79 S199 72 220 55 S270 55 292 35 S330 29 348 19" /></svg>
              </div>
              <p className="story-insight"><b>최근 실력이 빠르게 오르고 있어요.</b><span>다음에는 심화 문제지에 도전해보세요.</span></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>;
}

function Landing() {
  useEffect(() => {
    if (!supabase) return undefined;
    let alive = true;
    let moving = false;

    function accept(session) {
      if (!alive || moving) return;
      if (!session) return;
      moving = true;
      moveTo(hasProfile(session.user) ? './quiz.html' : './prd.html#/register-name');
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => accept(session));
    getSessionSafely().then(({ session }) => accept(session));

    return () => { alive = false; subscription.unsubscribe(); };
  }, []);

  return <>
    <header className="landing-header">
      <a className="landing-logo" href="./" aria-label="Moonble 홈">moonble</a>
      <nav aria-label="소개 페이지 탐색"><a href="#features">기능</a><a href="#workflow">사용 방법</a></nav>
      <a className="landing-login" href="./login.html">로그인</a>
    </header>
    <main>
      <section className="landing-hero">
        <div className="landing-hero-glow landing-hero-glow-one" aria-hidden="true" />
        <div className="landing-hero-glow landing-hero-glow-two" aria-hidden="true" />
        <div className="landing-hero-copy">
          <span className="landing-eyebrow">기획자를 위한 워크스페이스</span>
          <h1>배운 것을 쌓고,<br /><em>생각을 기획으로.</em></h1>
          <p>문제를 풀며 익힌 내용을 기록하고, 떠오른 아이디어를 PRD로 정리하세요.<br className="landing-desktop-break" /> Moonble은 학습과 기획을 한 흐름으로 이어주는 개인 워크스페이스입니다.</p>
          <div className="landing-actions"><a className="landing-primary" href="./login.html">무료로 시작하기<ArrowRight size={18} aria-hidden="true" /></a><a className="landing-secondary" href="#features">Moonble 살펴보기</a></div>
          <ul aria-label="Moonble 이용 특징"><li><Check size={15} aria-hidden="true" />설치 없이 바로 시작</li><li><Check size={15} aria-hidden="true" />개인 학습 기록 저장</li></ul>
        </div>
        <ProductPreview />
      </section>

      <section className="landing-features" id="features" aria-labelledby="features-title">
        <div className="landing-section-heading"><span>워크스페이스 구성</span><h2 id="features-title">문제풀이부터 PRD까지,<br />한곳에서 관리합니다</h2><p>학습과 기획에 필요한 세 가지 기능을 같은 구조 안에 담았습니다.</p></div>
        <div className="landing-feature-grid">{features.map(({ icon: Icon, eyebrow, title, copy }) => <article key={eyebrow}>
          <div className="landing-feature-icon"><Icon size={22} aria-hidden="true" /></div>
          <span>{eyebrow}</span><div><h3>{title}</h3><p>{copy}</p></div>
        </article>)}</div>
      </section>

      <ScrollStory />

      <section className="landing-cta"><div><p>Moonble을 시작할 준비가 되셨나요?</p><h2>다음 문제지부터<br />한곳에 기록하세요.</h2></div><a href="./login.html">Moonble 시작하기<ArrowRight size={18} aria-hidden="true" /></a></section>
    </main>
    <SiteFooter />
  </>;
}

const initialSession = cachedAuthSession();
if (initialSession) moveTo(hasProfile(initialSession.user) ? './quiz.html' : './prd.html#/register-name');
else createRoot(document.getElementById('root')).render(<Landing />);
