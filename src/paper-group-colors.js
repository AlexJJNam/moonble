import { DEFAULT_GROUP_ID } from './custom-bank.js';

// Keep older blue/cyan keys available when reading previously saved groups.
const GROUP_COLOR_PALETTE = [
  { key: 'default', label: '기본', hue: 212, swatch: '#1b64da', tint: '#e8f3ff', color: '#1b64da', border: '#d5e8ff' },
  { key: 'blue', label: '파랑', hue: 212, swatch: '#3182f6' },
  { key: 'cyan', label: '하늘', hue: 190, swatch: '#14a8c7' },
  { key: 'green', label: '초록', hue: 145, swatch: '#20a36a' },
  { key: 'lime', label: '연두', hue: 92, swatch: '#76a923' },
  { key: 'yellow', label: '노랑', hue: 50, swatch: '#e7b600' },
  { key: 'orange', label: '주황', hue: 28, swatch: '#e98a25' },
  { key: 'pink', label: '분홍', hue: 338, swatch: '#d95782' },
  { key: 'purple', label: '보라', hue: 267, swatch: '#8055c9' },
  { key: 'slate', label: '회색', hue: 215, swatch: '#7b8798' },
];

// Newly created groups use the same dark default as the 전체 tab. Existing
// groups with the old default key retain their original blue color.
export const GROUP_COLOR_OPTIONS = [
  { key: '#141414', label: '기본', swatch: '#141414' },
  ...GROUP_COLOR_PALETTE.filter(option => !['default', 'blue', 'cyan'].includes(option.key)),
];

export function normalizeGroupHex(value) {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^#?([0-9a-f]{6})$/i);
  return match ? `#${match[1].toUpperCase()}` : null;
}

export function groupColorSwatch(colorKey) {
  const hex = normalizeGroupHex(colorKey);
  return hex || GROUP_COLOR_PALETTE.find(option => option.key === colorKey)?.swatch || GROUP_COLOR_OPTIONS[0].swatch;
}

function hexToRgb(hex) {
  return [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
}

function rgbToHex(rgb) {
  return `#${rgb.map(channel => Math.round(channel).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

function mixRgb(from, to, amount) {
  return from.map((channel, index) => Math.round(channel + (to[index] - channel) * amount));
}

function luminance(rgb) {
  const linear = rgb.map(channel => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrast(first, second) {
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export function groupColorCheckColor(color) {
  const background = hexToRgb(groupColorSwatch(color));
  return contrast([20, 20, 20], background) >= contrast([255, 255, 255], background) ? '#141414' : '#ffffff';
}

function customGroupColorValues(hex) {
  const chosen = hexToRgb(hex);
  const tint = mixRgb([255, 255, 255], chosen, 0.07);
  let text = chosen;
  if (contrast(text, tint) < 4.5) {
    let low = 0;
    let high = 1;
    for (let index = 0; index < 16; index += 1) {
      const middle = (low + high) / 2;
      if (contrast(mixRgb(chosen, [0, 0, 0], middle), tint) >= 4.5) high = middle;
      else low = middle;
    }
    text = mixRgb(chosen, [0, 0, 0], high);
  }
  return {
    tint: rgbToHex(tint),
    color: rgbToHex(text),
    border: rgbToHex(mixRgb(tint, text, 0.14)),
  };
}

function legacyGroupHue(groupId) {
  let hash = 2166136261;
  for (const character of groupId) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return (hash >>> 0) % 360;
}

export function defaultGroupColorKey(groupId) {
  const hue = legacyGroupHue(groupId);
  // Existing groups without an explicit color keep their original hue mapping.
  return GROUP_COLOR_PALETTE.filter(option => option.key !== 'yellow').reduce((closest, option) => {
    const distance = Math.abs(((hue - option.hue + 540) % 360) - 180);
    return !closest || distance < closest.distance ? { key: option.key, distance } : closest;
  }, null)?.key || 'blue';
}

export function buildGroupColorMap(groups) {
  const usedHues = new Set();
  const colors = new Map();
  [...groups].sort((a, b) => a.id.localeCompare(b.id)).forEach(group => {
    const hex = normalizeGroupHex(group.colorKey);
    if (hex) {
      const custom = customGroupColorValues(hex);
      colors.set(group.id, {
        '--paper-group-tint': custom.tint,
        '--paper-group-color': custom.color,
        '--paper-group-border': custom.border,
      });
      return;
    }
    const selected = GROUP_COLOR_PALETTE.find(option => option.key === group.colorKey);
    let hue = selected?.hue ?? legacyGroupHue(group.id);
    if (!selected) {
      while (usedHues.has(hue)) hue = (hue + 37) % 360;
      usedHues.add(hue);
    }
    colors.set(group.id, {
      '--paper-group-tint': selected?.tint || `hsl(${hue} 72% 95%)`,
      '--paper-group-color': selected?.color || `hsl(${hue} 48% 36%)`,
      '--paper-group-border': selected?.border || `hsl(${hue} 45% 86%)`,
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

export function groupColorPreviewStyle(colorKey) {
  const hex = normalizeGroupHex(colorKey);
  if (hex) {
    const custom = customGroupColorValues(hex);
    return {
      '--group-preview-tint': custom.tint,
      '--group-preview-color': custom.color,
      '--group-preview-border': custom.border,
    };
  }
  const option = GROUP_COLOR_PALETTE.find(item => item.key === colorKey) || GROUP_COLOR_OPTIONS[0];
  const hue = option.hue;
  return {
    '--group-preview-tint': option.tint || `hsl(${hue} 72% 95%)`,
    '--group-preview-color': option.color || `hsl(${hue} 48% 36%)`,
    '--group-preview-border': option.border || `hsl(${hue} 45% 86%)`,
  };
}
