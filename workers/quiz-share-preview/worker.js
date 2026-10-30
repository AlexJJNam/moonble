import { Resvg } from '@cf-wasm/resvg';
import { PRETENDARD_REGULAR_BASE64 } from './pretendard-font.js';

const pretendardBinary = atob(PRETENDARD_REGULAR_BASE64);
const pretendardRegular = Uint8Array.from(pretendardBinary, character => character.charCodeAt(0));

const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{40,50}$/;
const CRAWLER_PATTERN = /(?:bot|crawler|spider|slurp|facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|discordbot|telegrambot|whatsapp|kakao[^\s]*scrap|naverbot|google-inspectiontool)/i;
const META_IMAGE_FALLBACK = 'https://moonble.com/assets/moonble-open-graph.png';
const PREVIEW_TINT_FALLBACK = '#e8f3ff';
const PREVIEW_WORDMARK = 'data:image/png;base64,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';

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  })[char]);
}

function textWidth(character, fontSize) {
  if (/[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/u.test(character)) return fontSize;
  if (/\s/u.test(character)) return fontSize * 0.28;
  if (/[ilI1.,:;'!|]/u.test(character)) return fontSize * 0.3;
  if (/[MW@#%&]/u.test(character)) return fontSize * 0.78;
  if (/[A-Z0-9]/u.test(character)) return fontSize * 0.58;
  return fontSize * 0.52;
}

function wrapText(value, maxWidth, fontSize, maxLines = 2, letterSpacing = 0) {
  const characters = Array.from(String(value || '').trim());
  const lines = [];
  let line = '';
  let lineWidth = 0;
  while (characters.length) {
    const character = characters.shift();
    const width = textWidth(character, fontSize) + letterSpacing;
    if (line && lineWidth + width > maxWidth) {
      lines.push(line);
      line = '';
      lineWidth = 0;
      if (lines.length === maxLines) break;
    }
    line += character;
    lineWidth += width;
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (characters.length && lines.length) {
    let finalLine = Array.from(lines.at(-1));
    while (finalLine.length > 1 && finalLine.reduce((sum, character) => sum + textWidth(character, fontSize) + letterSpacing, 0) + textWidth('…', fontSize) > maxWidth) finalLine.pop();
    lines[lines.length - 1] = `${finalLine.join('')}…`;
  }
  return lines.length ? lines : [''];
}

function svgLines(lines, x, y, lineHeight) {
  return lines.map((line, index) => `<tspan x="${x}" y="${y + index * lineHeight}">${escapeXml(line)}</tspan>`).join('');
}

function previewTint(value) {
  if (typeof value !== 'string') return PREVIEW_TINT_FALLBACK;
  if (/^#[0-9a-f]{6}$/i.test(value)) return value;
  const hueTint = value.match(/^hsl\((\d{1,3}) 72% 95%\)$/);
  if (hueTint && Number(hueTint[1]) <= 359) return value;
  return PREVIEW_TINT_FALLBACK;
}

function previewImage(paper, tint = PREVIEW_TINT_FALLBACK, groupName = '미분류') {
  const width = 300;
  const height = 168.75;
  const padding = 14;
  const sheetWidth = 260 * 0.72;
  const sheetHeight = (height - 16 - 1) * 1.62;
  const sheetX = 20 + (260 - sheetWidth) / 2;
  const sheetY = 18;
  const contentX = sheetX + padding;
  const contentWidth = sheetWidth - padding * 2 - 2;
  const sheetCenterX = sheetX + sheetWidth / 2;
  const sheetCenterY = sheetY + sheetHeight / 2;
  const titleLines = wrapText(paper.title, contentWidth, 11, 2, -0.275);
  const titleY = sheetY + padding + 12.67 + 10 + 12;
  const subtitleY = titleY + titleLines.length * 16 + 3 + 9;
  let questionCursor = subtitleY + 13;
  const groupLabel = wrapText(groupName, 230, 11, 1)[0];
  const groupWidth = Math.min(230, Array.from(groupLabel).reduce((sum, character) => sum + textWidth(character, 11), 0) + 16);
  const questions = (paper.questions || []).slice(0, 2);
  const questionMarkup = questions.map((question, index) => {
    const firstTop = questionCursor;
    const questionLines = wrapText(question.q || '', contentWidth - 12, 8, 3);
    const titleBaseline = firstTop + 1 + 9 + 9;
    const qTitle = svgLines(questionLines, contentX + 12, titleBaseline, 12);
    const options = (question.options || []).slice(0, 3);
    const optionsStart = titleBaseline + (questionLines.length - 1) * 12 + 22;
    const optionMarkup = options.map((option, optionIndex) => {
      const textLines = wrapText(option, contentWidth - 24, 7, 2);
      const y = optionsStart + optionIndex * 14;
      return `<g><circle cx="${contentX + 16.5}" cy="${y - 2.5}" r="2.5" fill="none" stroke="#b0b8c1" stroke-width="0.75"/><text class="option">${svgLines(textLines, contentX + 24, y, 10)}</text></g>`;
    }).join('');
    questionCursor = options.length
      ? optionsStart + (options.length - 1) * 14 + 12
      : titleBaseline + (questionLines.length - 1) * 12 + 15;
    return `<g><line x1="${contentX}" x2="${contentX + contentWidth}" y1="${firstTop}" y2="${firstTop}" stroke="#e5e8eb" stroke-width="0.75"/><text class="question-number" x="${contentX}" y="${titleBaseline}">${String(index + 1).padStart(2, '0')}</text><text class="question-title">${qTitle}</text>${optionMarkup}</g>`;
  }).join('');
  const count = Math.max(0, paper.questions?.length || 0);
  const label = `${count}문항`;
  const badgeTextWidth = Array.from(label).reduce((sum, character) => sum + textWidth(character, 10), 0);
  const badgeWidth = badgeTextWidth + 14;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(`[문블] ${paper.title} 문제지 미리보기`)}">
  <defs><clipPath id="frame"><rect width="${width}" height="${height}" rx="16"/></clipPath></defs>
  <g clip-path="url(#frame)">
    <rect width="${width}" height="${height}" fill="${escapeXml(previewTint(tint))}"/>
    <g><rect x="7" y="7" width="${groupWidth}" height="24" rx="5" fill="#1a1f27" fill-opacity=".88"/><text class="group-label" x="15" y="23">${escapeXml(groupLabel)}</text></g>
    <g transform="translate(0 2) rotate(-2 ${sheetCenterX} ${sheetCenterY})">
      <rect x="${sheetX}" y="${sheetY}" width="${sheetWidth}" height="${sheetHeight}" rx="9" fill="#fff" stroke="#e5e8eb" stroke-width="1"/>
      <image x="${sheetX + padding}" y="${sheetY + padding}" width="38" height="12.67" href="${PREVIEW_WORDMARK}" preserveAspectRatio="xMinYMid meet"/>
      <text class="paper-title">${svgLines(titleLines, sheetX + padding, titleY, 16)}</text>
      <text class="subtitle" x="${sheetX + padding}" y="${subtitleY}">개념을 확인하는 작은 시작</text>
      ${questionMarkup}
    </g>
    <g transform="translate(${width - 10} ${height - 9})"><rect x="-${badgeWidth}" y="-21" width="${badgeWidth}" height="21" rx="5" fill="#191f28" fill-opacity=".72"/><text class="count" x="-${badgeWidth / 2}" y="-6" text-anchor="middle">${escapeXml(label)}</text></g>
    <line x1="0" x2="${width}" y1="${height - 0.5}" y2="${height - 0.5}" stroke="#e5e8eb" stroke-width="1"/>
  </g>
  <style>
    text { font-family: Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif; }
    .paper-title { fill:#191f28; font-size:11px; font-weight:700; letter-spacing:-.275px }
    .group-label { fill:#fff; font-size:11px; font-weight:700; }
    .subtitle { fill:#6b7684; font-size:8px; }
    .question-number { fill:#1b64da; font-size:8px; font-weight:700; }
    .question-title { fill:#191f28; font-size:8px; font-weight:600; }
    .option { fill:#4e5968; font-size:7px; }
    .count { fill:#fff; font-size:10px; font-weight:600; }
  </style>
</svg>`;
}

async function previewPng(paper, tint = PREVIEW_TINT_FALLBACK, groupName = '미분류') {
  const renderer = await Resvg.async(previewImage(paper, tint, groupName), {
    fitTo: { mode: 'width', value: 1200 },
    font: {
      fontBuffers: [pretendardRegular],
      defaultFontFamily: 'Pretendard',
      sansSerifFamily: 'Pretendard',
      loadSystemFonts: false,
    },
  });
  return renderer.render().asPng();
}

async function hashToken(token) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function getSharedPaper(token, env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
    throw new Error('Share preview service is not configured.');
  }

  const endpoint = new URL('/rest/v1/rpc/moonble_get_quiz_share', env.SUPABASE_URL);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_PUBLISHABLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_token_hash: await hashToken(token) }),
  });
  if (!response.ok) return null;

  const data = await response.json();
  if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data.title !== 'string') return null;
  return {
    title: data.title.trim().slice(0, 100) || '공유 문제지',
    description: typeof data.description === 'string'
      ? data.description.trim().slice(0, 300)
      : '',
    questions: Array.isArray(data.questions) ? data.questions.slice(0, 100).map(question => ({
      q: typeof question?.q === 'string' ? question.q.slice(0, 300) : '',
      options: Array.isArray(question?.options) ? question.options.slice(0, 4).filter(option => typeof option === 'string').map(option => option.slice(0, 150)) : [],
    })) : [],
  };
}

function appQuizUrl(token, env) {
  const appOrigin = env.APP_ORIGIN || 'https://moonble.com';
  return `${new URL('/solve.html', appOrigin).href}#share=${encodeURIComponent(token)}`;
}

function previewHtml(token, paper, requestUrl, env) {
  const title = `[문블] ${paper.title}`;
  const description = paper.description || '공유된 문제지를 풀고 결과를 확인해보세요.';
  const canonicalUrl = new URL(requestUrl).href;
  const requestParams = new URL(requestUrl).searchParams;
  const tint = previewTint(requestParams.get('tint'));
  const group = (requestParams.get('group') || '미분류').slice(0, 80);
  const imageUrl = paper.questions.length
    ? new URL(`/${encodeURIComponent(token)}/thumbnail.png?preview=4&tint=${encodeURIComponent(tint)}&group=${encodeURIComponent(group)}`, requestUrl).href
    : (env.OG_IMAGE || META_IMAGE_FALLBACK);
  const solveUrl = appQuizUrl(token, env);
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeCanonicalUrl = escapeHtml(canonicalUrl);
  const safeImageUrl = escapeHtml(imageUrl);
  const safeSolveUrl = escapeHtml(solveUrl);

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${safeTitle} · Moonble</title>
  <meta name="description" content="${safeDescription}">
  <link rel="canonical" href="${safeCanonicalUrl}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Moonble">
  <meta property="og:locale" content="ko_KR">
  <meta property="og:title" content="${safeTitle}">
  <meta property="og:description" content="${safeDescription}">
  <meta property="og:url" content="${safeCanonicalUrl}">
  <meta property="og:image" content="${safeImageUrl}">
  <meta property="og:image:url" content="${safeImageUrl}">
  <meta property="og:image:secure_url" content="${safeImageUrl}">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="675">
  <meta property="og:image:alt" content="${escapeHtml(`${title} 문제지 미리보기`)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${safeTitle}">
  <meta name="twitter:description" content="${safeDescription}">
  <meta name="twitter:image" content="${safeImageUrl}">
</head>
<body>
  <main>
    <h1>${safeTitle}</h1>
    <p>${safeDescription}</p>
    <a href="${safeSolveUrl}">문제 풀기</a>
  </main>
</body>
</html>`;
}

function svgResponse(body) {
  return new Response(body, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function htmlResponse(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store, no-cache, max-age=0',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      Vary: 'User-Agent',
    },
  });
}

// 내 캘린더에 저장(.ics): 앱이 일정 정보를 e 파라미터(base64url JSON)로 보내면 일정 파일(그날 한 번 또는 매주 반복)을 만든다.
// text/calendar로 바로 내려 주면 iPhone은 '캘린더에 추가' 화면을, PC는 파일 저장을 띄운다. 서버에 저장하지 않는다.
const ICS_DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const ICS_NOTIFY = new Set([0, 5, 10, 15, 30, 60]);

function decodeCalendarParam(value) {
  if (!value || value.length > 4000 || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4));
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, char => char.charCodeAt(0))));
  } catch { return null; }
}

function calendarEvent(input) {
  if (!input || typeof input !== 'object') return null;
  const title = String(input.t || '').trim().slice(0, 40);
  const memo = String(input.m || '').slice(0, 500);
  // w=0이면 f 날짜에 한 번, 아니면 f(시작 날짜, 없어도 된다)부터 매주 반복
  const weekly = input.w !== 0;
  const from = String(input.f || '');
  const fromDate = /^\d{4}-\d{2}-\d{2}$/.test(from) ? new Date(`${from}T00:00:00Z`) : null;
  const hasFrom = Boolean(fromDate) && !Number.isNaN(fromDate.getTime()) && fromDate.toISOString().slice(0, 10) === from;
  if (!weekly && !hasFrom) return null;
  const days = weekly
    ? [...new Set((Array.isArray(input.d) ? input.d : []).map(Number))].filter(day => Number.isInteger(day) && day >= 0 && day <= 6)
    : [fromDate.getUTCDay()];
  const start = String(input.s || '');
  const end = String(input.e || '');
  const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!title || !days.length || !timePattern.test(start) || !timePattern.test(end) || end <= start) return null;
  let timeZone = 'Asia/Seoul';
  try { new Intl.DateTimeFormat('en-US', { timeZone: String(input.z || '') }); timeZone = String(input.z || 'Asia/Seoul') || 'Asia/Seoul'; } catch { timeZone = 'Asia/Seoul'; }
  const notify = input.n === null || input.n === undefined ? null : Number(input.n);
  let url = '';
  try { const parsed = new URL(String(input.u || '')); if (parsed.protocol === 'https:' && parsed.hostname === 'moonble.com') url = parsed.href; } catch { url = ''; }
  return {
    title, memo, days, start, end, timeZone, url, weekly, from: hasFrom ? from : '',
    notify: ICS_NOTIFY.has(notify) ? notify : null,
    paperTitle: String(input.p || '').slice(0, 100),
    uid: /^[A-Za-z0-9-]{1,80}$/.test(String(input.i || '')) ? String(input.i) : crypto.randomUUID(),
  };
}

function icsText(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

// 한 줄 75바이트 넘으면 접는다(RFC 5545).
function foldIcsLine(line) {
  const encoder = new TextEncoder();
  let output = '';
  let current = '';
  let size = 0;
  for (const char of line) {
    const width = encoder.encode(char).length;
    if (size + width > 74) { output += `${current}\r\n `; current = ''; size = 1; }
    current += char;
    size += width;
  }
  return output + current;
}

// 일정 시간대의 오늘
function localToday(timeZone, now) {
  const [year, month, day] = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

// base부터 처음 오는 반복 요일을 시작일로 쓴다. 시간은 기기 시간대 기준(floating)으로 둔다.
function firstOccurrence(days, base) {
  for (let offset = 0; offset < 7; offset += 1) {
    const candidate = new Date(base.getTime() + offset * 86400000);
    if (days.includes(candidate.getUTCDay())) return candidate;
  }
  return base;
}

export function scheduleIcs(event, now = new Date()) {
  const weekly = event.weekly !== false;
  const from = event.from ? new Date(`${event.from}T00:00:00Z`) : null;
  const today = localToday(event.timeZone, now);
  const date = weekly ? firstOccurrence(event.days, from && from > today ? from : today) : from;
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, '');
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const description = [
    event.memo,
    event.paperTitle && `예약한 문제지: ${event.paperTitle}`,
    event.url,
    '문블 시간표에서 만든 일정이에요.',
  ].filter(Boolean).join('\n');
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Moonble//Study Timetable//KO', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.uid}@moonble.com`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${ymd}T${event.start.replace(':', '')}00`,
    `DTEND:${ymd}T${event.end.replace(':', '')}00`,
    ...(weekly ? [`RRULE:FREQ=WEEKLY;WKST=MO;BYDAY=${event.days.map(day => ICS_DAYS[day]).join(',')}`] : []),
    `SUMMARY:${icsText(event.title)}`,
    `DESCRIPTION:${icsText(description)}`,
    ...(event.url ? [`URL:${event.url}`] : []),
    ...(event.notify === null ? [] : ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(event.title)}`, `TRIGGER:${event.notify ? `-PT${event.notify}M` : 'PT0M'}`, 'END:VALARM']),
    'END:VEVENT', 'END:VCALENDAR',
  ];
  return `${lines.map(foldIcsLine).join('\r\n')}\r\n`;
}

function calendarResponse(request, url) {
  const event = calendarEvent(decodeCalendarParam(url.searchParams.get('e')));
  if (!event) return htmlResponse('일정 정보를 읽지 못했어요.', 400);
  return new Response(request.method === 'HEAD' ? null : scheduleIcs(event), { headers: {
    'Content-Type': 'text/calendar; charset=utf-8',
    'Content-Disposition': 'inline; filename="moonble-schedule.ics"',
    'Cache-Control': 'private, no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/calendar.ics') return calendarResponse(request, url);
    const thumbnailMatch = url.pathname.match(/^\/([A-Za-z0-9_-]{40,50})\/thumbnail\.(png|svg)$/);
    if (thumbnailMatch) {
      try {
        const paper = await getSharedPaper(thumbnailMatch[1], env);
        if (!paper) return htmlResponse('공유 링크가 만료됐거나 중지됐어요.', 404);
        if (!paper.questions.length) return htmlResponse('문제지 미리보기가 없습니다.', 404);
        const tint = previewTint(url.searchParams.get('tint'));
        const group = (url.searchParams.get('group') || '미분류').slice(0, 80);
        const png = thumbnailMatch[2] === 'png';
        if (request.method === 'HEAD') return new Response(null, { headers: { 'Content-Type': png ? 'image/png' : 'image/svg+xml; charset=utf-8' } });
        if (png) {
          const image = await previewPng(paper, tint, group);
          return new Response(image, { headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=300, s-maxage=900',
            'X-Content-Type-Options': 'nosniff',
            'Access-Control-Allow-Origin': '*',
          } });
        }
        return svgResponse(previewImage(paper, tint, group));
      } catch {
        return htmlResponse('문제지 미리보기를 불러오지 못했어요.', 503);
      }
    }

    const token = url.pathname.split('/').filter(Boolean).at(-1) || '';
    if (!SHARE_TOKEN_PATTERN.test(token)) return htmlResponse('Not found', 404);

    const userAgent = request.headers.get('user-agent') || '';
    if (!CRAWLER_PATTERN.test(userAgent)) {
      return new Response(null, {
        status: 302,
        headers: {
          Location: appQuizUrl(token, env),
          'Cache-Control': 'private, no-store, no-cache, max-age=0',
          'Referrer-Policy': 'no-referrer',
          Vary: 'User-Agent',
        },
      });
    }

    try {
      const paper = await getSharedPaper(token, env);
      if (!paper) return htmlResponse('공유 링크가 만료됐거나 중지됐어요.', 404);
      const body = request.method === 'HEAD' ? null : previewHtml(token, paper, request.url, env);
      return htmlResponse(body);
    } catch {
      return htmlResponse('공유 미리보기를 불러오지 못했어요.', 503);
    }
  },
};
