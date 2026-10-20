import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowRight, BarChart3, BookOpen, Check, ChevronLeft, ChevronRight, FileText, Link, Plus, Upload } from 'lucide-react';
import { hasProfile } from './profile.js';
import { cachedAuthSession, getSessionSafely, supabase } from './supabase.js';
import { SiteFooter } from './site-footer.jsx';
import './design-system.css';
import './landing.css';

function moveTo(path) {
  window.location.replace(new URL(path, window.location.href));
}

const heroDescriptions = [
  ['문제를 풀며 배운 내용은 기록하고, 떠오른 아이디어는 PRD로 정리해보세요.', '학습부터 기획까지, 한곳에서 자연스럽게 이어갈 수 있어요.'],
  ['오늘 푼 문제에서 놓친 부분을 확인하고, 다음에 볼 내용을 남겨보세요.', '기록이 쌓일수록 무엇을 공부할지 더 선명해져요.'],
  ['흩어진 문제를 한곳에 모아 풀고, 달라진 실력을 차근차근 확인해보세요.', '어제보다 나아진 지점을 직접 눈으로 확인할 수 있어요.'],
  ['문제를 풀다 떠오른 생각은 놓치지 말고, 바로 기획의 재료로 남겨보세요.', '배운 내용을 실제 아이디어로 옮기는 흐름이 자연스러워져요.'],
  ['오늘의 풀이 기록을 돌아보고, 지금 필요한 다음 문제를 골라보세요.', '작은 학습 기록이 모여 나만의 일하는 방식이 만들어져요.'],
];

function HeroDescription() {
  const [descriptionIndex, setDescriptionIndex] = useState(0);
  const [isErasing, setIsErasing] = useState(false);
  const lines = heroDescriptions[descriptionIndex];
  const characterCount = lines.join('').replace(/\s/g, '').length;
  let revealIndex = 0;

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let replaceTimer = 0;
    const rotate = () => {
      if (reducedMotion.matches) {
        setDescriptionIndex(index => (index + 1) % heroDescriptions.length);
        return;
      }
      setIsErasing(true);
      replaceTimer = window.setTimeout(() => {
        setDescriptionIndex(index => (index + 1) % heroDescriptions.length);
        setIsErasing(false);
      }, 680);
    };
    const rotationTimer = window.setInterval(rotate, 10000);
    return () => {
      window.clearInterval(rotationTimer);
      window.clearTimeout(replaceTimer);
    };
  }, []);

  return <p className={`landing-hero-description${isErasing ? ' is-erasing' : ''}`} aria-label={lines.join(' ')}>
    {lines.map((line, lineIndex) => <React.Fragment key={`${descriptionIndex}-${line}`}>
      <span className="landing-reveal-line" aria-hidden="true">
        {line.split(' ').map((word, wordIndex) => <span className="landing-reveal-word" key={`${lineIndex}-${wordIndex}`}>
          {[...word].map((character, characterIndex) => {
            const index = revealIndex++;
            return <span className="landing-reveal-character" style={{ '--reveal-index': index, '--reveal-total': characterCount }} key={`${lineIndex}-${wordIndex}-${characterIndex}`}>{character}</span>;
          })}
        </span>)}
      </span>
      {lineIndex < lines.length - 1 && <><br className="landing-desktop-break" />{' '}</>}
    </React.Fragment>)}
  </p>;
}

const showcaseSlides = [
  { key: 'register', step: '01', title: '문제 불러오기', copy: 'CSV나 Google Sheets에 정리한 문제를 그대로 가져와요.' },
  { key: 'library', step: '02', title: '오늘의 문제지 고르기', copy: '지금 공부할 문제지를 골라 바로 시작해요.' },
  { key: 'solve', step: '03', title: '풀고 바로 확인하기', copy: '답을 고르면 정답과 해설을 바로 볼 수 있어요.' },
  { key: 'stats', step: '04', title: '달라진 실력 보기', copy: '점수와 추세를 보며 다음 공부를 정해요.' },
];

function GlowCursor() {
  const cursorRef = useRef(null);

  useEffect(() => {
    const cursor = cursorRef.current;
    const surface = cursor?.parentElement;
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    if (!cursor || !surface || !finePointer.matches) return undefined;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let currentX = 0;
    let currentY = 0;
    let targetX = 0;
    let targetY = 0;

    const draw = () => {
      const easing = reducedMotion.matches ? 1 : .28;
      currentX += (targetX - currentX) * easing;
      currentY += (targetY - currentY) * easing;
      cursor.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) translate(-50%, -50%)`;
      if (Math.abs(targetX - currentX) > .15 || Math.abs(targetY - currentY) > .15) frame = window.requestAnimationFrame(draw);
      else frame = 0;
    };

    const readPointer = event => {
      const bounds = surface.getBoundingClientRect();
      targetX = event.clientX - bounds.left;
      targetY = event.clientY - bounds.top;
    };
    const handleEnter = event => {
      readPointer(event);
      currentX = targetX;
      currentY = targetY;
      cursor.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) translate(-50%, -50%)`;
      cursor.classList.add('is-visible');
    };
    const handleMove = event => {
      readPointer(event);
      if (!frame) frame = window.requestAnimationFrame(draw);
    };
    const handleLeave = () => cursor.classList.remove('is-visible');

    surface.addEventListener('pointerenter', handleEnter);
    surface.addEventListener('pointermove', handleMove);
    surface.addEventListener('pointerleave', handleLeave);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      surface.removeEventListener('pointerenter', handleEnter);
      surface.removeEventListener('pointermove', handleMove);
      surface.removeEventListener('pointerleave', handleLeave);
    };
  }, []);

  return <span className="landing-glow-cursor" ref={cursorRef} aria-hidden="true" />;
}

function ShowcaseScreen({ type }) {
  return <div className={`showcase-screen is-${type}`}>
    <header><strong>moonble</strong><span>내 워크스페이스</span><i>홍</i></header>
    <div className="showcase-screen-body">
      <aside><i /><i /><i /><i /></aside>
      <main>
        {type === 'register' && <><div className="showcase-title"><small>내 문제지</small><strong>문제지 등록</strong></div><div className="showcase-upload"><Upload size={25} /><b>CSV 파일 선택</b><span>파일을 끌어다 놓아도 돼요</span><em><Check size={12} />20문항 확인</em></div><div className="showcase-link"><Link size={16} /><span>Google Sheets 공유 링크</span><b>가져오기</b></div></>}
        {type === 'library' && <><div className="showcase-title"><small>내 워크스페이스</small><strong>문제지</strong></div><div className="showcase-papers"><article><div><b>moonble</b><span>GA4 핵심 개념</span><i /><i /><i /></div><small>기본 · 20문항</small><strong>GA4 핵심 개념</strong></article><article><div><b>moonble</b><span>GA4 실무 응용</span><i /><i /><i /></div><small>심화 · 20문항</small><strong>GA4 실무 응용</strong></article></div></>}
        {type === 'solve' && <><div className="showcase-title"><small>GA4 핵심 개념 · 2 / 20</small><strong>문제 풀이</strong></div><div className="showcase-question"><b>Q2</b><strong>GA4에서 사용자 행동을 수집하는 기본 단위는 무엇인가요?</strong><span className="is-wrong">세션 <i>×</i></span><span className="is-correct">이벤트 <i>○</i></span><span>사용자 속성</span></div></>}
        {type === 'stats' && <><div className="showcase-title"><small>학습 리포트</small><strong>나의 성취도</strong></div><div className="showcase-score"><span><small>최근 점수</small><b>82점</b></span><span><small>평균 점수</small><b>68점</b></span><span><small>최고 점수</small><b>92점</b></span></div><div className="showcase-chart"><i style={{ height: '34%' }} /><i style={{ height: '48%' }} /><i style={{ height: '43%' }} /><i style={{ height: '62%' }} /><i style={{ height: '74%' }} /><i style={{ height: '91%' }} /><svg viewBox="0 0 320 110" preserveAspectRatio="none"><path d="M8 92 C55 88 66 74 104 79 S164 60 193 55 S254 31 312 18" /></svg></div></>}
      </main>
    </div>
  </div>;
}

function ProductPreview() {
  const [activeSlide, setActiveSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStart = useRef(null);
  const changeSlide = next => {
    const normalized = (next + showcaseSlides.length) % showcaseSlides.length;
    setActiveSlide(normalized);
  };

  useEffect(() => {
    if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const timer = window.setInterval(() => changeSlide(activeSlide + 1), 4800);
    return () => window.clearInterval(timer);
  }, [activeSlide, paused]);

  return <section className="landing-showcase" aria-roledescription="carousel" aria-label="Moonble 사용 화면" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocusCapture={() => setPaused(true)} onBlurCapture={() => setPaused(false)} onTouchStart={event => { touchStart.current = event.touches[0].clientX; }} onTouchEnd={event => {
    if (touchStart.current === null) return;
    const distance = event.changedTouches[0].clientX - touchStart.current;
    if (Math.abs(distance) > 42) changeSlide(activeSlide + (distance < 0 ? 1 : -1));
    touchStart.current = null;
  }}>
    <div className="landing-showcase-viewport">
      <div className="landing-showcase-track">
        {showcaseSlides.map((slide, index) => {
          const distance = (index - activeSlide + showcaseSlides.length) % showcaseSlides.length;
          const position = distance === 0 ? 'is-active' : distance === 1 ? 'is-next' : distance === 2 ? 'is-far' : 'is-previous';
          return <article className={`landing-showcase-slide ${position}`} aria-hidden={index !== activeSlide} key={slide.key}>
            <div className="landing-showcase-copy"><span>{slide.step}</span><strong>{slide.title}</strong><p>{slide.copy}</p></div>
            <ShowcaseScreen type={slide.key} />
            <GlowCursor />
          </article>;
        })}
      </div>
      <button className="landing-showcase-arrow is-prev" type="button" aria-label="이전 화면" onClick={() => changeSlide(activeSlide - 1)}><ChevronLeft size={22} /></button>
      <button className="landing-showcase-arrow is-next" type="button" aria-label="다음 화면" onClick={() => changeSlide(activeSlide + 1)}><ChevronRight size={22} /></button>
    </div>
    <div className="landing-showcase-pagination" aria-label="화면 선택">{showcaseSlides.map((slide, index) => <button className={index === activeSlide ? 'is-active' : ''} type="button" aria-label={`${slide.title} 화면 보기`} aria-current={index === activeSlide ? 'true' : undefined} onClick={() => changeSlide(index)} key={slide.key} />)}</div>
  </section>;
}

const highlights = [
  { label: '문제지 등록', value: 2, suffix: '가지', detail: 'CSV · Google Sheets' },
  { label: '기본 문제지', value: 20, suffix: '문항', detail: 'GA4 기본 · 실무 응용' },
  { label: '학습 흐름', value: 4, suffix: '단계', detail: '등록부터 성취도 확인까지' },
  { label: '개인 워크스페이스', value: 1, suffix: '곳', detail: '문제풀이 · 성취도 · PRD' },
];

function AnimatedMetric({ target, active, cycle }) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setValue(target); return undefined; }
    let frame = 0;
    const startedAt = performance.now();
    const duration = 900;
    setValue(0);
    const update = time => {
      const progress = Math.min(1, (time - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) frame = window.requestAnimationFrame(update);
    };
    frame = window.requestAnimationFrame(update);
    return () => window.cancelAnimationFrame(frame);
  }, [active, cycle, target]);

  return value;
}

function HighlightBand() {
  const sectionRef = useRef(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setHasStarted(true);
      observer.disconnect();
    }, { threshold: .25 });
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!hasStarted || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const timer = window.setInterval(() => setCycle(value => value + 1), 10000);
    return () => window.clearInterval(timer);
  }, [hasStarted]);

  return <section className="landing-highlights" aria-label="Moonble 핵심 구성" ref={sectionRef}>
    <div className="landing-highlights-inner">{highlights.map(({ label, value, suffix, detail }) => <article key={label}>
      <span>{label}</span><strong><b><AnimatedMetric target={value} active={hasStarted} cycle={cycle} /></b>{suffix}</strong><p>{detail}</p>
    </article>)}</div>
  </section>;
}

const features = [
  { icon: Upload, eyebrow: '문제지 등록', title: '정리해둔 문제를 바로 가져와요', copy: 'CSV 파일을 올리거나 Google Sheets 링크를 붙여 넣어 바로 문제지로 만들 수 있어요.' },
  { icon: BookOpen, eyebrow: '집중 풀이', title: '오늘 필요한 문제만 골라 풀어요', copy: '기본·심화 문제지와 직접 만든 문제지 중 지금 공부할 내용을 선택하세요.' },
  { icon: BarChart3, eyebrow: '성취도', title: '점수보다 실력의 흐름을 봐요', copy: '회차별 점수와 최근·장기 추세를 비교해, 어디까지 성장했는지 확인할 수 있어요.' },
  { icon: FileText, eyebrow: 'PRD', title: '배운 내용을 기획으로 이어가요', copy: '문제를 풀며 떠오른 생각을 정리하고, 실제 기획 문서로 발전시켜보세요.' },
];

const faqs = [
  { question: 'Moonble로 무엇을 할 수 있나요?', answer: '문제지를 가져와 풀고, 달라진 실력을 확인할 수 있어요. 문제를 풀며 떠오른 아이디어는 PRD로 정리할 수 있어요.' },
  { question: '내 문제지는 어떻게 등록하나요?', answer: 'CSV 파일을 올리거나 Google Sheets 공유 링크를 붙여 넣으면 돼요. 등록하기 전에 문항 형식과 개수도 확인할 수 있어요.' },
  { question: '어떤 학습 기록이 저장되나요?', answer: '문제지별 풀이 횟수와 점수, 최근 실력 추세를 계정별로 저장해요. 나의 성취도에서 최근 변화와 장기 추세를 함께 살펴볼 수 있어요.' },
  { question: '휴대폰에서도 문제를 풀 수 있나요?', answer: '네. 로그인부터 문제지 선택과 풀이까지 모바일 화면에 맞춰 편하게 이용할 수 있어요.' },
  { question: '내 정보를 바꾸거나 계정을 삭제할 수 있나요?', answer: '내 계정에서 이름과 회사 정보를 직접 바꿀 수 있어요. 회원 탈퇴를 선택하면 확인 절차를 거쳐 계정과 관련 데이터가 삭제돼요.' },
];

function LandingFaq() {
  const [openIndex, setOpenIndex] = useState(null);

  return <section className="landing-faq" id="faq" aria-labelledby="faq-title">
    <span>FAQ</span><h2 id="faq-title">자주 묻는 질문</h2>
    <div className="landing-faq-list">{faqs.map(({ question, answer }, index) => {
      const isOpen = openIndex === index;
      const answerId = `faq-answer-${index}`;
      return <div className={`landing-faq-item${isOpen ? ' is-open' : ''}`} key={question}>
        <button type="button" aria-expanded={isOpen} aria-controls={answerId} onClick={() => setOpenIndex(isOpen ? null : index)}><strong>{question}</strong><i aria-hidden="true" /></button>
        <div className="landing-faq-answer" id={answerId} aria-hidden={!isOpen}><div><p>{answer}</p></div></div>
      </div>;
    })}</div>
  </section>;
}

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
      const navProgress = progress < .19
        ? smooth(progress / .19) / 3
        : progress < .43
          ? (1 + smooth((progress - .19) / .24)) / 3
          : progress < .71
            ? (2 + smooth((progress - .43) / .28)) / 3
            : 1;

      sticky.dataset.step = String(step);
      sticky.style.setProperty('--story-nav-remaining', `${((1 - navProgress) * 100).toFixed(2)}%`);
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
        <p>문제를 가져온 뒤 바로 풀고, 채점 결과와 실력의 변화를 한곳에서 확인하세요.</p>
        <ol className="landing-story-nav" aria-label="Moonble 학습 흐름">
          <li><b>01</b><span><strong>문제지 등록</strong><small>정리해둔 문제를 가져와요</small></span></li>
          <li><b>02</b><span><strong>문제지 선택</strong><small>오늘 풀 문제를 골라요</small></span></li>
          <li><b>03</b><span><strong>풀이와 채점</strong><small>정답과 해설을 바로 확인해요</small></span></li>
          <li><b>04</b><span><strong>성취도 확인</strong><small>달라진 실력을 살펴봐요</small></span></li>
        </ol>
        <a href="./login.html">내 워크스페이스 열기<ArrowRight size={18} aria-hidden="true" /></a>
      </div>

      <div className="landing-story-demo" role="img" aria-label="문제지를 등록하고 선택한 뒤 문제를 채점하고 성취도 통계를 확인하는 Moonble 화면 애니메이션">
        <div className="story-window">
          <aside className="story-app-sidebar" aria-hidden="true">
            <strong className="story-app-logo">moonble</strong>
            <div className="story-app-profile"><i>홍</i><span><b>홍길동</b><small>개인 워크스페이스</small></span></div>
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
            <div className="story-app-topbar" aria-hidden="true"><span>내 워크스페이스</span><i>홍</i></div>

            <div className="story-screen story-register-screen">
              <header><div><small>내 문제지</small><strong>문제지 등록</strong></div><span>최소 20문항</span></header>
              <article className="story-register-card">
                <div className="story-register-copy"><strong>정리해둔 문제를 가져오세요</strong><p>CSV 파일을 올리거나 Google Sheets 링크를 붙여 넣으면 돼요.</p></div>
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
                  <span><b>기본</b> · 20문항</span><strong>GA4 핵심 개념</strong><p>이벤트부터 보고서까지, 분석의 기본기를 차근차근 익혀보세요.</p>
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
                <div className="story-grade-message"><Check size={17} aria-hidden="true" /><span><strong>채점 완료</strong>정답과 해설을 확인해보세요.</span></div>
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
          <GlowCursor />
        </div>
      </div>
    </div>
  </section>;
}

function useLandingOrbMotion() {
  useEffect(() => {
    const sections = [
      { element: document.querySelector('.landing-hero'), vector: [42, 76] },
      { element: document.querySelector('.landing-features'), vector: [-52, 86] },
      { element: document.querySelector('.landing-cta'), vector: [38, 58] },
    ].filter(({ element }) => element);
    if (!sections.length) return undefined;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let current = sections.map(() => 0);
    let target = sections.map(() => 0);
    let previousTime = 0;

    const read = element => {
      const bounds = element.getBoundingClientRect();
      const centerOffset = window.innerHeight * .5 - (bounds.top + bounds.height * .5);
      return Math.max(-1, Math.min(1, centerOffset / Math.max((window.innerHeight + bounds.height) * .5, 1)));
    };
    const render = values => sections.forEach(({ element, vector }, index) => {
      const progress = reducedMotion.matches ? 0 : values[index];
      const x = progress * vector[0];
      const y = progress * vector[1];
      element.style.setProperty('--orb-a-x', `${x.toFixed(2)}px`);
      element.style.setProperty('--orb-a-y', `${y.toFixed(2)}px`);
      element.style.setProperty('--orb-b-x', `${(-x).toFixed(2)}px`);
      element.style.setProperty('--orb-b-y', `${(-y).toFixed(2)}px`);
    });
    const animate = time => {
      const elapsed = previousTime ? Math.min(time - previousTime, 48) : 16;
      previousTime = time;
      const blend = 1 - Math.exp(-elapsed / 150);
      let settled = true;
      current = current.map((value, index) => {
        const next = value + (target[index] - value) * blend;
        if (Math.abs(target[index] - next) > .0005) settled = false;
        return settled && Math.abs(target[index] - next) <= .0005 ? target[index] : next;
      });
      render(current);
      if (settled) { frame = 0; previousTime = 0; }
      else frame = window.requestAnimationFrame(animate);
    };
    const requestUpdate = () => {
      target = reducedMotion.matches ? sections.map(() => 0) : sections.map(({ element }) => read(element));
      if (!frame) frame = window.requestAnimationFrame(animate);
    };
    const handleMotionChange = () => {
      current = reducedMotion.matches ? sections.map(() => 0) : sections.map(({ element }) => read(element));
      target = [...current];
      render(current);
    };

    current = reducedMotion.matches ? sections.map(() => 0) : sections.map(({ element }) => read(element));
    target = [...current];
    render(current);
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
}

function Landing() {
  useLandingOrbMotion();

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
      <nav aria-label="소개 페이지 탐색"><a href="#features">기능</a><a href="#workflow">사용 방법</a><a href="#faq">FAQ</a></nav>
      <a className="landing-login" href="./login.html">로그인</a>
    </header>
    <main>
      <section className="landing-hero">
        <div className="landing-hero-glow landing-hero-glow-one" aria-hidden="true" />
        <div className="landing-hero-glow landing-hero-glow-two" aria-hidden="true" />
        <div className="landing-hero-copy">
          <span className="landing-eyebrow">기획자 워크스페이스</span>
          <h1>배운 것을 쌓고,<br /><em>생각을 기획으로.</em></h1>
          <HeroDescription />
          <div className="landing-actions"><a className="landing-secondary" href="#features">먼저 둘러보기</a><a className="landing-primary" href="./login.html">무료로 시작하기<ArrowRight size={18} aria-hidden="true" /></a></div>
        </div>
        <ProductPreview />
      </section>

      <HighlightBand />

      <section className="landing-features" id="features" aria-labelledby="features-title">
        <div className="landing-section-heading"><span>Moonble의 차이</span><h2 id="features-title"><em>문제를 푼 뒤에도 배움이 남도록,</em><br />학습과 기획을 자연스럽게 잇습니다</h2><p>문제 등록부터 풀이, 기록, PRD 작성까지 한곳에서 이어가세요.</p></div>
        <div className="landing-feature-grid">{features.map(({ icon: Icon, eyebrow, title, copy }) => <article key={eyebrow}>
          <div className="landing-feature-icon"><Icon size={22} aria-hidden="true" /></div>
          <span>{eyebrow}</span><h3>{title}</h3><p>{copy}</p>
        </article>)}</div>
      </section>

      <ScrollStory />

      <section className="landing-cta"><p>오늘 배운 내용을 흘려보내지 마세요.</p><h2>오늘의 배움을<br />내일의 기획으로</h2><a href="./login.html">무료로 시작하기<ArrowRight size={18} aria-hidden="true" /></a></section>

      <LandingFaq />
    </main>
    <SiteFooter />
  </>;
}

const initialSession = cachedAuthSession();
if (initialSession) moveTo(hasProfile(initialSession.user) ? './quiz.html' : './prd.html#/register-name');
else createRoot(document.getElementById('root')).render(<Landing />);
