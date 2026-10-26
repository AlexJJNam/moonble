import { supabase } from './supabase.js';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY?.trim() || '';

export function browserNotificationPreferenceKey(userId) {
  return userId ? `moonble:user:${userId}:browser-notifications-enabled-v2` : null;
}

function browserPushSupport() {
  if (window.isSecureContext === false) return 'insecure';

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isInstalled = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (isIOS && !isInstalled) return 'install-required';

  if (typeof window.Notification !== 'function'
    || !('serviceWorker' in navigator)
    || !('PushManager' in window)) return 'unsupported';
  if (!VAPID_PUBLIC_KEY) return 'unconfigured';
  return window.Notification.permission;
}

export function getBrowserNotificationSettings(userId) {
  const permission = browserPushSupport();
  let optedIn = false;
  const key = browserNotificationPreferenceKey(userId);
  try { optedIn = Boolean(key) && localStorage.getItem(key) === 'true'; }
  catch { /* 설정 화면은 저장소 제한 환경에서도 표시한다. */ }
  return { permission, enabled: permission === 'granted' && optedIn };
}

function savePreference(userId, enabled) {
  const key = browserNotificationPreferenceKey(userId);
  if (!key) return;
  try { localStorage.setItem(key, String(Boolean(enabled))); }
  catch { /* 원격 구독은 브라우저 저장소 사용 여부와 별개로 유지한다. */ }
}

function publishPreferenceChange(userId) {
  window.dispatchEvent(new CustomEvent('moonble:browser-notifications-changed', {
    detail: { userId, settings: getBrowserNotificationSettings(userId) },
  }));
}

function decodeApplicationServerKey(encodedKey) {
  const padded = `${encodedKey}${'='.repeat((4 - encodedKey.length % 4) % 4)}`;
  const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

async function savePushSubscription(subscription) {
  if (!supabase) throw new Error('알림 서버에 연결할 수 없어요.');
  const { error } = await supabase.rpc('moonble_save_web_push_subscription', {
    p_subscription: subscription.toJSON(),
  });
  if (error) throw error;
}

export async function enableBrowserNotifications(userId) {
  if (!userId) throw new Error('로그인 후 알림을 켤 수 있어요.');
  let settings = getBrowserNotificationSettings(userId);
  if (settings.permission === 'default') {
    // 브라우저 권한 요청은 사용자가 버튼을 누른 동작에서 바로 실행한다.
    await window.Notification.requestPermission();
    settings = getBrowserNotificationSettings(userId);
  }
  if (settings.permission !== 'granted') return settings;

  const registration = await navigator.serviceWorker.ready;
  if (!registration.pushManager) throw new Error('이 브라우저에서는 푸시 알림을 사용할 수 없어요.');
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeApplicationServerKey(VAPID_PUBLIC_KEY),
    });
  }

  await savePushSubscription(subscription);
  savePreference(userId, true);
  try { localStorage.setItem(`${browserNotificationPreferenceKey(userId)}:endpoint`, subscription.endpoint); }
  catch { /* 구독은 서버에 저장되어 있으므로 기기 로컬 주소 캐시는 선택 사항이다. */ }
  publishPreferenceChange(userId);
  return getBrowserNotificationSettings(userId);
}

export async function disableBrowserNotifications(userId) {
  const registration = 'serviceWorker' in navigator ? await navigator.serviceWorker.ready.catch(() => null) : null;
  const subscription = await registration?.pushManager?.getSubscription();
  const endpointKey = `${browserNotificationPreferenceKey(userId)}:endpoint`;
  let savedEndpoint = '';
  try { savedEndpoint = localStorage.getItem(endpointKey) || ''; }
  catch { /* PushManager의 구독 주소만으로도 해제할 수 있다. */ }
  const endpoint = subscription?.endpoint || savedEndpoint;

  if (endpoint && supabase) {
    const { error } = await supabase.rpc('moonble_delete_web_push_subscription', { p_endpoint: endpoint });
    if (error) throw error;
  }
  if (subscription) await subscription.unsubscribe();

  savePreference(userId, false);
  try { localStorage.removeItem(endpointKey); } catch { /* 해제 동작 자체는 서버에서 완료됐다. */ }
  publishPreferenceChange(userId);
  return getBrowserNotificationSettings(userId);
}
