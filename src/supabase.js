import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

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

export function loginUrl() {
  return new URL('./login.html', window.location.href).href;
}

let navigatingHome = false;
export function goHome() {
  if (navigatingHome) return;
  navigatingHome = true;
  window.location.replace(new URL('./prd.html', window.location.href).href);
}
