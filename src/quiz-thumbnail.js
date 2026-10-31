import { supabase } from './supabase.js';
import { normalizeGif } from './community-gif.jsx';

export const QUIZ_THUMBNAIL_BUCKET = 'quiz-thumbnails';
export const QUIZ_THUMBNAIL_MAX_BYTES = 5 * 1024 * 1024;
const signedUrlCache = new Map();

const supportedTypes = new Set(['image/gif', 'image/jpeg', 'image/png']);
const fileExtension = { 'image/gif': 'gif', 'image/jpeg': 'jpg', 'image/png': 'png' };
const THUMBNAIL_GIF_PREFIX = 'klipy:';

export function encodeQuizThumbnailGif(gif) {
  const media = normalizeGif(gif);
  if (!media || media.provider !== 'klipy') throw new Error('GIF를 다시 선택해 주세요.');
  return `${THUMBNAIL_GIF_PREFIX}${encodeURIComponent(JSON.stringify(media))}`;
}

export function decodeQuizThumbnailGif(value) {
  if (typeof value !== 'string' || !value.startsWith(THUMBNAIL_GIF_PREFIX)) return null;
  try {
    const media = normalizeGif(JSON.parse(decodeURIComponent(value.slice(THUMBNAIL_GIF_PREFIX.length))));
    return media?.provider === 'klipy' ? media : null;
  } catch { return null; }
}

export function validateQuizThumbnail(file) {
  if (!file) return '이미지 파일을 선택해 주세요.';
  if (!supportedTypes.has(file.type)) return 'GIF, JPG, PNG 파일을 등록할 수 있어요.';
  if (file.size > QUIZ_THUMBNAIL_MAX_BYTES) return '썸네일은 5MB 이하로 등록해 주세요.';
  return '';
}

export async function uploadQuizThumbnail(file, bankId, userId) {
  const validationError = validateQuizThumbnail(file);
  if (validationError) throw new Error(validationError);
  if (!supabase || !bankId) throw new Error('로그인 상태를 확인해 주세요.');
  if (!userId) {
    const { data } = await supabase.auth.getUser();
    userId = data?.user?.id;
  }
  if (!userId) throw new Error('로그인 상태를 확인해 주세요.');

  const { data: previous, error: previousError } = await supabase
    .from('quiz_bank_thumbnails')
    .select('object_path,provider')
    .eq('owner_id', userId)
    .eq('bank_id', bankId)
    .maybeSingle();
  if (previousError) throw previousError;

  const revision = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const path = `${userId}/${bankId}/thumbnail-${revision}.${fileExtension[file.type]}`;
  const { error: uploadError } = await supabase.storage
    .from(QUIZ_THUMBNAIL_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type, cacheControl: '0' });
  if (uploadError) throw uploadError;

  const { error: saveError } = await supabase.from('quiz_bank_thumbnails').upsert({
    bank_id: bankId,
    owner_id: userId,
    object_path: path,
    provider: 'upload',
    media: null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'bank_id' });
  if (saveError) {
    if (!previous?.object_path || previous.object_path !== path) await supabase.storage.from(QUIZ_THUMBNAIL_BUCKET).remove([path]).catch(() => {});
    throw saveError;
  }

  signedUrlCache.delete(path);
  if (previous?.object_path && previous.object_path !== path) {
    const { error: removeError } = await supabase.storage.from(QUIZ_THUMBNAIL_BUCKET).remove([previous.object_path]);
    if (removeError) console.warn('이전 썸네일 파일을 정리하지 못했습니다.', removeError);
    signedUrlCache.delete(previous.object_path);
  }
  return path;
}

export async function saveQuizThumbnailGif(gif, bankId, userId) {
  const media = normalizeGif(gif);
  if (!media || media.provider !== 'klipy') throw new Error('GIF를 다시 선택해 주세요.');
  if (!supabase || !bankId) throw new Error('로그인 상태를 확인해 주세요.');
  if (!userId) {
    const { data } = await supabase.auth.getUser();
    userId = data?.user?.id;
  }
  if (!userId) throw new Error('로그인 상태를 확인해 주세요.');
  const { data: previous, error: previousError } = await supabase.from('quiz_bank_thumbnails')
    .select('object_path,provider').eq('owner_id', userId).eq('bank_id', bankId).maybeSingle();
  if (previousError) throw previousError;
  const { error } = await supabase.from('quiz_bank_thumbnails').upsert({
    bank_id: bankId, owner_id: userId, object_path: null, provider: 'klipy', media, updated_at: new Date().toISOString(),
  }, { onConflict: 'bank_id' });
  if (error) throw error;
  if (previous?.object_path) {
    const { error: removeError } = await supabase.storage.from(QUIZ_THUMBNAIL_BUCKET).remove([previous.object_path]);
    if (removeError) console.warn('이전 썸네일 파일을 정리하지 못했습니다.', removeError);
    signedUrlCache.delete(previous.object_path);
  }
  return encodeQuizThumbnailGif(media);
}

export async function deleteQuizThumbnail(path, bankId, userId) {
  if (!supabase || !bankId) throw new Error('로그인 상태를 확인해 주세요.');
  if (!userId) {
    const { data } = await supabase.auth.getUser();
    userId = data?.user?.id;
  }
  if (!userId) throw new Error('로그인 상태를 확인해 주세요.');
  const { error: rowError } = await supabase.from('quiz_bank_thumbnails').delete().eq('owner_id', userId).eq('bank_id', bankId);
  if (rowError) throw rowError;
  if (path && !decodeQuizThumbnailGif(path)) {
    const { error: fileError } = await supabase.storage.from(QUIZ_THUMBNAIL_BUCKET).remove([path]);
    if (fileError) console.warn('썸네일 파일을 정리하지 못했습니다.', fileError);
    signedUrlCache.delete(path);
  }
}

export async function getQuizThumbnailUrl(path, media = null) {
  const sharedMedia = normalizeGif(media);
  if (sharedMedia?.provider === 'klipy') return sharedMedia.url;
  if (!path) return '';
  const externalMedia = decodeQuizThumbnailGif(path);
  if (externalMedia) return externalMedia.url;
  if (!supabase) return '';
  const cached = signedUrlCache.get(path);
  if (cached && cached.expiresAt > Date.now()) return cached.url;
  const { data, error } = await supabase.storage.from(QUIZ_THUMBNAIL_BUCKET).createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) return '';
  signedUrlCache.set(path, { url: data.signedUrl, expiresAt: Date.now() + 3300 * 1000 });
  return data.signedUrl;
}

// 커뮤니티 첨부 썸네일에는 GIF 애니메이션 대신 첫 프레임을 포스터 이미지로 표시한다.
export async function getStaticQuizThumbnailUrl(path, media = null) {
  const sharedMedia = normalizeGif(media) || decodeQuizThumbnailGif(path);
  // preview_url도 제공처별로 애니메이션일 수 있어 그대로 렌더링하지 않고 첫 프레임을 고정한다.
  const sourceUrl = sharedMedia?.provider === 'klipy'
    ? (sharedMedia.preview_url || sharedMedia.url)
    : await getQuizThumbnailUrl(path, sharedMedia);
  if (!sourceUrl) return '';
  const isGif = sharedMedia?.provider === 'klipy'
    || (typeof path === 'string' && /\.gif(?:$|[?#])/i.test(path))
    || (typeof sourceUrl === 'string' && /\.gif(?:$|[?#])/i.test(sourceUrl));
  if (!isGif) return sourceUrl;
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return '';

  try {
    const response = await fetch(sourceUrl, { mode: 'cors', credentials: 'omit' });
    if (!response.ok) return '';
    const bitmap = await createImageBitmap(await response.blob());
    try {
      const scale = Math.min(1, 480 / bitmap.width, 480 / bitmap.height);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      if (!context) return '';
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const poster = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      return poster ? URL.createObjectURL(poster) : '';
    } finally { bitmap.close?.(); }
  } catch {
    // 원격 GIF가 정적 변환을 허용하지 않으면 움직이는 원본을 보여주지 않고 로고 대체 상태로 둔다.
    return '';
  }
}
