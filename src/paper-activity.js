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
