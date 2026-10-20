import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Check, CircleHelp, Download, FileSpreadsheet, Gauge, Link2, ListChecks, Search, Upload } from 'lucide-react';
import { csvToQuestions, downloadSampleCSV, extractSheetExportUrl, getCustomBankMeta, setCustomBank } from './custom-bank.js';

function generationPrompt(query) {
  return `Moonble에서 풀 수 있는 학습 문제지를 만들어주세요.

사용자 요청:
${query}

다음 조건을 반드시 지켜주세요.
- 한국어 객관식 문제 20문항
- 문항마다 보기 4개, 정답, 짧고 명확한 해설 포함
- 사용자의 목적과 난이도 요청을 우선 반영
- 사실 확인이 필요한 내용은 최신 기준으로 검토
- 결과는 다운로드 가능한 UTF-8 CSV 파일로 제공
- 파일명은 moonble_questions.csv
- 첫 행 헤더는 정확히 다음 순서 사용
번호,question,option1,option2,option3,option4,correct,explain
- correct에는 정답 보기 번호를 1~4로 입력
- 복수 정답이면 1,3처럼 쉼표로 구분하고 해당 CSV 셀을 큰따옴표로 감싸기
- CSV 외의 부가 설명은 파일 내용에 넣지 않기`;
}

const promptSamples = [
  '정보처리기사 문제를 난이도 상으로 만들어줘',
  'SQL 조인 개념을 실무 난이도로 복습하고 싶어',
  'GA4 전자상거래 이벤트 문제를 만들어줘',
  '신입 기획자를 위한 데이터 분석 문제를 만들어줘',
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
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [sheetPending, setSheetPending] = useState(false);
  const [sheetLink, setSheetLink] = useState('');
  const [dragging, setDragging] = useState(false);
  const [promptFocused, setPromptFocused] = useState(false);
  const promptBarRef = useRef(null);
  const promptInputRef = useRef(null);
  const uploadInputRef = useRef(null);
  const preview = useMemo(() => custom?.questions?.slice(0, 8) || [], [custom]);

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

  function openPopup(url) {
    const screenWidth = window.screen.availWidth || window.screen.width;
    const screenHeight = window.screen.availHeight || window.screen.height;
    const width = Math.min(480, Math.max(320, screenWidth - 32));
    const height = Math.min(760, Math.max(560, screenHeight - 32));
    const left = Math.max(0, Math.round((screenWidth - width) / 2));
    const top = Math.max(0, Math.round((screenHeight - height) / 2));
    const popup = window.open(url, 'moonbleChatGPT', `popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`);
    if (!popup) window.open(url, '_blank', 'noopener');
    else popup.focus();
  }

  function requestGeneration() {
    const value = query.trim();
    if (!value) { shakePrompt(); return; }
    setError('');
    const url = `https://chatgpt.com/?q=${encodeURIComponent(generationPrompt(value))}`;
    openPopup(url);
    setQuery('');
    if (promptInputRef.current) {
      promptInputRef.current.style.height = 'auto';
      promptInputRef.current.blur();
    }
    setMessage('문제 생성 요청을 열었어요. CSV 파일을 내려받은 뒤 아래 영역에 올려주세요.');
  }

  function saveQuestions(text, source) {
    const result = csvToQuestions(text);
    if (result.error) throw new Error(result.error);
    setCustomBank(result.questions, source);
    const next = getCustomBankMeta();
    onChange(next);
    setMessage('문제지 등록이 완료됐어요. 바로 풀어볼까요?');
  }

  async function upload(file) {
    if (!file || pending || sheetPending) return;
    setDragging(false);
    setError('');
    setMessage('');
    if (!/\.csv$/i.test(file.name)) { setError('CSV 파일만 등록할 수 있어요.'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('5MB 이하의 CSV 파일을 선택해주세요.'); return; }
    setPending(true);
    try { saveQuestions(await file.text(), file.name); }
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

  return <main className="quiz-main quiz-creator" id="quiz-creator" tabIndex={-1}>
    <div className="quiz-title"><div><span className="creator-eyebrow">문제 생성하기</span><h1 className="mb-page-title">필요한 문제를 바로 준비하세요</h1><p>원하는 내용을 설명하고, 생성된 CSV를 등록하면 곧바로 문제를 풀 수 있어요.</p></div></div>

    <section className="creator-step creator-prompt" aria-labelledby="creator-prompt-title">
      <details className="creator-prompt-guide">
        <summary aria-label="문제 생성 요청 작성 가이드"><CircleHelp size={20} aria-hidden="true" /></summary>
        <div className="creator-prompt-guide-panel">
          <strong>이렇게 적어보세요</strong>
          <p><BookOpen size={16} aria-hidden="true" /><span><b>목표와 주제</b> 정보처리기사 필기</span></p>
          <p><Gauge size={16} aria-hidden="true" /><span><b>난이도</b> 바로 시험을 볼 수 있는 상급</span></p>
          <p><ListChecks size={16} aria-hidden="true" /><span><b>범위</b> 데이터베이스와 SQL 중심</span></p>
          <q>정보처리기사 필기를 준비하고 있어. 데이터베이스와 SQL 중심으로 상급 문제를 만들어줘.</q>
        </div>
      </details>
      <header><span>1</span><div><h2 id="creator-prompt-title">무엇을 공부하고 있나요?</h2><p>목표와 원하는 난이도를 구체적으로 적을수록 문제의 방향이 선명해져요.</p></div></header>
      <div className="creator-ai-prompt">
        <div className={`creator-ai-prompt-bar${promptFocused ? ' is-docked' : ''}`} ref={promptBarRef} onAnimationEnd={event => { if (event.animationName === 'creator-ai-shake') event.currentTarget.classList.remove('shake'); }}>
          <Search className="creator-ai-prompt-icon" aria-hidden="true" />
          <span className="creator-ai-prompt-field">
            <PromptSample hidden={Boolean(query)} />
            <textarea ref={promptInputRef} className="creator-ai-prompt-input" value={query} onFocus={() => setPromptFocused(true)} onBlur={() => setPromptFocused(false)} onChange={event => { setQuery(event.target.value); event.currentTarget.style.height = 'auto'; event.currentTarget.style.height = `${Math.min(110, event.currentTarget.scrollHeight)}px`; }} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); requestGeneration(); } }} aria-label="만들 문제의 목표, 주제와 난이도" rows="1" autoComplete="off" maxLength={1200} />
          </span>
          <button className={`creator-ai-prompt-btn${query.trim() ? '' : ' is-inactive'}`} type="button" onPointerDown={event => event.preventDefault()} onClick={requestGeneration}>문제 만들기</button>
        </div>
      </div>
    </section>

    <section className="creator-step" aria-labelledby="creator-upload-title">
      <header><span>2</span><div><h2 id="creator-upload-title">만든 파일을 등록하세요</h2><p>ChatGPT에서 받은 CSV를 끌어다 놓거나 직접 선택하세요. 20문항부터 등록할 수 있어요.</p></div></header>
      <div
        className={`creator-drop${dragging ? ' is-dragging' : ''}`}
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
      </div>
      <div className="creator-source-divider"><span>또는</span></div>
      <div className="creator-sheet-link">
        <Link2 size={18} aria-hidden="true" />
        <input type="url" value={sheetLink} onChange={event => setSheetLink(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); importSheet(); } }} placeholder="Google Sheets 공유 링크 붙여넣기" aria-label="Google Sheets 공유 링크" />
        <button type="button" disabled={sheetPending || pending} onClick={importSheet}>{sheetPending ? '가져오는 중' : '가져오기'}</button>
      </div>
      <div className="creator-upload-foot"><button className="creator-sample" type="button" onClick={downloadSampleCSV}><Download size={16} aria-hidden="true" />CSV 형식 먼저 보기</button><p>시트는 ‘링크가 있는 모든 사용자 · 뷰어’로 공유해주세요.</p></div>
    </section>

    <section className="creator-step" aria-labelledby="creator-list-title">
      <header><span>3</span><div><h2 id="creator-list-title">등록된 문제를 확인하세요</h2><p>문제와 보기가 제대로 들어왔는지 확인한 뒤 풀이를 시작하세요.</p></div></header>
      {custom ? <>
        <div className="creator-ready" role="status"><span><Check size={18} aria-hidden="true" /></span><div><strong>문제지 등록이 완료됐어요</strong><p>{custom.source} · {custom.questions.length}문항</p></div><a href="./solve.html?paper=custom#quiz">문제 풀이하기</a></div>
        <div className="creator-question-list">{preview.map((question, index) => <article key={question.id}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{question.q}</strong><p>{question.options.join(' · ')}</p></div></article>)}</div>
        {custom.questions.length > preview.length && <p className="creator-more">외 {custom.questions.length - preview.length}문항이 등록되어 있어요.</p>}
      </> : <div className="creator-empty"><FileSpreadsheet size={30} aria-hidden="true" /><strong>아직 등록된 문제가 없어요</strong><p>위에서 만든 CSV를 등록하면 문제 목록이 여기에 나타납니다.</p></div>}
    </section>

    {message && <p className="creator-message" role="status">{message}</p>}
    {error && <p className="creator-error" role="alert">{error}</p>}
  </main>;
}
