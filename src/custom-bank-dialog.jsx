import React, { useEffect, useRef, useState } from 'react';
import { Download, X } from 'lucide-react';
import { getCustomBankMeta, setCustomBank, clearCustomBank, csvToQuestions, downloadSampleCSV, extractSheetExportUrl } from './custom-bank.js';
import './custom-bank-dialog.css';

export function CustomBankDialog({ onClose, onChange }) {
  const dialog = useRef(null);
  const request = useRef(null);
  const alive = useRef(true);
  const [active, setActive] = useState(getCustomBankMeta);
  const [link, setLink] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    dialog.current.showModal();
    document.body.style.overflow = 'hidden';
    return () => { alive.current = false; request.current?.abort(); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  function save(text, source) {
    const result = csvToQuestions(text);
    if (result.error) throw new Error(result.error);
    setCustomBank(result.questions, source);
    onChange(getCustomBankMeta());
    onClose();
  }
  async function fileSelected(file) {
    if (!file || pending) return;
    setError('');
    if (!/\.csv$/i.test(file.name)) { setError('CSV 파일만 업로드할 수 있어요. 엑셀 파일은 CSV로 저장한 뒤 올려주세요.'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('5MB 이하의 CSV 파일을 선택해주세요.'); return; }
    setPending(true);
    try { const text = await file.text(); if (alive.current) save(text, file.name); }
    catch (e) { if (alive.current) setError(e.message); }
    finally { if (alive.current) setPending(false); }
  }
  async function importSheet(event) {
    event.preventDefault();
    if (pending) return;
    const url = extractSheetExportUrl(link.trim());
    if (!url) { setError('올바른 구글 시트 공유 링크를 입력해주세요.'); return; }
    setError(''); setPending(true);
    const controller = new AbortController(); request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error('구글 시트를 불러오지 못했습니다. 공유 권한을 확인해주세요.');
      const text = await response.text();
      if (/^\s*<(?:!doctype|html)/i.test(text)) throw new Error('구글 시트 공유 권한을 "링크 있는 사람 모두 뷰어"로 설정해주세요.');
      if (alive.current) save(text, '구글 시트');
    } catch (e) { if (alive.current) setError(e.name === 'AbortError' ? '연결 시간이 초과됐습니다. 다시 시도해주세요.' : e.message); }
    finally { clearTimeout(timeout); if (alive.current) setPending(false); }
  }
  function remove() {
    try { clearCustomBank(); setActive(null); onChange(null); setError(''); }
    catch (e) { setError(e.message); }
  }
  return <dialog className="bank-dialog" ref={dialog} aria-labelledby="bank-title" aria-describedby="bank-description" onCancel={onClose} onClick={e => { if (e.target === dialog.current) { const r = dialog.current.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose(); } }}>
    <header><h2 id="bank-title">커스텀 문제 출제</h2><button className="bank-close" aria-label="닫기" onClick={onClose}><X size={20} /></button></header>
    <p id="bank-description">직접 만든 문제로 퀴즈를 풀 수 있어요. CSV 파일을 올리거나, “링크 있는 사람 모두 뷰어”로 공유된 구글 시트 링크를 붙여넣으세요. 최소 20문항이 필요합니다.</p>
    {active ? <div className="bank-active"><strong>{active.source} · {active.questions.length}문항 등록됨</strong><p>이 브라우저에 커스텀 문제지 1개를 저장할 수 있어요. 새 문제지를 등록하려면 기존 문제지를 삭제해주세요.</p><button className="bank-secondary" onClick={remove}>기존 문제지 삭제</button></div> : <>
      <button className="bank-secondary" onClick={downloadSampleCSV}><Download size={16} />샘플 CSV 다운로드</button>
      <div className="bank-drop" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); fileSelected(e.dataTransfer.files[0]); }}><label htmlFor="bank-file">클릭하거나 CSV 파일을 여기로 끌어다 놓으세요</label><input id="bank-file" type="file" accept=".csv,text/csv" disabled={pending} onChange={e => { fileSelected(e.target.files[0]); e.target.value = ''; }} /></div>
      <div className="bank-divider">또는</div>
      <form className="bank-link" onSubmit={importSheet}><label className="mb-sr-only" htmlFor="bank-link-input">구글 시트 공유 링크</label><input id="bank-link-input" type="url" placeholder="구글 시트 공유 링크 붙여넣기" required value={link} disabled={pending} onChange={e => setLink(e.target.value)} /><button disabled={pending} aria-label={pending ? '문제지 가져오는 중' : undefined}>{pending ? <span className="moonble-spinner" aria-hidden="true" /> : '가져오기'}</button></form>
      <ul className="bank-guide"><li>컬럼: 번호, question, option1~option4, correct, explain(선택)</li><li>정답은 보기 번호(1~4), 복수 정답은 1,3처럼 콤마로 구분해요.</li><li>최소 20문항이 필요하며, 등록 후 목록에서 선택해 풀 수 있어요.</li></ul>
    </>}
    {pending && <p role="status"><span className="moonble-spinner" aria-hidden="true" /><span className="mb-sr-only">문제지 불러오는 중</span></p>}
    {error && <p className="bank-error" role="alert">{error}</p>}
  </dialog>;
}
