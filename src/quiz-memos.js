const QUIZ_MEMO_LIMIT = 24;

export function quizMemoPaperKey(paper = {}) {
  if (paper.shareId) return `shared:${paper.shareId}`;
  if (paper.bankId) return `custom:${paper.bankId}`;
  if (paper.paperId && paper.paperId !== 'shared' && paper.paperId !== 'retry') return String(paper.paperId);
  const title = typeof paper.title === 'string' ? paper.title.trim() : '';
  return `${paper.paperId || 'paper'}:${title || 'current'}`;
}

function storageKey(paperOrKey) {
  const key = typeof paperOrKey === 'string' ? paperOrKey : quizMemoPaperKey(paperOrKey);
  return `moonble:quiz-memos-v1:${encodeURIComponent(key)}`;
}

export function readQuizMemos(paperOrKey) {
  try {
    const value = JSON.parse(sessionStorage.getItem(storageKey(paperOrKey)) || '[]');
    return Array.isArray(value)
      ? value.filter(item => item && typeof item.id === 'string' && (typeof item.text === 'string' || typeof item.imageData === 'string')).slice(-QUIZ_MEMO_LIMIT)
      : [];
  } catch { return []; }
}

function publishQuizMemos(paperOrKey, memos) {
  const key = typeof paperOrKey === 'string' ? paperOrKey : quizMemoPaperKey(paperOrKey);
  try { sessionStorage.setItem(storageKey(key), JSON.stringify(memos)); }
  catch { /* 메모는 현재 화면에서 계속 쓸 수 있다. */ }
  window.dispatchEvent(new CustomEvent('moonble:quiz-memos-change', { detail: { paperKey: key, memos } }));
  return memos;
}

export function addQuizMemo(paper, text) {
  const value = typeof text === 'string' ? text.trim().slice(0, 500) : '';
  if (!value) return readQuizMemos(paper);
  const id = globalThis.crypto?.randomUUID?.() || `memo-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const memo = { id, text: value, createdAt: Date.now() };
  return publishQuizMemos(paper, [...readQuizMemos(paper), memo].slice(-QUIZ_MEMO_LIMIT));
}

export function addQuizMemoImage(paper, imageData) {
  if (typeof imageData !== 'string' || !imageData.startsWith('data:image/')) return readQuizMemos(paper);
  const id = globalThis.crypto?.randomUUID?.() || `memo-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const memo = { id, imageData, createdAt: Date.now() };
  return publishQuizMemos(paper, [...readQuizMemos(paper), memo].slice(-QUIZ_MEMO_LIMIT));
}

export function removeQuizMemo(paperOrKey, memoId) {
  return publishQuizMemos(paperOrKey, readQuizMemos(paperOrKey).filter(item => item.id !== memoId));
}
