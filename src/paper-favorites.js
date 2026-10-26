const FAVORITE_STORAGE_VERSION = 1;

function favoriteStorageKey(userId) {
  return userId ? `moonble:user:${userId}:favorite-papers-v${FAVORITE_STORAGE_VERSION}` : null;
}

export function getFavoritePaperIds(userId) {
  try {
    const key = favoriteStorageKey(userId);
    const saved = key ? JSON.parse(localStorage.getItem(key) || '[]') : [];
    return Array.isArray(saved) ? Array.from(new Set(saved.filter(id => typeof id === 'string' && id))) : [];
  } catch {
    return [];
  }
}

export function toggleFavoritePaper(userId, paperId) {
  const current = getFavoritePaperIds(userId);
  const next = current.includes(paperId) ? current.filter(id => id !== paperId) : [paperId, ...current];
  const key = favoriteStorageKey(userId);
  try {
    if (key) localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // Storage limits should not interrupt the current page interaction.
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('moonble:paper-favorites', { detail: { userId, paperIds: next } }));
  }
  return next;
}

export function removeFavoritePaper(userId, paperId) {
  const next = getFavoritePaperIds(userId).filter(id => id !== paperId);
  const key = favoriteStorageKey(userId);
  try {
    if (key) localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // Storage limits should not interrupt the current page interaction.
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('moonble:paper-favorites', { detail: { userId, paperIds: next } }));
  }
  return next;
}
