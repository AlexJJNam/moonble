import { supabase } from './supabase.js';

export const PROFILE_AVATAR_BUCKET = 'profile-avatars';
export const MAX_PROFILE_AVATAR_BYTES = 20 * 1024 * 1024;

const MIME_EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const AVATAR_FILENAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpg|png)$/i;
const SIGNED_URL_SECONDS = 3600;
const SIGNED_URL_REFRESH_MS = 55 * 60 * 1000;
const SIGNED_URL_VALID_MS = 59 * 60 * 1000;
const SIGNED_URL_SESSION_PREFIX = 'moonble:profile-avatar-url:';
const signedUrls = new Map();
const signingRequests = new Map();

function signedUrlSessionKey(path) {
  return `${SIGNED_URL_SESSION_PREFIX}${path}`;
}

function readSignedUrl(path) {
  const now = Date.now();
  let cached = signedUrls.get(path);
  if (!cached) {
    try {
      const saved = JSON.parse(sessionStorage.getItem(signedUrlSessionKey(path)) || 'null');
      if (saved && typeof saved.url === 'string' && Number.isFinite(saved.refreshAt) && Number.isFinite(saved.validUntil)) cached = saved;
    } catch { /* 세션 저장이 막혀 있으면 현재 문서의 캐시를 사용한다. */ }
  }
  if (!cached || cached.validUntil <= now) {
    signedUrls.delete(path);
    try { sessionStorage.removeItem(signedUrlSessionKey(path)); } catch { /* 캐시 삭제는 선택 사항이다. */ }
    return null;
  }
  signedUrls.set(path, cached);
  return cached;
}

function writeSignedUrl(path, url, now) {
  const cached = { url, refreshAt: now + SIGNED_URL_REFRESH_MS, validUntil: now + SIGNED_URL_VALID_MS };
  signedUrls.set(path, cached);
  try { sessionStorage.setItem(signedUrlSessionKey(path), JSON.stringify(cached)); }
  catch { /* 세션 저장이 막혀도 메모리 캐시를 사용한다. */ }
  return cached;
}

function userIdOf(user) {
  if (!UUID.test(user?.id || '')) throw new Error('로그인 상태를 확인한 뒤 다시 시도해주세요.');
  return user.id.toLowerCase();
}

function avatarBucket() {
  if (!supabase) throw new Error('프로필 사진 저장 설정이 아직 준비되지 않았어요. 잠시 후 다시 시도해주세요.');
  return supabase.storage.from(PROFILE_AVATAR_BUCKET);
}

function missingBucket(error) {
  return error?.code === 'NoSuchBucket' || /bucket.*(?:not found|does not exist)|(?:not found|does not exist).*bucket/i.test(error?.message || '');
}

function storageError(error, action = '저장') {
  const verb = action === '불러오기' ? '불러오지' : `${action}하지`;
  const message = missingBucket(error) || /row.level.security|policy|permission denied/i.test(error?.message || '')
    ? '프로필 사진 저장 설정이 아직 준비되지 않았어요. 잠시 후 다시 시도해주세요.'
    : `프로필 사진을 ${verb} 못했어요. 연결 상태를 확인하고 다시 시도해주세요.`;
  return new Error(message, { cause: error });
}

function ownStoredPath(user) {
  if (!UUID.test(user?.id || '')) return '';
  const path = user?.user_metadata?.avatarPath;
  if (typeof path !== 'string') return '';
  const parts = path.split('/');
  return parts.length === 2 && parts[0] === user.id.toLowerCase() && AVATAR_FILENAME.test(parts[1]) ? path : '';
}

function invalidateUrls(userId) {
  for (const path of signedUrls.keys()) if (path.startsWith(`${userId}/`)) signedUrls.delete(path);
  try {
    const prefix = `${SIGNED_URL_SESSION_PREFIX}${userId}/`;
    for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = sessionStorage.key(index);
      if (key?.startsWith(prefix)) sessionStorage.removeItem(key);
    }
  } catch { /* 캐시 삭제 실패가 프로필 변경을 막지 않게 한다. */ }
}

function assertOwnPath(userId, path) {
  const parts = typeof path === 'string' ? path.split('/') : [];
  if (parts.length < 2 || parts[0] !== userId || parts.some(part => !part || part === '.' || part === '..' || part.includes('\0'))) {
    throw new Error('프로필 사진 경로를 확인하지 못했어요. 다시 시도해주세요.');
  }
}

async function listOwnFiles(userId) {
  const bucket = avatarBucket();
  const folders = [userId];
  const seen = new Set();
  const files = [];
  while (folders.length) {
    const folder = folders.pop();
    if (seen.has(folder)) continue;
    seen.add(folder);
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await bucket.list(folder, { limit: 100, offset, sortBy: { column: 'name', order: 'asc' } });
      if (error) throw error;
      const entries = data || [];
      for (const entry of entries) {
        if (typeof entry.name !== 'string' || entry.name.includes('/')) throw new Error('Invalid storage entry');
        const path = `${folder}/${entry.name}`;
        assertOwnPath(userId, path);
        if (!entry.id && !entry.metadata) folders.push(path);
        else files.push(path);
      }
      if (entries.length < 100) break;
    }
  }
  return files;
}

async function removeOwnFiles(userId, paths) {
  const bucket = avatarBucket();
  for (let index = 0; index < paths.length; index += 100) {
    const batch = paths.slice(index, index + 100);
    batch.forEach(path => assertOwnPath(userId, path));
    const { error } = await bucket.remove(batch);
    if (error) throw error;
    batch.forEach(path => {
      signedUrls.delete(path);
      try { sessionStorage.removeItem(signedUrlSessionKey(path)); } catch { /* 실제 파일 정리는 완료됐다. */ }
    });
  }
}

async function decodeImage(file) {
  if (typeof createImageBitmap === 'function') {
    const source = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return { source, width: source.width, height: source.height, release: () => source.close() };
  }
  const url = URL.createObjectURL(file);
  try {
    const source = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Image decoding failed'));
      image.src = url;
    });
    return { source, width: source.naturalWidth, height: source.naturalHeight, release: () => URL.revokeObjectURL(url) };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

export async function prepareProfileAvatar(file) {
  if (!(file instanceof Blob) || !file.size) throw new Error('JPG 또는 PNG 이미지 파일을 선택해주세요.');
  if (file.size > MAX_PROFILE_AVATAR_BYTES) throw new Error('20MB 이하의 이미지를 선택해주세요.');
  const contentType = file.type.toLowerCase();
  if (!MIME_EXTENSIONS[contentType]) throw new Error('JPG 또는 PNG 이미지만 등록할 수 있어요.');
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value);
  if ((contentType === 'image/jpeg' && !isJpeg) || (contentType === 'image/png' && !isPng)) {
    throw new Error('이미지 형식을 확인하지 못했어요. 원본 JPG 또는 PNG 파일을 선택해주세요.');
  }
  let decoded;
  try {
    decoded = await decodeImage(file);
    if (!decoded.width || !decoded.height) throw new Error('Image dimensions missing');
    const cropSize = Math.min(decoded.width, decoded.height);
    const size = Math.min(512, cropSize);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas unavailable');
    context.drawImage(decoded.source, (decoded.width - cropSize) / 2, (decoded.height - cropSize) / 2, cropSize, cropSize, 0, 0, size, size);
    const image = await new Promise(resolve => canvas.toBlob(resolve, contentType, .9));
    if (!image || image.type !== contentType) throw new Error('Image encoding failed');
    return { file: image, contentType, extension: MIME_EXTENSIONS[contentType] };
  } catch (error) {
    throw new Error('이미지를 읽지 못했어요. 다른 JPG 또는 PNG 파일을 선택해주세요.', { cause: error });
  } finally {
    decoded?.release();
  }
}

export async function saveProfileAvatar(user, prepared) {
  const userId = userIdOf(user);
  if (!(prepared?.file instanceof Blob) || !prepared.file.size || prepared.file.size > MAX_PROFILE_AVATAR_BYTES || !MIME_EXTENSIONS[prepared.contentType] || MIME_EXTENSIONS[prepared.contentType] !== prepared.extension || prepared.file.type !== prepared.contentType) {
    throw new Error('JPG 또는 PNG 이미지 파일을 다시 선택해주세요.');
  }
  const bucket = avatarBucket();
  let obsolete;
  try { obsolete = await listOwnFiles(userId); }
  catch (error) { throw storageError(error); }
  const path = `${userId}/${crypto.randomUUID()}.${prepared.extension}`;
  const { error: uploadError } = await bucket.upload(path, prepared.file, { contentType: prepared.contentType, cacheControl: '3600', upsert: false });
  if (uploadError) throw storageError(uploadError);
  let updatedUser;
  try {
    const { data, error } = await supabase.auth.updateUser({ data: { avatarPath: path } });
    if (error || !data?.user) throw error || new Error('User update missing');
    updatedUser = data.user;
  } catch (error) {
    try { await removeOwnFiles(userId, [path]); } catch { /* 계정 삭제 시 폴더 전체를 다시 정리한다. */ }
    throw new Error('프로필 사진 정보를 저장하지 못했어요. 다시 시도해주세요.', { cause: error });
  }
  try { await removeOwnFiles(userId, obsolete.filter(oldPath => oldPath !== path)); }
  catch { /* 새 사진 저장은 완료됐다. 오래된 파일은 초기화나 회원 탈퇴 시 다시 정리한다. */ }
  return updatedUser;
}

export async function resetProfileAvatar(user) {
  const userId = userIdOf(user);
  avatarBucket();
  const { data, error } = await supabase.auth.updateUser({ data: { avatarPath: null } });
  if (error || !data?.user) throw new Error('프로필 사진을 초기화하지 못했어요. 다시 시도해주세요.', { cause: error });
  invalidateUrls(userId);
  try { await clearProfileAvatarFiles(data.user); }
  catch { /* 초기화된 프로필을 먼저 반영한다. 회원 탈퇴 시 파일 삭제는 반드시 재확인한다. */ }
  return data.user;
}

export async function clearProfileAvatarFiles(user) {
  const userId = userIdOf(user);
  try {
    const paths = await listOwnFiles(userId);
    await removeOwnFiles(userId, paths);
    if ((await listOwnFiles(userId)).length) throw new Error('Avatar files remain');
    invalidateUrls(userId);
  } catch (error) {
    if (missingBucket(error) && !user?.user_metadata?.avatarPath) return;
    throw storageError(error, '삭제');
  }
}

export async function profileAvatarUrl(user) {
  const path = ownStoredPath(user);
  if (!path) return '';
  const cached = readSignedUrl(path);
  if (cached && cached.refreshAt > Date.now()) return cached.url;
  if (signingRequests.has(path)) return signingRequests.get(path);
  const request = Promise.resolve().then(async () => {
    try {
      const { data, error } = await avatarBucket().createSignedUrl(path, SIGNED_URL_SECONDS);
      if (error || !data?.signedUrl) throw error || new Error('Signed URL missing');
      writeSignedUrl(path, data.signedUrl, Date.now());
      return data.signedUrl;
    } catch (error) {
      throw storageError(error, '불러오기');
    }
  }).finally(() => signingRequests.delete(path));
  signingRequests.set(path, request);
  return request;
}

export function cachedProfileAvatarUrl(user) {
  const path = ownStoredPath(user);
  return path ? readSignedUrl(path)?.url || '' : '';
}
