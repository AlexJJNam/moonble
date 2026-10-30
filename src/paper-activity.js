const PAPER_ACTIVITY_VERSION = 1;

function activityStorageKey(userId) {
  return userId ? `moonble:user:${userId}:paper-activity-v${PAPER_ACTIVITY_VERSION}` : null;
}

export function getPaperAccessMap(userId) {
  try {
    const key = activityStorageKey(userId);
    const value = key ? JSON.parse(localStorage.getItem(key) || '{}') : {};
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

export function getPaperLastActivityMap(userId) {
  const latestByPaper = { ...getPaperAccessMap(userId) };
  if (!userId) return latestByPaper;

  try {
    const history = JSON.parse(localStorage.getItem(`moonble:user:${userId}:history-v3`) || '[]');
    if (!Array.isArray(history)) return latestByPaper;

    history.forEach(item => {
      const paperKey = item?.bankId
        ? `custom:${item.bankId}`
        : (['basics', 'advanced', 'random'].includes(item?.paperId) ? item.paperId : null);
      const timestamp = item?.date;
      const time = timestamp ? new Date(timestamp).getTime() : NaN;
      if (!paperKey || !Number.isFinite(time)) return;

      const previousTime = latestByPaper[paperKey] ? new Date(latestByPaper[paperKey]).getTime() : NaN;
      if (!Number.isFinite(previousTime) || time > previousTime) latestByPaper[paperKey] = timestamp;
    });
  } catch {
    // Invalid or unavailable history should not interrupt the library view.
  }

  return latestByPaper;
}

export function recordPaperAccess(userId, paperKey, accessedAt = new Date().toISOString()) {
  const key = activityStorageKey(userId);
  if (!key || typeof paperKey !== 'string' || !paperKey) return {};
  const next = { ...getPaperAccessMap(userId), [paperKey]: accessedAt };
  try {
    localStorage.setItem(key, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('moonble:paper-access', { detail: { userId, paperKey, accessedAt } }));
  } catch {
    // Private browsing/storage limits should not interrupt opening a paper.
  }
  return next;
}

// 카드에 보일 풀이 상태(시간과 별개).
// - 저장된 풀이(문제풀이 화면의 임시 저장)에 답한 문항이 있으면: 풀이 중 진행률
// - 풀이 기록이 한 번도 없으면: 풀이 전
// - 그 밖(풀이를 마친 문제지)은 상태 없음
export function getPaperSolveStatus(userId, paperKey) {
  if (!userId || !paperKey) return null;
  try {
    const draft = JSON.parse(localStorage.getItem(`moonble:quiz-draft:v1:${userId}:${paperKey}`) || 'null');
    const questions = Array.isArray(draft?.questions) ? draft.questions : [];
    const answered = questions.filter(question => Array.isArray(question?.selected) && question.selected.length > 0).length;
    if (questions.length && answered) return { kind: 'progress', answered, total: questions.length, percent: Math.round((answered / questions.length) * 100) };
  } catch { /* 손상된 임시 저장은 상태에 쓰지 않는다. */ }
  try {
    const history = JSON.parse(localStorage.getItem(`moonble:user:${userId}:history-v3`) || '[]');
    const solved = Array.isArray(history) && history.some(item => (item?.bankId ? `custom:${item.bankId}` : item?.paperId) === paperKey);
    return solved ? null : { kind: 'unplayed' };
  } catch {
    return { kind: 'unplayed' };
  }
}

export function paperSolveStatusLabel(status) {
  if (!status) return '';
  return status.kind === 'progress' ? `풀이 중 ${status.percent}% (${status.answered}/${status.total})` : '풀이 전';
}
