import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, BookOpen, Check, ChevronLeft, Download, FileUp, Gauge, Link2, ListChecks, Search, Upload } from 'lucide-react';
import { csvToQuestions, downloadSampleCSV, extractSheetExportUrl, setCustomBank, updateCustomBankMeta } from './custom-bank.js';
import { SegmentedControl } from './segmented-control.jsx';
import { takeSharedFile } from './share-target.js';
import { TooltipIcon } from './tooltip-icon.jsx';

function generationPrompt(query, provider) {
  const format = `시트와 CSV의 맨 위에 다음 문제지 정보 2개 행을 반드시 먼저 넣어주세요.
# title,문제지 이름
# description,문제지를 설명하는 한 문장
그 다음 행부터 헤더를 정확히 다음 순서로 사용해주세요.
번호,question,option1,option2,option3,option4,correct,explain
- correct에는 정답 보기 번호를 1~4로 입력
- 복수 정답이면 1,3처럼 쉼표로 구분하고 해당 셀을 큰따옴표로 감싸기`;
  const common = `Moonble에서 풀 수 있는 학습 문제지를 만들어주세요.

사용자 요청:
${query}

다음 조건을 반드시 지켜주세요.
- 한국어 객관식 문제 20문항
- 문항마다 보기 4개, 정답, 짧고 명확한 해설 포함
- 사용자의 목적과 난이도 요청을 우선 반영
- 사실 확인이 필요한 내용은 최신 기준으로 검토
- 문제지 이름과 한 문장 설명을 문제 내용에 맞게 작성

${format}`;
  if (provider === 'gemini') {
    return `${common}

결과는 UTF-8 CSV 파일과 Google Sheets 두 형태로 만들어주세요.
- 다운로드 가능한 moonble_questions.csv 파일 생성
- Google Drive에 새 Google Sheets를 만들고 위 형식의 메타데이터와 20문항을 넣기
- 공유 권한을 ‘링크가 있는 모든 사용자 · 뷰어’로 설정
- 답변 마지막에 생성한 Google Sheets 공유 링크를 복사해 붙여넣기 쉬운 독립된 한 줄로 제공`;
  }
  return `${common}

결과는 다운로드 가능한 UTF-8 CSV 파일로 제공해주세요.
- 파일명은 moonble_questions.csv
- CSV 외의 부가 설명은 파일 내용에 넣지 않기`;
}

const promptSamples = [
  '정보처리기사 문제를 난이도 상으로 만들어줘',
  'SQL 조인 개념을 실무 난이도로 복습하고 싶어',
  'GA4 전자상거래 이벤트 문제를 만들어줘',
  '신입 기획자를 위한 데이터 분석 문제를 만들어줘',
];
const examplePrompts = [
  '정보처리기사 필기를 준비하고 있어. 데이터베이스와 SQL 중심으로 상급 문제를 만들어줘.',
  'GA4 전자상거래 이벤트를 실무 사례 중심의 중급 문제로 만들어줘.',
  '신입 서비스 기획자가 알아야 할 데이터 분석 지표를 기본 난이도로 출제해줘.',
  'SQL 조인과 서브쿼리를 확실히 구분할 수 있는 상급 문제를 만들어줘.',
  'UX 리서치 방법론을 실제 프로젝트 상황에 적용하는 문제를 만들어줘.',
  '컴퓨터활용능력 시험 대비 엑셀 함수 문제를 중급 난이도로 준비해줘.',
  '네트워크 보안의 핵심 개념을 사례형 객관식 문제로 만들어줘.',
  '프로덕트 매니저 면접에 자주 나오는 지표와 실험 설계 문제를 출제해줘.',
  '데이터베이스 정규화와 트랜잭션을 비교하는 고난도 문제를 만들어줘.',
  '웹 접근성 지침을 실제 화면 검수 상황에 적용하는 문제를 만들어줘.',
  'DA 애널리틱스 실무에서 자주 쓰는 지표와 분석 방법을 사례형으로 출제해줘.',
  'A/B 테스트의 가설 설정과 결과 해석을 연습할 수 있는 문제를 만들어줘.',
  '파이썬 판다스로 데이터를 정제하고 분석하는 실무 문제를 만들어줘.',
  '데이터 모델링과 ERD 설계를 평가하는 상급 문제를 만들어줘.',
  '클라우드 환경의 접근 제어와 보안 설정을 사례로 출제해줘.',
  '기초 통계와 가설 검정을 데이터 분석 사례에 적용하는 문제를 만들어줘.',
  '제품 분석에서 퍼널과 리텐션 지표를 해석하는 문제를 만들어줘.',
  '정보보안기사 시험 대비 네트워크와 암호 기술 문제를 상급으로 만들어줘.',
];
const exampleGuideDetails = [
  { topic: '정보처리기사 필기', level: '상급', scope: '데이터베이스와 SQL 중심', field: 'DB · SQL' },
  { topic: 'GA4 전자상거래 이벤트', level: '중급', scope: '실무 사례 중심', field: 'GA4 애널리틱스' },
  { topic: '서비스 기획 데이터 분석', level: '기본', scope: '주요 분석 지표', field: '서비스 분석' },
  { topic: 'SQL 조인과 서브쿼리', level: '상급', scope: '두 개념의 차이와 활용', field: 'SQL' },
  { topic: 'UX 리서치 방법론', level: '실무 적용', scope: '실제 프로젝트 상황', field: 'UX 리서치' },
  { topic: '컴퓨터활용능력 시험', level: '중급', scope: '엑셀 함수', field: '엑셀' },
  { topic: '네트워크 보안', level: '사례형', scope: '핵심 보안 개념', field: '네트워크' },
  { topic: '프로덕트 매니저 면접', level: '면접 대비', scope: '주요 지표와 실험 설계', field: '제품 분석' },
  { topic: '데이터베이스 정규화와 트랜잭션', level: '고난도', scope: '두 개념 비교', field: 'DB 설계' },
  { topic: '웹 접근성 지침', level: '실무 적용', scope: '화면 검수 상황', field: '웹 접근성' },
  { topic: 'DA 애널리틱스', level: '실무 적용', scope: '주요 지표와 분석 방법', field: '데이터 분석' },
  { topic: 'A/B 테스트', level: '중급', scope: '가설 설정과 결과 해석', field: '실험 설계' },
  { topic: '파이썬 데이터 분석', level: '실무 적용', scope: '판다스 데이터 정제', field: '파이썬' },
  { topic: '데이터 모델링과 ERD', level: '상급', scope: '데이터 구조 설계', field: '데이터 모델링' },
  { topic: '클라우드 보안', level: '실무 적용', scope: '접근 제어와 보안 설정', field: '클라우드' },
  { topic: '통계와 가설 검정', level: '중급', scope: '분석 사례 적용', field: '통계 분석' },
  { topic: '퍼널과 리텐션 지표', level: '실무 적용', scope: '제품 사용 흐름 분석', field: '제품 분석' },
  { topic: '정보보안기사 필기', level: '상급', scope: '네트워크와 암호 기술', field: '정보 보안' },
];

function pickExampleIndexes() {
  const indexes = Array.from({ length: examplePrompts.length }, (_, index) => index);
  for (let index = indexes.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [indexes[index], indexes[swapIndex]] = [indexes[swapIndex], indexes[index]];
  }
  return indexes.slice(0, 7);
}
const providerSegments = [
  { value: 'gemini', label: 'AI Mode' },
  { value: 'chatgpt', label: 'ChatGPT' },
];

const creatorStepIcons = {
  upload: FileUp,
};

function CreatorStepMarker({ step, label }) {
  const Icon = creatorStepIcons[step];
  return <span className="creator-step-marker" role="img" aria-label={label}><Icon size={16} strokeWidth={2} aria-hidden="true" /></span>;
}

function initialCreatorScreen() {
  const params = new URLSearchParams(window.location.search);
  return params.get('shared') === '1' || params.has('shareError') || window.history.state?.moonbleCreatorStep === 'upload' ? 'upload' : 'create';
}

function CreatorProgress({ screen }) {
  const step = screen === 'create' ? 1 : 2;
  return <div className={`creator-progress${screen === 'create' ? ' is-prompt-step' : ''}`}>
    <div className="creator-progress-track" role="progressbar" aria-label="문제지 생성 진행" aria-valuemin={0} aria-valuemax={2} aria-valuenow={step} aria-valuetext={screen === 'result' ? '문제지 등록 완료' : `${step}/2단계: ${step === 1 ? '문제 만들기' : '파일 등록'}`}><span style={{ width: `${step * 50}%` }} /></div>
    <div className="creator-progress-labels"><span className={step === 1 ? 'is-current' : ''} aria-current={step === 1 ? 'step' : undefined}>1. 문제 만들기</span><span className={step === 2 ? 'is-current' : ''} aria-current={step === 2 ? 'step' : undefined}>2. 파일 등록</span></div>
  </div>;
}

function PromptSample({ hidden }) {
  const [sampleIndex, setSampleIndex] = useState(0);
  const [erasing, setErasing] = useState(false);
  const sample = promptSamples[sampleIndex];

  useEffect(() => {
    if (hidden) {
      setErasing(false);
      return undefined;
    }
    let replaceTimer = 0;
    const rotationTimer = window.setInterval(() => {
      setErasing(true);
      replaceTimer = window.setTimeout(() => {
        setSampleIndex(index => (index + 1) % promptSamples.length);
        setErasing(false);
      }, 520);
    }, 6000);
    return () => {
      window.clearInterval(rotationTimer);
      window.clearTimeout(replaceTimer);
    };
  }, [hidden]);

  return <span className={`creator-prompt-sample${hidden ? ' is-hidden' : ''}${erasing ? ' is-erasing' : ''}`} aria-hidden="true">
    {[...sample].map((character, index) => <span className="creator-prompt-character" style={{ '--sample-index': index, '--sample-total': sample.length }} key={`${sampleIndex}-${index}`}>{character === ' ' ? '\u00a0' : character}</span>)}
  </span>;
}

function PromptReveal({ text, id }) {
  let revealIndex = 0;
  return <span className="creator-ai-prompt-reveal" aria-hidden="true">{text.split(/(\s+)/).map((segment, segmentIndex) => {
    if (/^\s+$/.test(segment)) return <React.Fragment key={`${id}-space-${segmentIndex}`}>{segment}</React.Fragment>;
    return [...segment].map(character => {
      const index = revealIndex++;
      return <span className="creator-ai-prompt-reveal-character" style={{ '--reveal-index': index }} key={`${id}-${index}`}>{character}</span>;
    });
  })}</span>;
}

export function QuizCreator({ custom, onChange }) {
  const [query, setQuery] = useState('');
  const [provider, setProvider] = useState('gemini');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [sheetPending, setSheetPending] = useState(false);
  const [sheetLink, setSheetLink] = useState('');
  const [dragging, setDragging] = useState(false);
  const [promptFocused, setPromptFocused] = useState(false);
  const [exampleRevealed, setExampleRevealed] = useState(false);
  const [examplePromptReveal, setExamplePromptReveal] = useState(null);
  const [exampleIndex, setExampleIndex] = useState(0);
  const [exampleCardIndexes] = useState(() => pickExampleIndexes());
  const [exampleCardsDragging, setExampleCardsDragging] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [metaReveal, setMetaReveal] = useState(false);
  const [screen, setScreen] = useState(initialCreatorScreen);
  const [resultBank, setResultBank] = useState(null);
  const [resultReady, setResultReady] = useState(true);
  const [bankTitle, setBankTitle] = useState(custom?.title || '');
  const [bankDescription, setBankDescription] = useState(custom?.description || '');
  const promptBarRef = useRef(null);
  const promptInputRef = useRef(null);
  const promptDockOriginRef = useRef(null);
  const promptDockAnimationRef = useRef(null);
  const keyboardOffsetFrame = useRef(0);
  const promptGuideRef = useRef(null);
  const uploadInputRef = useRef(null);
  const examplePromptRevealTimerRef = useRef(0);
  const examplePromptRevealIdRef = useRef(0);
  const exampleCardsDragRef = useRef(null);
  const suppressExampleCardClickRef = useRef(false);
  const uploadSuccessTimer = useRef(0);
  const metaRevealTimer = useRef(0);
  const resultScreenTimer = useRef(0);
  const resultRevealTimer = useRef(0);
  const previousScreen = useRef(screen);
  const displayBank = resultBank || custom;
  const preview = useMemo(() => displayBank?.questions?.slice(0, 8) || [], [displayBank]);
  const examplePrompt = examplePrompts[exampleIndex];
  const exampleGuide = exampleGuideDetails[exampleIndex];

  useLayoutEffect(() => {
    if (previousScreen.current === screen) return;
    previousScreen.current = screen;
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.getElementById('quiz-creator')?.focus({ preventScroll: true });
  }, [screen]);

  useEffect(() => {
    const restoreAIRegistration = event => {
      if (event.persisted && initialCreatorScreen() === 'upload') setScreen(current => current === 'create' ? 'upload' : current);
    };
    window.addEventListener('pageshow', restoreAIRegistration);
    return () => window.removeEventListener('pageshow', restoreAIRegistration);
  }, []);

  function changeStep(next) {
    promptInputRef.current?.blur();
    setPromptFocused(false);
    if (promptGuideRef.current) promptGuideRef.current.open = false;
    setGuideOpen(false);
    setError('');
    setMessage('');
    // Keep the registration step on this history entry when returning from mobile AI navigation.
    window.history.replaceState({ ...window.history.state, moonbleCreatorStep: next }, '');
    setScreen(next);
  }

  useEffect(() => {
    if (resultBank && custom?.id !== resultBank.id) return;
    setBankTitle(custom?.title || '');
    setBankDescription(custom?.description || '');
  }, [custom?.title, custom?.description, custom?.savedAt]);

  useEffect(() => () => {
    window.clearTimeout(examplePromptRevealTimerRef.current);
    window.clearTimeout(uploadSuccessTimer.current);
    window.clearTimeout(metaRevealTimer.current);
    window.clearTimeout(resultScreenTimer.current);
    window.clearTimeout(resultRevealTimer.current);
  }, []);

  useEffect(() => {
    if (!guideOpen) return undefined;
    setExampleIndex(Math.floor(Math.random() * examplePrompts.length));
    const timer = window.setInterval(() => {
      setExampleIndex(index => (index + 1) % examplePrompts.length);
      setExampleRevealed(true);
    }, 4800);
    return () => window.clearInterval(timer);
  }, [guideOpen]);

  useEffect(() => {
    if (!promptFocused) return undefined;
    const viewport = window.visualViewport;
    const hideMobileDock = window.matchMedia('(max-width: 767px)').matches;
    if (hideMobileDock) document.body.classList.add('mb-creator-prompt-focused');
    const updateKeyboardOffset = () => {
      keyboardOffsetFrame.current = 0;
      const bar = promptBarRef.current;
      if (!bar || !viewport) return;
      const keyboardGap = Math.max(0, Math.round(window.innerHeight - (viewport.offsetTop + viewport.height)));
      const currentGap = Number.parseFloat(bar.style.getPropertyValue('--creator-keyboard-offset')) || 0;
      if (Math.abs(keyboardGap - currentGap) >= 1) {
        bar.style.setProperty('--creator-keyboard-offset', `${keyboardGap}px`);
      }
    };
    const scheduleKeyboardOffsetUpdate = () => {
      if (keyboardOffsetFrame.current) return;
      keyboardOffsetFrame.current = window.requestAnimationFrame(updateKeyboardOffset);
    };
    scheduleKeyboardOffsetUpdate();
    viewport?.addEventListener('resize', scheduleKeyboardOffsetUpdate);
    viewport?.addEventListener('scroll', scheduleKeyboardOffsetUpdate);
    return () => {
      viewport?.removeEventListener('resize', scheduleKeyboardOffsetUpdate);
      viewport?.removeEventListener('scroll', scheduleKeyboardOffsetUpdate);
      if (keyboardOffsetFrame.current) window.cancelAnimationFrame(keyboardOffsetFrame.current);
      keyboardOffsetFrame.current = 0;
      document.body.classList.remove('mb-creator-prompt-focused');
      promptBarRef.current?.style.removeProperty('--creator-keyboard-offset');
    };
  }, [promptFocused]);

  useLayoutEffect(() => {
    const origin = promptDockOriginRef.current;
    const bar = promptBarRef.current;
    promptDockOriginRef.current = null;
    if (!promptFocused || !origin || !bar || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;

    const destination = bar.getBoundingClientRect();
    const offsetX = origin.left - destination.left;
    const offsetY = origin.top - destination.top;
    const scaleX = origin.width / destination.width;
    if (Math.abs(offsetX) < 1 && Math.abs(offsetY) < 1) return undefined;

    promptDockAnimationRef.current?.cancel();
    const animation = bar.animate([
      { transform: `translate3d(${offsetX}px, ${offsetY}px, 0) scaleX(${scaleX})`, transformOrigin: 'top left', opacity: 0.96 },
      { transform: 'translate3d(0, 0, 0) scaleX(1)', transformOrigin: 'top left', opacity: 1 },
    ], {
      duration: 520,
      easing: 'cubic-bezier(.22, .82, .24, 1)',
    });
    promptDockAnimationRef.current = animation;
    animation.onfinish = () => {
      if (promptDockAnimationRef.current === animation) promptDockAnimationRef.current = null;
      animation.cancel();
    };
    return () => {
      animation.onfinish = null;
      animation.cancel();
      if (promptDockAnimationRef.current === animation) promptDockAnimationRef.current = null;
    };
  }, [promptFocused]);

  function shakePrompt() {
    const bar = promptBarRef.current;
    if (!bar) return;
    bar.classList.remove('shake');
    void bar.offsetWidth;
    bar.classList.add('shake');
    promptInputRef.current?.focus();
  }

  function dockPrompt() {
    if (promptFocused) return;
    if (window.matchMedia('(max-width: 767px)').matches && promptBarRef.current) {
      const { left, top, width } = promptBarRef.current.getBoundingClientRect();
      promptDockOriginRef.current = { left, top, width };
    }
    setPromptFocused(true);
  }

  function openPopup(url) {
    if (window.matchMedia('(max-width: 767px)').matches) {
      window.location.assign(url);
      return;
    }
    const screenWidth = window.screen.availWidth || window.screen.width;
    const screenHeight = window.screen.availHeight || window.screen.height;
    const width = Math.min(480, Math.max(320, screenWidth - 32));
    const height = Math.min(760, Math.max(560, screenHeight - 32));
    const left = Math.max(0, Math.round((screenWidth - width) / 2));
    const top = Math.max(0, Math.round((screenHeight - height) / 2));
    const popup = window.open(url, 'moonbleAI', `popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`);
    if (!popup) window.open(url, '_blank', 'noopener');
    else popup.focus();
  }

  function requestGeneration() {
    window.clearTimeout(examplePromptRevealTimerRef.current);
    examplePromptRevealTimerRef.current = 0;
    examplePromptRevealIdRef.current += 1;
    setExamplePromptReveal(null);
    const value = query.trim();
    if (!value) { shakePrompt(); return; }
    setError('');
    const prompt = encodeURIComponent(generationPrompt(value, provider));
    const url = provider === 'gemini' ? `https://www.google.com/search?q=${prompt}&udm=50` : `https://chatgpt.com/?q=${prompt}`;
    changeStep('upload');
    openPopup(url);
    setQuery('');
    if (promptInputRef.current) {
      promptInputRef.current.style.height = 'auto';
      promptInputRef.current.blur();
    }
    setMessage(provider === 'gemini'
      ? 'AI Mode에 문제 생성 요청을 열었어요. 완성된 Google Sheets 공유 링크를 등록해주세요.'
      : 'ChatGPT에 문제 생성 요청을 열었어요. CSV 파일을 내려받아 등록해주세요.');
  }

  function useExample(prompt = examplePrompt) {
    const selectedPrompt = typeof prompt === 'string' ? prompt : examplePrompt;
    const characters = [...selectedPrompt].filter(character => !/\s/.test(character));
    window.clearTimeout(examplePromptRevealTimerRef.current);
    examplePromptRevealTimerRef.current = 0;
    const revealId = ++examplePromptRevealIdRef.current;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setExamplePromptReveal(reduceMotion ? null : { text: selectedPrompt, id: revealId });
    setQuery(selectedPrompt);
    if (promptGuideRef.current) promptGuideRef.current.open = false;
    requestAnimationFrame(() => {
      const input = promptInputRef.current;
      if (!input) return;
      input.style.height = 'auto';
      input.style.height = `${Math.min(110, input.scrollHeight)}px`;
      input.focus({ preventScroll: true });
    });
    if (reduceMotion) return;
    examplePromptRevealTimerRef.current = window.setTimeout(() => {
      setExamplePromptReveal(current => current?.id === revealId ? null : current);
      examplePromptRevealTimerRef.current = 0;
    }, 420 + Math.max(0, characters.length - 1) * 22 + 420);
  }

  function startExampleCardsDrag(event) {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    exampleCardsDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: event.currentTarget.scrollLeft,
      moved: false,
    };
  }

  function moveExampleCardsDrag(event) {
    const drag = exampleCardsDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    if (!drag.moved && Math.abs(deltaX) > 5) {
      drag.moved = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      setExampleCardsDragging(true);
    }
    if (drag.moved) {
      event.preventDefault();
      event.currentTarget.scrollLeft = drag.startScrollLeft - deltaX;
    }
  }

  function endExampleCardsDrag(event) {
    const drag = exampleCardsDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    suppressExampleCardClickRef.current = drag.moved;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    exampleCardsDragRef.current = null;
    setExampleCardsDragging(false);
    window.setTimeout(() => { suppressExampleCardClickRef.current = false; }, 0);
  }

  function handleExampleCardClickCapture(event) {
    if (!suppressExampleCardClickRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    suppressExampleCardClickRef.current = false;
  }

  function saveQuestions(text, source) {
    const result = csvToQuestions(text);
    if (result.error) throw new Error(result.error);
    const next = setCustomBank(result.questions, source, undefined, { title: result.title, description: result.description, create: true });
    setResultBank(next);
    setBankTitle(next.title || '');
    setBankDescription(next.description || '');
    onChange(next);
    setUploadSuccess(false);
    window.clearTimeout(uploadSuccessTimer.current);
    requestAnimationFrame(() => {
      setUploadSuccess(true);
      uploadSuccessTimer.current = window.setTimeout(() => setUploadSuccess(false), 1250);
    });
    setResultReady(false);
    window.clearTimeout(resultScreenTimer.current);
    window.clearTimeout(resultRevealTimer.current);
    resultScreenTimer.current = window.setTimeout(() => {
      setScreen('result');
      setUploadSuccess(false);
      resultRevealTimer.current = window.setTimeout(() => {
        setResultReady(true);
        setMetaReveal(true);
        window.clearTimeout(metaRevealTimer.current);
        metaRevealTimer.current = window.setTimeout(() => setMetaReveal(false), 1100);
      }, 520);
    }, 1180);
    setMessage('문제지 등록이 완료됐어요. 바로 풀어볼까요?');
  }

  function persistBankMeta() {
    try {
      const next = updateCustomBankMeta(bankTitle, bankDescription, undefined, displayBank?.id);
      if (next) {
        setResultBank(next);
        onChange(next);
      }
    } catch (metaError) {
      setError(metaError.message || '문제지 정보를 저장하지 못했어요.');
    }
  }

  async function upload(file) {
    if (!file || pending || sheetPending) return;
    setDragging(false);
    setError('');
    setMessage('');
    if (!/\.csv$/i.test(file.name)) { setError('CSV 파일만 등록할 수 있어요.'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('5MB 이하의 CSV 파일을 선택해주세요.'); return; }
    setPending(true);
    const startedAt = performance.now();
    try {
      const text = await file.text();
      const remaining = Math.max(0, 620 - (performance.now() - startedAt));
      if (remaining) await new Promise(resolve => window.setTimeout(resolve, remaining));
      saveQuestions(text, file.name);
    }
    catch (uploadError) { setError(uploadError.message || '파일을 읽지 못했습니다.'); }
    finally { setPending(false); }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shareError = params.get('shareError');
    const wasShared = params.get('shared') === '1';
    if (!wasShared && !shareError) return undefined;

    const cleanLocation = new URL(window.location.href);
    cleanLocation.searchParams.delete('shared');
    cleanLocation.searchParams.delete('shareError');
    window.history.replaceState(window.history.state, '', `${cleanLocation.pathname}${cleanLocation.search}${cleanLocation.hash}`);
    setScreen('upload');

    if (shareError) {
      setError(shareError === 'missing-file' ? '공유할 CSV 파일을 찾지 못했어요.' : '공유한 파일을 가져오지 못했어요. 다시 공유해주세요.');
      return undefined;
    }

    let cancelled = false;
    takeSharedFile().then(file => {
      if (cancelled) return;
      if (file) upload(file);
      else setError('공유한 파일을 찾지 못했어요. 파일을 다시 공유해주세요.');
    });
    return () => { cancelled = true; };
  }, []);

  async function importSheet() {
    if (sheetPending || pending) return;
    const value = sheetLink.trim();
    if (!value) { setError('구글 시트 공유 링크를 입력해주세요.'); return; }
    const exportUrl = extractSheetExportUrl(value);
    if (!exportUrl) { setError('올바른 구글 시트 공유 링크가 아닙니다.'); return; }
    setError('');
    setMessage('');
    setSheetPending(true);
    try {
      const response = await fetch(exportUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      const trimmed = text.trim().toLocaleLowerCase();
      if (trimmed.startsWith('<!doctype') || trimmed.startsWith('<html')) {
        throw new Error('private-sheet');
      }
      saveQuestions(text, 'Google Sheets');
      setSheetLink('');
    } catch (sheetError) {
      setError(sheetError.message === 'private-sheet'
        ? '구글 시트가 공개되어 있지 않아요. 공유 설정을 ‘링크가 있는 모든 사용자 · 뷰어’로 바꿔주세요.'
        : '구글 시트를 불러오지 못했어요. 공유 권한과 링크를 다시 확인해주세요.');
    } finally {
      setSheetPending(false);
    }
  }

  if (screen === 'result') return <main className="quiz-main mb-page-gutter quiz-creator creator-result-screen" id="quiz-creator" tabIndex={-1}>
    <button className="creator-result-back" type="button" onClick={() => { changeStep('create'); setResultBank(null); setResultReady(true); }}><ChevronLeft size={18} aria-hidden="true" />문제 만들기로 돌아가기</button>
    <div className="quiz-title creator-result-title"><div><h1 className="mb-page-title">문제 생성하기</h1></div></div>
    <CreatorProgress screen={screen} />
    <section className="creator-step creator-result-panel" aria-labelledby="creator-list-title">
      <header><CreatorStepMarker step="upload" label="등록 완료" /><div><h2 id="creator-list-title">문제지 등록 결과</h2><p>이름과 설명은 바로 수정할 수 있어요.</p></div></header>
      {!resultReady ? <div className="creator-preview-loading" role="status"><span className="mb-sr-only">생성한 문제지 목록을 정리하고 있어요</span><div className="creator-preview-skeleton-meta"><i /><i /></div><div className="creator-preview-skeleton-ready"><i /><span><b /><b /></span></div>{[0, 1, 2, 3].map(index => <div className="creator-preview-skeleton-row" key={index}><i /><span><b /><b /></span></div>)}</div> : displayBank ? <div className="creator-result-reveal">
        <div className={`creator-bank-meta${metaReveal ? ' is-revealing' : ''}`}>
          <label><span>문제지 이름</span><input type="text" value={bankTitle} maxLength={80} onChange={event => setBankTitle(event.target.value)} onBlur={persistBankMeta} /></label>
          <label><span>문제지 설명</span><input type="text" value={bankDescription} maxLength={160} onChange={event => setBankDescription(event.target.value)} onBlur={persistBankMeta} /></label>
        </div>
        <nav className="creator-result-actions" aria-label="문제지 등록 후 이동">
          <a className="creator-result-action-library" href="./quiz.html#paper-library"><BookOpen size={16} aria-hidden="true" />문제지 목록으로 가기</a>
          <a className="creator-result-action-solve" href={`./solve.html?paper=custom&bank=${encodeURIComponent(displayBank.id)}#quiz`}>문제풀이하기<ArrowRight size={16} aria-hidden="true" /></a>
        </nav>
        <div className="creator-ready" role="status"><span><Check size={18} aria-hidden="true" /></span><div><strong>문제지 등록이 완료됐어요</strong><p>{displayBank.source} · {displayBank.questions.length}문항</p></div></div>
        <div className="creator-question-list">{preview.map((question, index) => <article style={{ '--result-index': index }} key={question.id}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{question.q}</strong><p>{question.options.join(' · ')}</p></div></article>)}</div>
        {displayBank.questions.length > preview.length && <p className="creator-more">외 {displayBank.questions.length - preview.length}문항이 등록되어 있어요.</p>}
      </div> : null}
    </section>
    {message && <p className="creator-message" role="status">{message}</p>}
    {error && <p className="creator-error" role="alert">{error}</p>}
  </main>;

  return <main className="quiz-main mb-page-gutter quiz-creator is-step-flow" id="quiz-creator" tabIndex={-1}>
    {promptFocused && <button className="creator-prompt-backdrop" type="button" aria-label="프롬프트 입력 닫기" onPointerDown={event => { event.preventDefault(); promptInputRef.current?.blur(); }} />}
    <div className="quiz-title"><div><h1 className="mb-page-title">문제 생성하기</h1></div></div>
    <CreatorProgress screen={screen} />

    <div className="creator-intake-card">
    <section className="creator-step creator-prompt" aria-labelledby="creator-prompt-title" hidden={screen !== 'create'}>
      <header>
        <div className="creator-prompt-heading">
          <div className="creator-prompt-title-row">
            <h2 id="creator-prompt-title">무엇을 공부하고 있나요?</h2>
            <details className="creator-prompt-guide" ref={promptGuideRef} onToggle={event => { const open = event.currentTarget.open; setGuideOpen(open); setExampleRevealed(open); }}>
              <summary aria-label="문제 생성 요청 작성 가이드"><TooltipIcon /></summary>
              <div className="creator-prompt-guide-panel">
                <strong>이렇게 적어보세요</strong>
                <p><BookOpen size={16} aria-hidden="true" /><span><b>목표와 주제</b> {exampleGuide.topic}</span></p>
                <p><Gauge size={16} aria-hidden="true" /><span><b>난이도</b> {exampleGuide.level}</span></p>
                <p><ListChecks size={16} aria-hidden="true" /><span><b>범위</b> {exampleGuide.scope}</span></p>
                <div className={`creator-prompt-example${exampleRevealed ? ' is-revealed' : ''}`} style={{ '--example-total': examplePrompt.length }}>
                  <span className="creator-example-line"><q id="creator-prompt-example" aria-hidden={!exampleRevealed}>{[...examplePrompt].map((character, index) => <span style={{ '--example-index': index }} key={`${exampleIndex}-${character}-${index}`}>{character === ' ' ? '\u00a0' : character}</span>)}</q></span>
                </div>
                <div className="creator-prompt-guide-notice"><strong>AI Mode 사용 안내</strong><p>‘이 검색을 계속하시겠습니까?’와 ‘악의적인 질문으로 인해 안전하지 않거나 유해한 작업이 발생할 수 있습니다’ 안내가 나타날 수 있어요. 내용을 아래로 스크롤해 확인한 뒤 ‘예, 계속합니다.’를 눌러 주세요.</p></div>
              </div>
            </details>
          </div>
          <p>목표와 원하는 난이도를 구체적으로 적을수록 문제의 방향이 선명해져요.</p>
        </div>
      </header>
      <div className="creator-ai-prompt">
        <div className={`creator-ai-prompt-bar${promptFocused ? ' is-docked' : ''}${provider === 'chatgpt' ? ' is-chatgpt' : ' is-ai-mode'}`} ref={promptBarRef} onAnimationEnd={event => { if (event.animationName === 'creator-ai-shake') event.currentTarget.classList.remove('shake'); }}>
          <Search className="creator-ai-prompt-icon" aria-hidden="true" />
          <span className={`creator-ai-prompt-field${examplePromptReveal ? ' is-revealing' : ''}`}>
            <PromptSample hidden={screen !== 'create' || Boolean(query)} />
            {examplePromptReveal && <PromptReveal text={examplePromptReveal.text} id={examplePromptReveal.id} />}
            <textarea ref={promptInputRef} className={`creator-ai-prompt-input${examplePromptReveal ? ' is-example-revealing' : ''}`} value={query} onFocus={dockPrompt} onBlur={() => setPromptFocused(false)} onChange={event => { window.clearTimeout(examplePromptRevealTimerRef.current); examplePromptRevealTimerRef.current = 0; examplePromptRevealIdRef.current += 1; setExamplePromptReveal(null); setQuery(event.target.value); event.currentTarget.style.height = 'auto'; event.currentTarget.style.height = `${Math.min(110, event.currentTarget.scrollHeight)}px`; }} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); requestGeneration(); } }} aria-label="만들 문제의 목표, 주제와 난이도" rows="1" autoComplete="off" maxLength={1200} />
          </span>
          <div className="creator-ai-actions">
            <div onPointerDown={event => { if (promptFocused) event.preventDefault(); }}>
              <SegmentedControl ariaLabel="문제 생성 AI 선택" className="creator-provider" items={providerSegments} value={provider} onChange={setProvider} />
            </div>
            <button className={`creator-ai-prompt-btn${query.trim() ? '' : ' is-inactive'}`} type="button" onPointerDown={event => event.preventDefault()} onClick={requestGeneration}>문제 만들기</button>
          </div>
        </div>
      </div>
      <section className="creator-example-suggestions" aria-label="문제 생성 예시">
        <div className={`creator-example-cards${exampleCardsDragging ? ' is-dragging' : ''}`} role="region" aria-label="문제 생성 예시, 좌우로 넘겨 선택" tabIndex={0} onPointerDown={startExampleCardsDrag} onPointerMove={moveExampleCardsDrag} onPointerUp={endExampleCardsDrag} onPointerCancel={endExampleCardsDrag} onClickCapture={handleExampleCardClickCapture}>
          {exampleCardIndexes.map((exampleIndex, index) => {
            const example = exampleGuideDetails[exampleIndex];
            return <button className="creator-example-card is-revealing" type="button" key={exampleIndex} style={{ '--creator-example-reveal-delay': `${Math.min(index, 5) * 48}ms` }} aria-label={`${example.topic} 예시 사용`} onClick={() => useExample(examplePrompts[exampleIndex])}>
              <span className="creator-example-card-meta">{example.field}</span>
              <strong>{example.topic}</strong>
              <span className="creator-example-card-prompt">{examplePrompts[exampleIndex]}</span>
            </button>;
          })}
        </div>
      </section>
    </section>

    <section className="creator-step" aria-labelledby="creator-upload-title" hidden={screen !== 'upload'}>
      <header><div><h2 id="creator-upload-title">만든 파일을 등록하세요</h2><p>CSV 파일을 등록하거나 Google Sheets 공유 링크를 붙여넣으세요. 20문항부터 등록할 수 있어요.</p></div></header>
      <div
        className={`creator-drop is-revealed${dragging ? ' is-dragging' : ''}${uploadSuccess ? ' is-complete' : ''}`}
        onDragEnter={event => { event.preventDefault(); setDragging(true); }}
        onDragOver={event => event.preventDefault()}
        onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }}
        onDrop={event => { event.preventDefault(); upload(event.dataTransfer.files[0]); }}
      >
        <input ref={uploadInputRef} type="file" accept=".csv,text/csv" onChange={event => { upload(event.target.files[0]); event.target.value = ''; }} />
        {pending ? <span className="moonble-spinner" aria-hidden="true" /> : <Upload size={28} aria-hidden="true" />}
        <strong>{pending ? '문제를 확인하고 있어요' : 'CSV 파일을 여기에 놓으세요'}</strong>
        <p>또는</p>
        <button type="button" disabled={pending} onClick={() => uploadInputRef.current?.click()}>파일 선택</button>
        {uploadSuccess && <div className="creator-upload-complete" role="status"><span><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M13.5 24.8l7 7L35 17.5" /></svg></span><strong>문제지 등록 완료</strong></div>}
      </div>
      <div className="creator-source-divider"><span>또는</span></div>
      <div className="creator-sheet-link">
        <Link2 size={18} aria-hidden="true" />
        <input type="url" value={sheetLink} onChange={event => setSheetLink(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); importSheet(); } }} placeholder="Google Sheets 공유 링크 붙여넣기" aria-label="Google Sheets 공유 링크" />
        <button type="button" disabled={sheetPending || pending || !sheetLink.trim()} onClick={importSheet}>{sheetPending ? '가져오는 중' : '가져오기'}</button>
      </div>
      <div className="creator-upload-foot"><button className="creator-sample" type="button" onClick={downloadSampleCSV}><Download size={16} aria-hidden="true" />CSV 형식 먼저 보기</button><p>시트는 ‘링크가 있는 모든 사용자 · 뷰어’로 공유해주세요.</p></div>
      {custom && <button className="creator-recent-result" type="button" onClick={() => { setResultBank(custom); setBankTitle(custom.title || ''); setBankDescription(custom.description || ''); setResultReady(true); setScreen('result'); }}>최근 등록한 문제지 보기</button>}
    </section>
    {screen === 'create' ? <div className="creator-file-choice"><span>이미 파일이 있으신가요?</span><button type="button" onClick={() => changeStep('upload')}>파일 등록</button></div> : <button className="creator-step-link" type="button" disabled={pending || sheetPending || !resultReady} onClick={() => changeStep('create')}><ChevronLeft size={15} aria-hidden="true" />문제 만들기로 돌아가기</button>}
    </div>

    {message && <p className="creator-message" role="status">{message}</p>}
    {error && <p className="creator-error" role="alert">{error}</p>}
  </main>;
}
