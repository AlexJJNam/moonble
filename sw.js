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
