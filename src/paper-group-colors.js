import { DEFAULT_GROUP_ID } from './custom-bank.js';

export const GROUP_COLOR_OPTIONS = [
  { key: 'blue', label: '파랑', hue: 212, swatch: '#3182f6' },
  { key: 'cyan', label: '하늘', hue: 190, swatch: '#14a8c7' },
  { key: 'green', label: '초록', hue: 145, swatch: '#20a36a' },
  { key: 'lime', label: '연두', hue: 92, swatch: '#76a923' },
  { key: 'orange', label: '주황', hue: 28, swatch: '#e98a25' },
  { key: 'pink', label: '분홍', hue: 338, swatch: '#d95782' },
  { key: 'purple', label: '보라', hue: 267, swatch: '#8055c9' },
  { key: 'slate', label: '회색', hue: 215, swatch: '#7b8798' },
];

function legacyGroupHue(groupId) {
  let hash = 2166136261;
  for (const character of groupId) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return (hash >>> 0) % 360;
}

export function defaultGroupColorKey(groupId) {
  const hue = legacyGroupHue(groupId);
  return GROUP_COLOR_OPTIONS.reduce((closest, option) => {
    const distance = Math.abs(((hue - option.hue + 540) % 360) - 180);
    return !closest || distance < closest.distance ? { key: option.key, distance } : closest;
  }, null)?.key || 'blue';
}

export function buildGroupColorMap(groups) {
  const usedHues = new Set();
  const colors = new Map();
  [...groups].sort((a, b) => a.id.localeCompare(b.id)).forEach(group => {
    const selected = GROUP_COLOR_OPTIONS.find(option => option.key === group.colorKey);
    let hue = selected?.hue ?? legacyGroupHue(group.id);
    if (!selected) {
      while (usedHues.has(hue)) hue = (hue + 37) % 360;
      usedHues.add(hue);
    }
    colors.set(group.id, {
      '--paper-group-tint': `hsl(${hue} 72% 95%)`,
      '--paper-group-color': `hsl(${hue} 48% 36%)`,
      '--paper-group-border': `hsl(${hue} 45% 86%)`,
    });
  });
  return colors;
}

export function groupColorStyle(groupId, colors) {
  if (groupId === 'all') return { '--paper-group-tint': '#e8f3ff', '--paper-group-color': '#1b64da', '--paper-group-border': '#d5e8ff' };
  if (groupId === DEFAULT_GROUP_ID) return { '--paper-group-tint': '#f2f4f6', '--paper-group-color': '#667085', '--paper-group-border': '#e3e7eb' };
  return colors.get(groupId) || groupColorStyle(DEFAULT_GROUP_ID, colors);
}

export function favoriteGroupIconStyle(groupId, colors) {
  const style = groupColorStyle(groupId, colors);
  return {
    '--favorite-group-tint': style['--paper-group-tint'],
    '--favorite-group-color': style['--paper-group-color'],
  };
}
