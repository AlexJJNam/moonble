import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
const projectRef = url ? new URL(url).hostname.split('.')[0] : '';
const authStorageKey = projectRef ? `sb-${projectRef}-auth-token` : '';

// SDK가 인증 링크의 hash를 정리하기 전에 복구/오류 종류를 보관합니다.
const initialHash = new URLSearchParams(window.location.hash.slice(1));
const initialQuery = new URLSearchParams(window.location.search);
export const authCallback = {
  recovery: initialHash.get('type') === 'recovery',
  error: initialHash.has('error') || initialQuery.has('error'),
};

// 공개용 Publishable Key만 허용합니다. 서버용 Secret Key는 사용하지 않습니다.
export const isConfigured = Boolean(url && /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url) && key?.startsWith('sb_publishable_'));
export const supabase = isConfigured
  ? createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

// Supabase가 여러 탭의 Web Lock을 기다리면 getSession()이 오래 멈출 수 있다.
// 화면 진입은 로컬에 저장된 세션으로 즉시 복구하고, SDK 결과로 뒤에서 동기화한다.
export function cachedAuthSession() {
  if (!authStorageKey) return null;
  try {
    const raw = localStorage.getItem(authStorageKey);
    if (!raw) return null;
    const stored = JSON.parse(raw);
    const session = stored?.currentSession || stored?.session || stored;
    const expiresAt = Number(session?.expires_at || 0) * 1000;
    if (expiresAt && expiresAt <= Date.now()) return null;
    return session?.user?.id && session?.access_token ? session : null;
  } catch {
    return null;
  }
}

export function getSessionSafely(timeoutMs = 1800) {
  const fallback = cachedAuthSession();
  if (!supabase) return Promise.resolve({ session: null, error: new Error('Supabase is not configured'), timedOut: false });

  return new Promise(resolve => {
    let settled = false;
    const finish = value => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = window.setTimeout(() => finish({ session: fallback, error: null, timedOut: true }), timeoutMs);

    supabase.auth.getSession()
      .then(({ data, error }) => finish({
        session: error ? fallback : data.session,
        error: fallback ? null : error,
        timedOut: false,
      }))
      .catch(error => finish({ session: fallback, error: fallback ? null : error, timedOut: false }));
  });
}

export function loginUrl() {
  return new URL('./login.html', window.location.href).href;
}

let navigatingHome = false;
export function goHome() {
  if (navigatingHome) return;
  navigatingHome = true;
  window.location.replace(new URL('./quiz.html', window.location.href).href);
}
