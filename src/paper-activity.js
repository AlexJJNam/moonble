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
