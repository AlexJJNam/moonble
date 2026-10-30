// 문제지 카테고리(018_quiz_categories.sql의 허용 값과 같다).
export const QUIZ_CATEGORIES = [
  { value: 'marketing', label: '마케팅·분석' },
  { value: 'dev', label: '개발·IT' },
  { value: 'design', label: '디자인' },
  { value: 'planning', label: '기획·PM' },
  { value: 'business', label: '경영·경제' },
  { value: 'language', label: '어학' },
  { value: 'certificate', label: '자격증' },
  { value: 'school', label: '학교 공부' },
  { value: 'general', label: '상식·교양' },
  { value: 'etc', label: '기타' },
];
const LABELS = new Map(QUIZ_CATEGORIES.map(item => [item.value, item.label]));

export function normalizeCategory(value) {
  return typeof value === 'string' && LABELS.has(value) ? value : null;
}

export function categoryLabel(value) {
  return LABELS.get(value) || '';
}
