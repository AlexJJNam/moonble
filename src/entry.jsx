import React, { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowRight, BarChart3, BookOpen, Check, FileText } from 'lucide-react';
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
  { icon: BookOpen, eyebrow: '문제지', title: '필요한 문제를 바로 풀어요', copy: '기본 문제지부터 직접 만든 문제지까지 한곳에서 고르고, 흐름을 끊지 않고 풀어보세요.' },
  { icon: BarChart3, eyebrow: '성취도', title: '점수보다 변화의 흐름을 봐요', copy: '회차별 점수와 단기·장기 추세를 함께 보며 최근에 달라진 실력을 확인하세요.' },
  { icon: FileText, eyebrow: 'PRD', title: '배운 내용을 기획으로 남겨요', copy: '떠오른 아이디어를 PRD로 정리하고 학습과 기획을 같은 워크스페이스에서 이어가세요.' },
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

    const render = progress => {
      const select = smooth(progress / .22);
      const selectExit = smooth((progress - .27) / .13);
      const grade = smooth((progress - .25) / .18);
      const graded = smooth((progress - .43) / .14);
      const gradeExit = smooth((progress - .62) / .13);
      const stats = smooth((progress - .64) / .22);
      const step = progress < .31 ? 1 : progress < .66 ? 2 : 3;

      sticky.dataset.step = String(step);
      sticky.style.setProperty('--story-select', select.toFixed(3));
      sticky.style.setProperty('--story-select-opacity', (1 - selectExit).toFixed(3));
      sticky.style.setProperty('--story-select-y', `${Math.round(-18 * selectExit)}px`);
      sticky.style.setProperty('--story-grade', grade.toFixed(3));
      sticky.style.setProperty('--story-graded', graded.toFixed(3));
      sticky.style.setProperty('--story-grade-opacity', (grade * (1 - gradeExit)).toFixed(3));
      sticky.style.setProperty('--story-grade-x', `${Math.round((1 - grade) * 38 - gradeExit * 18)}px`);
      sticky.style.setProperty('--story-stats', stats.toFixed(3));
      sticky.style.setProperty('--story-stats-x', `${Math.round((1 - stats) * 42)}px`);
      sticky.style.setProperty('--story-line-offset', String(Math.round((1 - stats) * 360)));
    };

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      frame = 0;
      if (reducedMotion.matches) { render(1); return; }
      const bounds = section.getBoundingClientRect();
      const travel = Math.max(section.offsetHeight - window.innerHeight, 1);
      render(clamp((72 - bounds.top) / travel));
    };
    const requestUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);
    reducedMotion.addEventListener?.('change', requestUpdate);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', requestUpdate);
      window.removeEventListener('resize', requestUpdate);
      reducedMotion.removeEventListener?.('change', requestUpdate);
    };
  }, []);

  return <section className="landing-story" id="workflow" ref={sectionRef} aria-labelledby="workflow-title">
    <div className="landing-story-sticky" ref={stickyRef} data-step="1">
      <div className="landing-story-copy">
        <span className="landing-eyebrow">시작하는 방법</span>
        <h2 id="workflow-title">고르고, 풀고,<br />성장을 확인하세요</h2>
        <p>문제지를 고르고 집중해서 푼 다음, 채점 결과와 기록을 보며 다음 행동을 정하세요.</p>
        <ol className="landing-story-nav" aria-label="Moonble 학습 흐름">
          <li><b>01</b><span><strong>문제지 선택</strong><small>오늘 풀 문제를 골라요</small></span></li>
          <li><b>02</b><span><strong>풀이와 채점</strong><small>답을 고르고 바로 확인해요</small></span></li>
          <li><b>03</b><span><strong>성취도 확인</strong><small>기록에서 성장 흐름을 봐요</small></span></li>
        </ol>
        <a href="./login.html">내 워크스페이스 열기<ArrowRight size={18} aria-hidden="true" /></a>
      </div>

      <div className="landing-story-demo" role="img" aria-label="문제지를 선택하고 문제를 채점한 뒤 성취도 통계를 확인하는 Moonble 화면 애니메이션">
        <div className="story-window">
          <div className="story-window-bar" aria-hidden="true"><i /><i /><i /><span>moonble</span></div>

          <div className="story-screen story-library-screen">
            <header><div><small>내 워크스페이스</small><strong>문제지</strong></div><span>3개의 문제지</span></header>
            <div className="story-paper-grid">
              <article className="story-paper-picked"><span>기본 · 20문항</span><strong>GA4 핵심 개념</strong><p>분석의 기본기를 차근차근 익혀요.</p><b><Check size={15} aria-hidden="true" />선택됨</b></article>
              <article><span>심화 · 20문항</span><strong>GA4 실무 응용</strong><p>실무 데이터 품질을 점검해요.</p></article>
            </div>
          </div>

          <div className="story-screen story-question-screen">
            <header><div><small>GA4 핵심 개념</small><strong>문제 2</strong></div><span>2 / 20</span></header>
            <p className="story-question">GA4에서 사용자 행동을 수집하는 기본 단위는 무엇인가요?</p>
            <div className="story-options">
              <div className="story-option story-option-wrong"><i />세션<b>×</b></div>
              <div className="story-option story-option-correct"><i />이벤트<b>○</b></div>
              <div className="story-option"><i />사용자 속성</div>
            </div>
            <div className="story-grade-message"><Check size={17} aria-hidden="true" /><span><strong>채점 완료</strong>정답과 해설을 확인했어요.</span></div>
          </div>

          <div className="story-screen story-stats-screen">
            <header><div><small>학습 기록</small><strong>나의 성취도</strong></div><span>최근 6회</span></header>
            <div className="story-score-row"><div><small>최근 점수</small><strong>82점</strong></div><div><small>지난 회차 대비</small><strong>+14</strong></div><div><small>정답률</small><strong>82%</strong></div></div>
            <div className="story-chart">
              <div className="story-chart-grid"><i /><i /><i /></div>
              <div className="story-bars">{['38%', '47%', '45%', '59%', '68%', '82%'].map(height => <i key={height} style={{ '--bar-height': height }} />)}</div>
              <svg viewBox="0 0 360 140" preserveAspectRatio="none" aria-hidden="true"><path d="M12 112 C52 104 62 92 84 96 S132 92 152 79 S199 72 220 55 S270 55 292 35 S330 29 348 19" /></svg>
            </div>
            <p className="story-insight"><b>최근 실력이 빠르게 오르고 있어요.</b><span>다음에는 심화 문제지에 도전해보세요.</span></p>
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
        <div className="landing-section-heading"><span>하나의 워크스페이스</span><h2 id="features-title">배움과 기획이<br />자연스럽게 이어져요</h2><p>필요한 기능만 단순하게 연결해, 메뉴를 찾는 시간보다 실제 학습과 작업에 집중할 수 있어요.</p></div>
        <div className="landing-feature-grid">{features.map(({ icon: Icon, eyebrow, title, copy }, index) => <article key={eyebrow}>
          <div className="landing-feature-top"><div className="landing-feature-icon"><Icon size={22} aria-hidden="true" /></div><b>0{index + 1}</b></div>
          <span>{eyebrow}</span><h3>{title}</h3><p>{copy}</p>
        </article>)}</div>
      </section>

      <ScrollStory />

      <section className="landing-cta"><p>나만의 학습과 기획 흐름을 시작해보세요.</p><h2>오늘 배운 것을<br />내일의 기획으로</h2><a href="./login.html">Moonble 시작하기<ArrowRight size={18} aria-hidden="true" /></a></section>
    </main>
    <SiteFooter />
  </>;
}

const initialSession = cachedAuthSession();
if (initialSession) moveTo(hasProfile(initialSession.user) ? './quiz.html' : './prd.html#/register-name');
else createRoot(document.getElementById('root')).render(<Landing />);
