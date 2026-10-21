import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Check, ChevronLeft, CircleHelp, Download, Gauge, Link2, ListChecks, Search, Upload } from 'lucide-react';
import { csvToQuestions, downloadSampleCSV, extractSheetExportUrl, setCustomBank, updateCustomBankMeta } from './custom-bank.js';
import { SegmentedControl } from './segmented-control.jsx';

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
];
const providerSegments = [
  { value: 'chatgpt', label: 'ChatGPT' },
  { value: 'gemini', label: 'Gemini' },
];

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

export function QuizCreator({ custom, onChange }) {
  const [query, setQuery] = useState('');
  const [provider, setProvider] = useState('chatgpt');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [sheetPending, setSheetPending] = useState(false);
  const [sheetLink, setSheetLink] = useState('');
  const [dragging, setDragging] = useState(false);
  const [promptFocused, setPromptFocused] = useState(false);
  const [exampleRevealed, setExampleRevealed] = useState(false);
  const [exampleIndex, setExampleIndex] = useState(0);
  const [guideOpen, setGuideOpen] = useState(false);
  const [uploadRevealed, setUploadRevealed] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [metaReveal, setMetaReveal] = useState(false);
  const [screen, setScreen] = useState('create');
  const [resultBank, setResultBank] = useState(null);
  const [resultReady, setResultReady] = useState(true);
  const [bankTitle, setBankTitle] = useState(custom?.title || '');
  const [bankDescription, setBankDescription] = useState(custom?.description || '');
  const promptBarRef = useRef(null);
  const promptInputRef = useRef(null);
  const promptGuideRef = useRef(null);
  const uploadInputRef = useRef(null);
  const uploadSuccessTimer = useRef(0);
  const metaRevealTimer = useRef(0);
  const resultScreenTimer = useRef(0);
  const resultRevealTimer = useRef(0);
  const displayBank = resultBank || custom;
  const preview = useMemo(() => displayBank?.questions?.slice(0, 8) || [], [displayBank]);
  const examplePrompt = examplePrompts[exampleIndex];

  useEffect(() => {
    if (resultBank && custom?.id !== resultBank.id) return;
    setBankTitle(custom?.title || '');
    setBankDescription(custom?.description || '');
  }, [custom?.title, custom?.description, custom?.savedAt]);

  useEffect(() => () => {
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
      setExampleRevealed(false);
    }, 4800);
    return () => window.clearInterval(timer);
  }, [guideOpen]);

  useEffect(() => {
    if (!promptFocused) return undefined;
    const viewport = window.visualViewport;
    const updateKeyboardOffset = () => {
      const bar = promptBarRef.current;
      if (!bar || !viewport) return;
      const keyboardGap = Math.max(0, window.innerHeight - (viewport.offsetTop + viewport.height));
      bar.style.setProperty('--creator-keyboard-offset', `${keyboardGap}px`);
    };
    updateKeyboardOffset();
    viewport?.addEventListener('resize', updateKeyboardOffset);
    viewport?.addEventListener('scroll', updateKeyboardOffset);
    return () => {
      viewport?.removeEventListener('resize', updateKeyboardOffset);
      viewport?.removeEventListener('scroll', updateKeyboardOffset);
      promptBarRef.current?.style.removeProperty('--creator-keyboard-offset');
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
    const bar = promptBarRef.current;
    const before = bar?.getBoundingClientRect();
    setPromptFocused(true);
    if (!bar || !before || !window.matchMedia?.('(max-width: 540px)').matches) return;
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      const after = bar.getBoundingClientRect();
      const deltaX = before.left - after.left;
      const deltaY = before.top - after.top;
      if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) return;
      const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if (reducedMotion) return;
      bar.animate?.([
        { transform: `translate3d(${deltaX}px, ${deltaY}px, 0)`, opacity: .88 },
        { transform: 'translate3d(0, 0, 0)', opacity: 1 },
      ], { duration: 340, easing: 'cubic-bezier(.2,.82,.24,1)' });
    }));
  }

  function openPopup(url) {
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
    const value = query.trim();
    if (!value) { shakePrompt(); return; }
    setError('');
    const prompt = encodeURIComponent(generationPrompt(value, provider));
    const url = provider === 'gemini' ? `https://www.google.com/search?q=${prompt}&udm=50` : `https://chatgpt.com/?q=${prompt}`;
    openPopup(url);
    setQuery('');
    if (promptInputRef.current) {
      promptInputRef.current.style.height = 'auto';
      promptInputRef.current.blur();
    }
    setMessage(provider === 'gemini'
      ? 'Gemini에 문제 생성 요청을 열었어요. 완성된 Google Sheets 링크를 아래에 붙여넣어주세요.'
      : 'ChatGPT에 문제 생성 요청을 열었어요. CSV 파일을 내려받은 뒤 아래 영역에 올려주세요.');
  }

  function useExample() {
    setQuery(examplePrompt);
    if (promptGuideRef.current) promptGuideRef.current.open = false;
    requestAnimationFrame(() => {
      const input = promptInputRef.current;
      if (!input) return;
      input.style.height = 'auto';
      input.style.height = `${Math.min(110, input.scrollHeight)}px`;
      input.focus();
      input.setSelectionRange(examplePrompt.length, examplePrompt.length);
    });
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

  if (screen === 'result') return <main className="quiz-main quiz-creator creator-result-screen" id="quiz-creator" tabIndex={-1}>
    <button className="creator-result-back" type="button" onClick={() => { setScreen('create'); setResultBank(null); setResultReady(true); }}><ChevronLeft size={18} aria-hidden="true" />문제 만들기로 돌아가기</button>
    <div className="quiz-title creator-result-title"><div><span className="creator-eyebrow">문제 생성하기</span><h1 className="mb-page-title">등록된 문제를 확인하세요</h1><p>문제와 보기가 제대로 들어왔는지 확인한 뒤 풀이를 시작하세요.</p></div></div>
    <section className="creator-step creator-result-panel" aria-labelledby="creator-list-title">
      <header><span>3</span><div><h2 id="creator-list-title">문제지 등록 결과</h2><p>이름과 설명은 바로 수정할 수 있어요.</p></div></header>
      {!resultReady ? <div className="creator-preview-loading" role="status"><span className="mb-sr-only">생성한 문제지 목록을 정리하고 있어요</span><div className="creator-preview-skeleton-meta"><i /><i /></div><div className="creator-preview-skeleton-ready"><i /><span><b /><b /></span></div>{[0, 1, 2, 3].map(index => <div className="creator-preview-skeleton-row" key={index}><i /><span><b /><b /></span></div>)}</div> : displayBank ? <div className="creator-result-reveal">
        <div className={`creator-bank-meta${metaReveal ? ' is-revealing' : ''}`}>
          <label><span>문제지 이름</span><input type="text" value={bankTitle} maxLength={80} onChange={event => setBankTitle(event.target.value)} onBlur={persistBankMeta} /></label>
          <label><span>문제지 설명</span><input type="text" value={bankDescription} maxLength={160} onChange={event => setBankDescription(event.target.value)} onBlur={persistBankMeta} /></label>
        </div>
        <div className="creator-ready" role="status"><span><Check size={18} aria-hidden="true" /></span><div><strong>문제지 등록이 완료됐어요</strong><p>{displayBank.source} · {displayBank.questions.length}문항</p></div><a href={`./solve.html?paper=custom&bank=${encodeURIComponent(displayBank.id)}#quiz`}>문제 풀이하기</a></div>
        <div className="creator-question-list">{preview.map((question, index) => <article style={{ '--result-index': index }} key={question.id}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{question.q}</strong><p>{question.options.join(' · ')}</p></div></article>)}</div>
        {displayBank.questions.length > preview.length && <p className="creator-more">외 {displayBank.questions.length - preview.length}문항이 등록되어 있어요.</p>}
      </div> : null}
    </section>
    {message && <p className="creator-message" role="status">{message}</p>}
    {error && <p className="creator-error" role="alert">{error}</p>}
  </main>;

  return <main className="quiz-main quiz-creator" id="quiz-creator" tabIndex={-1}>
    <div className="quiz-title"><div><span className="creator-eyebrow">문제 생성하기</span><h1 className="mb-page-title">필요한 문제를 바로 준비하세요</h1><p>원하는 내용을 설명하고, 생성된 CSV를 등록하면 곧바로 문제를 풀 수 있어요.</p></div></div>

    <section className="creator-step creator-prompt" aria-labelledby="creator-prompt-title">
      <details className="creator-prompt-guide" ref={promptGuideRef} onToggle={event => { const open = event.currentTarget.open; setGuideOpen(open); if (!open) setExampleRevealed(false); }}>
        <summary aria-label="문제 생성 요청 작성 가이드"><CircleHelp size={20} aria-hidden="true" /></summary>
        <div className="creator-prompt-guide-panel">
          <strong>이렇게 적어보세요</strong>
          <p><BookOpen size={16} aria-hidden="true" /><span><b>목표와 주제</b> 정보처리기사 필기</span></p>
          <p><Gauge size={16} aria-hidden="true" /><span><b>난이도</b> 바로 시험을 볼 수 있는 상급</span></p>
          <p><ListChecks size={16} aria-hidden="true" /><span><b>범위</b> 데이터베이스와 SQL 중심</span></p>
          <div className={`creator-prompt-example${exampleRevealed ? ' is-revealed' : ''}`} style={{ '--example-total': examplePrompt.length }}>
            <span className="creator-example-line"><q id="creator-prompt-example" aria-hidden={!exampleRevealed}>{[...examplePrompt].map((character, index) => <span style={{ '--example-index': index }} key={`${character}-${index}`}>{character === ' ' ? '\u00a0' : character}</span>)}</q>{exampleRevealed && <button className="creator-example-use" type="button" onClick={useExample}>예시 사용</button>}</span>
            {!exampleRevealed
              ? <button className="creator-example-reveal" type="button" aria-controls="creator-prompt-example" aria-expanded="false" onClick={() => setExampleRevealed(true)}>예시 보기</button>
              : null}
          </div>
        </div>
      </details>
      <header><span>1</span><div><h2 id="creator-prompt-title">무엇을 공부하고 있나요?</h2><p>목표와 원하는 난이도를 구체적으로 적을수록 문제의 방향이 선명해져요.</p></div></header>
      <div className="creator-ai-prompt">
        <div className={`creator-ai-prompt-bar${promptFocused ? ' is-docked' : ''}`} ref={promptBarRef} onAnimationEnd={event => { if (event.animationName === 'creator-ai-shake') event.currentTarget.classList.remove('shake'); }}>
          <Search className="creator-ai-prompt-icon" aria-hidden="true" />
          <span className="creator-ai-prompt-field">
            <PromptSample hidden={Boolean(query)} />
            <textarea ref={promptInputRef} className="creator-ai-prompt-input" value={query} onFocus={dockPrompt} onBlur={() => setPromptFocused(false)} onChange={event => { setQuery(event.target.value); event.currentTarget.style.height = 'auto'; event.currentTarget.style.height = `${Math.min(110, event.currentTarget.scrollHeight)}px`; }} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); requestGeneration(); } }} aria-label="만들 문제의 목표, 주제와 난이도" rows="1" autoComplete="off" maxLength={1200} />
          </span>
          <div className="creator-ai-actions">
            <div onPointerDown={event => { if (promptFocused) event.preventDefault(); }}>
              <SegmentedControl ariaLabel="문제 생성 AI 선택" className="creator-provider" items={providerSegments} value={provider} onChange={setProvider} />
            </div>
            <button className={`creator-ai-prompt-btn${query.trim() ? '' : ' is-inactive'}`} type="button" onPointerDown={event => event.preventDefault()} onClick={requestGeneration}>문제 만들기</button>
          </div>
        </div>
      </div>
    </section>

    <section className="creator-step" aria-labelledby="creator-upload-title">
      <header><span>2</span><div><h2 id="creator-upload-title">만든 파일을 등록하세요</h2><p>CSV 파일을 등록하거나 Google Sheets 공유 링크를 붙여넣으세요. 20문항부터 등록할 수 있어요.</p></div></header>
      <div
        className={`creator-drop${uploadRevealed ? ' is-revealed' : ' is-concealed'}${dragging ? ' is-dragging' : ''}${uploadSuccess ? ' is-complete' : ''}`}
        onDragEnter={event => { event.preventDefault(); setUploadRevealed(true); setDragging(true); }}
        onDragOver={event => event.preventDefault()}
        onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }}
        onDrop={event => { event.preventDefault(); upload(event.dataTransfer.files[0]); }}
      >
        <input ref={uploadInputRef} type="file" accept=".csv,text/csv" onChange={event => { upload(event.target.files[0]); event.target.value = ''; }} />
        {pending ? <span className="moonble-spinner" aria-hidden="true" /> : <Upload size={28} aria-hidden="true" />}
        <strong>{pending ? '문제를 확인하고 있어요' : 'CSV 파일을 여기에 놓으세요'}</strong>
        <p>또는</p>
        <button type="button" disabled={pending} onClick={() => uploadInputRef.current?.click()}>파일 선택</button>
        {!uploadRevealed && <button className="creator-drop-reveal" type="button" aria-label="CSV 업로드 영역 보기" onClick={() => setUploadRevealed(true)}>업로드 영역 보기</button>}
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

    {message && <p className="creator-message" role="status">{message}</p>}
    {error && <p className="creator-error" role="alert">{error}</p>}
  </main>;
}
