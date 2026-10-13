import { profileOf } from '../profile.js';
let currentUser = null;
export function setStorageUser(user) { currentUser = user; }
const allowed = new Set(['prds', 'prd-projects']);
function storageKey(key) {
  if (!currentUser || !allowed.has(key)) throw new Error('로그인 상태를 확인해주세요.');
  return `moonble:${currentUser.id}:${key}`;
}
// Original PRD document/project format retained, now partitioned by Supabase user ID.
// Legacy mock accounts and their plaintext passwords are never imported.
export const userStorage = {
  getItem(key) {
    if (key === 'prd-currentUser') return currentUser?.id ?? null;
    if (key === 'prd-users') return JSON.stringify(currentUser ? [{ id: currentUser.id, ...profileOf(currentUser) }] : []);
    const value = localStorage.getItem(storageKey(key));
    if (value && !Array.isArray(JSON.parse(value))) throw new Error('저장된 PRD 데이터를 읽을 수 없습니다.');
    return value;
  },
  setItem(key, value) { localStorage.setItem(storageKey(key), value); },
};
