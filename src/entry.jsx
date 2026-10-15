import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowRight, BarChart3, BookOpen, Check, FileText, LayoutPanelLeft } from 'lucide-react';
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
  { icon: BookOpen, eyebrow: '문제지', title: '문제를 풀며 핵심을 익혀요', copy: '기본 문제지부터 직접 만든 문제지까지 한곳에서 고르고, 흐름을 끊지 않고 풀어보세요.' },
  { icon: BarChart3, eyebrow: '성취도', title: '성장의 흐름을 확인해요', copy: '회차별 점수와 단기·장기 추세를 함께 보며 최근에 달라진 실력을 확인하세요.' },
  { icon: FileText, eyebrow: 'PRD', title: '배운 내용을 기획으로 연결해요', copy: '떠오른 아이디어를 PRD로 정리하고 학습과 기획을 같은 워크스페이스에서 이어가세요.' },
];

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
          <span className="landing-eyebrow"><LayoutPanelLeft size={16} aria-hidden="true" />기획자를 위한 워크스페이스</span>
          <h1>배운 것을 쌓고,<br /><em>생각을 기획으로.</em></h1>
          <p>문제를 풀며 익힌 내용을 기록하고, 떠오른 아이디어를 PRD로 정리하세요.<br className="landing-desktop-break" /> Moonble은 학습과 기획을 한 흐름으로 이어주는 개인 워크스페이스입니다.</p>
          <div className="landing-actions"><a className="landing-primary" href="./login.html">무료로 시작하기<ArrowRight size={18} aria-hidden="true" /></a><a className="landing-secondary" href="#features">Moonble 살펴보기</a></div>
          <ul aria-label="Moonble 이용 특징"><li><Check size={15} aria-hidden="true" />설치 없이 바로 시작</li><li><Check size={15} aria-hidden="true" />개인 학습 기록 저장</li></ul>
        </div>
        <ProductPreview />
      </section>

      <section className="landing-proof" aria-label="Moonble 핵심 가치">
        <div><strong>문제 풀이</strong><span>핵심을 익히고</span></div>
        <i aria-hidden="true" />
        <div><strong>성취도</strong><span>변화를 확인하고</span></div>
        <i aria-hidden="true" />
        <div><strong>PRD</strong><span>기획으로 완성해요</span></div>
      </section>

      <section className="landing-features" id="features" aria-labelledby="features-title">
        <div className="landing-section-heading"><span>하나의 워크스페이스</span><h2 id="features-title">배움과 기획이<br />자연스럽게 이어져요</h2><p>필요한 기능만 단순하게 연결해, 메뉴를 찾는 시간보다 실제 학습과 작업에 집중할 수 있어요.</p></div>
        <div className="landing-feature-grid">{features.map(({ icon: Icon, eyebrow, title, copy }) => <article key={eyebrow}>
          <div className="landing-feature-icon"><Icon size={22} aria-hidden="true" /></div><span>{eyebrow}</span><h3>{title}</h3><p>{copy}</p>
        </article>)}</div>
      </section>

      <section className="landing-workflow" id="workflow" aria-labelledby="workflow-title">
        <div><span className="landing-eyebrow">시작하는 방법</span><h2 id="workflow-title">고르고, 풀고,<br />다음을 정하세요</h2><p>문제지를 고르고 집중해서 푼 다음, 기록을 보며 다음 행동을 정하세요. 정리할 아이디어는 PRD로 자연스럽게 이어집니다.</p><a href="./login.html">내 워크스페이스 열기<ArrowRight size={18} aria-hidden="true" /></a></div>
        <ol><li><b>1</b><div><strong>문제지 선택</strong><p>준비된 문제지 또는 직접 만든 문제지를 선택해요.</p></div></li><li><b>2</b><div><strong>집중해서 풀이</strong><p>문제 목록을 오가며 한 번에 흐름을 이어가요.</p></div></li><li><b>3</b><div><strong>성취도 확인</strong><p>점수와 추세를 확인하고 다음 학습을 계획해요.</p></div></li></ol>
      </section>

      <section className="landing-cta"><p>나만의 학습과 기획 흐름을 시작해보세요.</p><h2>오늘 배운 것을<br />내일의 기획으로</h2><a href="./login.html">Moonble 시작하기<ArrowRight size={18} aria-hidden="true" /></a></section>
    </main>
    <SiteFooter />
  </>;
}

const initialSession = cachedAuthSession();
if (initialSession) moveTo(hasProfile(initialSession.user) ? './quiz.html' : './prd.html#/register-name');
else createRoot(document.getElementById('root')).render(<Landing />);
