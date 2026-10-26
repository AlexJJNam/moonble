const STATIC_CACHE = 'moonble-static-v2';
const STATIC_PATH_PREFIX = '/assets/';
const SHARE_DB = 'moonble-share-target-v1';
const SHARE_STORE = 'incoming-files';
const SHARE_FILE_KEY = 'latest';

function saveSharedFile(file) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SHARE_DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(SHARE_STORE)) {
        request.result.createObjectStore(SHARE_STORE);
      }
    };
    request.onerror = () => reject(request.error || new Error('Share storage unavailable'));
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction(SHARE_STORE, 'readwrite');
      transaction.objectStore(SHARE_STORE).put({
        blob: file,
        name: file.name || 'shared.csv',
        type: file.type || 'text/csv',
        lastModified: file.lastModified || Date.now(),
      }, SHARE_FILE_KEY);
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = () => { database.close(); reject(transaction.error || new Error('Share storage failed')); };
      transaction.onabort = () => { database.close(); reject(transaction.error || new Error('Share storage aborted')); };
    };
  });
}

async function receiveSharedFile(request) {
  const destination = new URL('/quiz.html#create', self.location.origin);
  try {
    const form = await request.formData();
    const file = form.getAll('files').find(value => value instanceof File && value.size > 0);
    if (!file) {
      destination.searchParams.set('shareError', 'missing-file');
    } else {
      await saveSharedFile(file);
      destination.searchParams.set('shared', '1');
    }
  } catch {
    destination.searchParams.set('shareError', 'unavailable');
  }
  return Response.redirect(destination.href, 303);
}

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith('moonble-static-') && key !== STATIC_CACHE)
          .map(key => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('push', event => {
  let message = {};
  try {
    message = event.data?.json() || {};
  } catch {
    try { message = { body: event.data?.text() || '' }; } catch { /* 알림 내용이 없어도 기본 알림을 표시한다. */ }
  }

  const title = typeof message.title === 'string' ? message.title.slice(0, 80) : '문블 알림';
  const body = typeof message.body === 'string' ? message.body.slice(0, 180) : '새로운 알림이 도착했어요.';
  const tag = typeof message.tag === 'string' ? message.tag.slice(0, 120) : 'moonble-notification';
  const destination = new URL('/quiz.html?openNotifications=1', self.location.origin);
  try {
    const requestedUrl = new URL(message.url, self.location.origin);
    if (requestedUrl.origin === self.location.origin) destination.href = requestedUrl.href;
  } catch { /* 기본 알림 화면으로 이동한다. */ }

  event.waitUntil(self.registration.showNotification(title, {
    body,
    tag,
    icon: '/assets/moonble-app-icon-192.png',
    badge: '/assets/moonble-app-icon-192.png',
    data: { url: destination.href },
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = new URL('/quiz.html?openNotifications=1', self.location.origin);
  try {
    const requestedUrl = new URL(event.notification.data?.url, self.location.origin);
    if (requestedUrl.origin === self.location.origin) targetUrl.href = requestedUrl.href;
  } catch { /* 기본 알림 화면으로 이동한다. */ }

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) {
      const navigated = await existing.navigate(targetUrl.href).catch(() => null);
      const client = navigated || existing;
      await client.focus();
      client.postMessage({ type: 'moonble:open-notifications' });
      return;
    }
    await self.clients.openWindow(targetUrl.href);
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method === 'POST' && url.origin === self.location.origin && url.pathname === '/share-target') {
    event.respondWith(receiveSharedFile(request));
    return;
  }
  if (request.method !== 'GET') return;

  if (url.origin !== self.location.origin || !url.pathname.startsWith(STATIC_PATH_PREFIX)) return;

  event.respondWith(
    caches.open(STATIC_CACHE).then(async cache => {
      try {
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      } catch {
        return (await cache.match(request)) || Response.error();
      }
    }),
  );
});
