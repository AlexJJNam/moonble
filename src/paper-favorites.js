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

// 문제 찾기(공개 문제) 하트: 즐겨찾기처럼 이 기기에 저장한다. 공유 토큰과 제목을 함께 남긴다.
function likeStorageKey(userId) {
  return userId ? `moonble:user:${userId}:public-quiz-likes-v1` : null;
}

export function getLikedPublicQuizzes(userId) {
  try {
    const key = likeStorageKey(userId);
    const saved = key ? JSON.parse(localStorage.getItem(key) || '[]') : [];
    return Array.isArray(saved) ? saved.filter(item => item && typeof item.token === 'string' && item.token) : [];
  } catch {
    return [];
  }
}

export function toggleLikedPublicQuiz(userId, item) {
  const current = getLikedPublicQuizzes(userId);
  const liked = current.some(saved => saved.token === item.token);
  const next = liked ? current.filter(saved => saved.token !== item.token) : [{ token: item.token, title: item.title || '', likedAt: new Date().toISOString() }, ...current];
  const key = likeStorageKey(userId);
  try {
    if (key) localStorage.setItem(key, JSON.stringify(next.slice(0, 300)));
  } catch {
    // 저장이 막혀도 현재 화면의 표시는 바꾼다.
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('moonble:public-quiz-likes', { detail: { userId, items: next } }));
  }
  return !liked;
}
