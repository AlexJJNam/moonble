export function browserNotificationPreferenceKey(userId) {
  return userId ? `moonble:user:${userId}:browser-notifications-enabled-v1` : null;
}

export function getBrowserNotificationSettings(userId) {
  let permission = 'unsupported';
  if (typeof window.Notification === 'function') {
    permission = window.isSecureContext === false ? 'insecure' : window.Notification.permission;
  }
  let optedIn = false;
  const key = browserNotificationPreferenceKey(userId);
  try { optedIn = Boolean(key) && localStorage.getItem(key) === 'true'; }
  catch { /* 설정 UI는 저장소 제한 환경에서도 표시한다. */ }
  return { permission, enabled: permission === 'granted' && optedIn };
}

export function setBrowserNotificationPreference(userId, enabled) {
  const key = browserNotificationPreferenceKey(userId);
  if (!key) return getBrowserNotificationSettings(userId);
  try { localStorage.setItem(key, String(Boolean(enabled))); }
  catch { /* 브라우저 권한 요청은 저장소 사용 여부와 별개로 처리한다. */ }
  const settings = getBrowserNotificationSettings(userId);
  window.dispatchEvent(new CustomEvent('moonble:browser-notifications-changed', { detail: { userId, settings } }));
  return settings;
}

export async function enableBrowserNotifications(userId) {
  let settings = getBrowserNotificationSettings(userId);
  if (settings.permission === 'default') {
    await window.Notification.requestPermission();
    settings = getBrowserNotificationSettings(userId);
  }
  if (settings.permission === 'granted') return setBrowserNotificationPreference(userId, true);
  return settings;
}

export async function deliverBrowserNotification(title, body) {
  if (typeof window.Notification !== 'function' || window.Notification.permission !== 'granted') return;
  const options = { body, icon: '/favicon.svg', tag: `moonble-share-${Date.now()}` };
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.ready;
    if (registration?.showNotification) {
      await registration.showNotification(title, options);
      return;
    }
  }
  new window.Notification(title, options);
}
