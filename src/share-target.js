const SHARE_DB = 'moonble-share-target-v1';
const SHARE_STORE = 'incoming-files';
const SHARE_FILE_KEY = 'latest';

export function takeSharedFile() {
  if (!('indexedDB' in window)) return Promise.resolve(null);
  return new Promise(resolve => {
    const request = indexedDB.open(SHARE_DB, 1);
    request.onerror = () => resolve(null);
    request.onsuccess = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(SHARE_STORE)) {
        database.close();
        resolve(null);
        return;
      }
      const transaction = database.transaction(SHARE_STORE, 'readwrite');
      const store = transaction.objectStore(SHARE_STORE);
      const getRequest = store.get(SHARE_FILE_KEY);
      getRequest.onsuccess = () => {
        const record = getRequest.result;
        store.delete(SHARE_FILE_KEY);
        if (!record?.blob) {
          resolve(null);
          return;
        }
        try {
          resolve(new File([record.blob], record.name || 'shared.csv', {
            type: record.type || record.blob.type || 'text/csv',
            lastModified: record.lastModified || Date.now(),
          }));
        } catch {
          resolve(null);
        }
      };
      getRequest.onerror = () => resolve(null);
      transaction.oncomplete = () => database.close();
      transaction.onerror = () => database.close();
      transaction.onabort = () => database.close();
    };
  });
}
