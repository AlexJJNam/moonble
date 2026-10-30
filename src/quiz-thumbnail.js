import { supabase } from './supabase.js';

export const QUIZ_THUMBNAIL_BUCKET = 'quiz-thumbnails';
export const QUIZ_THUMBNAIL_MAX_BYTES = 5 * 1024 * 1024;
const signedUrlCache = new Map();

const supportedTypes = new Set(['image/gif', 'image/jpeg', 'image/png']);
const fileExtension = { 'image/gif': 'gif', 'image/jpeg': 'jpg', 'image/png': 'png' };

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
    .select('object_path')
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

export async function deleteQuizThumbnail(path, bankId, userId) {
  if (!supabase || !bankId) throw new Error('로그인 상태를 확인해 주세요.');
  if (!userId) {
    const { data } = await supabase.auth.getUser();
    userId = data?.user?.id;
  }
  if (!userId) throw new Error('로그인 상태를 확인해 주세요.');
  const { error: rowError } = await supabase.from('quiz_bank_thumbnails').delete().eq('owner_id', userId).eq('bank_id', bankId);
  if (rowError) throw rowError;
  if (path) {
    const { error: fileError } = await supabase.storage.from(QUIZ_THUMBNAIL_BUCKET).remove([path]);
    if (fileError) console.warn('썸네일 파일을 정리하지 못했습니다.', fileError);
    signedUrlCache.delete(path);
  }
}

export async function getQuizThumbnailUrl(path) {
  if (!path || !supabase) return '';
  const cached = signedUrlCache.get(path);
  if (cached && cached.expiresAt > Date.now()) return cached.url;
  const { data, error } = await supabase.storage.from(QUIZ_THUMBNAIL_BUCKET).createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) return '';
  signedUrlCache.set(path, { url: data.signedUrl, expiresAt: Date.now() + 3300 * 1000 });
  return data.signedUrl;
}
