export function formatRelativeDate(value, now = Date.now()) {
  const dateValue = new Date(value).getTime();
  if (!Number.isFinite(dateValue)) return '';
  const elapsedMinutes = Math.max(0, Math.floor((now - dateValue) / 60000));
  if (elapsedMinutes < 5) return '방금 전';
  if (elapsedMinutes < 60) return `${elapsedMinutes}분 전`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}시간 전`;
  const date = new Date(dateValue);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

export function formatRelativeDateShortYear(value, now = Date.now()) {
  return formatRelativeDate(value, now).replace(/^\d{2}(\d{2}\.\d{2}\.\d{2})$/, '$1');
}
