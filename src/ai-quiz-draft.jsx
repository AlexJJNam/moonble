import React, { useState } from 'react';
import './ai-quiz-draft.css';

import { validateAiDraft } from './ai-quiz-draft-validation.js';

export function AiQuizDraft({ initial, onBack, onSave }) {
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const updateQuestion = (index, changes) => setDraft(current => ({ ...current, questions: current.questions.map((item, i) => i === index ? { ...item, ...changes } : item) }));
  const save = async () => {
    if (saving) return;
    const invalid = validateAiDraft(draft);
    if (invalid) { setError(invalid); return; }
    setError(''); setSaving(true);
    try { await onSave({ ...draft, title: draft.title.trim(), description: draft.description.trim(), questions: draft.questions.map(question => ({ ...question, q: question.q.trim(), options: question.options.map(option => option.trim()), explain: question.explain.trim() })) }); }
    catch (cause) { setError(cause?.message || '문제지를 저장하지 못했어요.'); setSaving(false); }
  };
  return <main className="quiz-main mb-page-gutter quiz-creator creator-result-screen ai-quiz-draft" id="quiz-creator" tabIndex={-1}>
    <button className="creator-result-back" type="button" disabled={saving} onClick={onBack}>문제 만들기로 돌아가기</button>
    <div className="quiz-title creator-result-title"><div><h1 className="mb-page-title">생성한 문제 확인</h1></div></div>
    <p className="ai-quiz-draft-caption">생성된 문항과 정답을 확인하고 수정한 뒤 저장해 주세요.</p>
    <div className="creator-bank-meta ai-quiz-draft-meta">
      <label><span>문제지 이름</span><input value={draft.title} maxLength={80} onChange={event => setDraft(current => ({ ...current, title: event.target.value }))} /></label>
      <label><span>문제지 설명</span><input value={draft.description} maxLength={160} onChange={event => setDraft(current => ({ ...current, description: event.target.value }))} /></label>
    </div>
    <div className="ai-quiz-draft-list">{draft.questions.map((question, index) => <details className="ai-quiz-draft-item" key={question.id}>
      <summary><span>Q{index + 1}</span><strong>{question.q || '질문을 입력해 주세요'}</strong></summary>
      <div className="ai-quiz-draft-fields">
        <label>질문<textarea maxLength={2000} value={question.q} onChange={event => updateQuestion(index, { q: event.target.value })} /></label>
        <fieldset><legend>보기와 정답</legend>{question.options.map((option, optionIndex) => <label className="ai-quiz-draft-option" key={optionIndex}><input type="radio" name={`ai-answer-${index}`} checked={question.correct[0] === optionIndex} onChange={() => updateQuestion(index, { correct: [optionIndex] })} aria-label={`${optionIndex + 1}번이 정답`} /><input value={option} maxLength={500} aria-label={`${optionIndex + 1}번 보기`} onChange={event => updateQuestion(index, { options: question.options.map((value, i) => i === optionIndex ? event.target.value : value) })} /></label>)}</fieldset>
        <label>해설<textarea maxLength={2000} value={question.explain} onChange={event => updateQuestion(index, { explain: event.target.value })} /></label>
      </div>
    </details>)}</div>
    {error && <p className="ai-quiz-draft-error" role="alert">{error}</p>}
    <div className="ai-quiz-draft-actions"><button type="button" disabled={saving} onClick={onBack}>취소</button><button type="button" disabled={saving} onClick={save}>{saving ? '저장 중' : '문제지 저장'}</button></div>
  </main>;
}
