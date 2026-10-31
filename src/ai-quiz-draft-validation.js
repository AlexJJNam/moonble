export function validateAiDraft(draft) {
  if (typeof draft?.title !== 'string' || !draft.title.trim() || draft.title.trim().length > 80 || typeof draft?.description !== 'string' || !draft.description.trim() || draft.description.trim().length > 160 || !Array.isArray(draft.questions) || draft.questions.length !== 20) return '문제지 이름, 설명과 20개 문항을 확인해 주세요.';
  const seen = new Set();
  const key = value => value.trim().normalize('NFKC').replace(/\s+/g, '').toLowerCase();
  for (const [index, question] of draft.questions.entries()) {
    if (!question || typeof question.q !== 'string' || !question.q.trim() || question.q.length > 2000 || typeof question.explain !== 'string' || !question.explain.trim() || question.explain.length > 2000 || !Array.isArray(question.options) || question.options.length !== 4 || question.options.some(option => typeof option !== 'string' || !option.trim() || option.length > 500) || new Set(question.options.map(key)).size !== 4 || !Array.isArray(question.correct) || question.correct.length !== 1 || !Number.isInteger(question.correct[0]) || question.correct[0] < 0 || question.correct[0] > 3 || !Number.isInteger(question.id) || seen.has(key(question.q))) return `${index + 1}번 문항의 질문, 보기, 정답과 해설을 확인해 주세요.`;
    seen.add(key(question.q));
  }
  return '';
}
