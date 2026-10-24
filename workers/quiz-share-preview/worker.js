const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{40,50}$/;
const CRAWLER_PATTERN = /(?:bot|crawler|spider|slurp|facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|discordbot|telegrambot|whatsapp|kakao[^\s]*scrap|naverbot|google-inspectiontool)/i;
const META_IMAGE_FALLBACK = 'https://moonble.com/assets/moonble-open-graph.png';

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

function splitText(value, maxLength, maxLines = 2) {
  const words = Array.from(String(value || '').trim());
  const lines = [];
  while (words.length && lines.length < maxLines) lines.push(words.splice(0, maxLength).join(''));
  if (words.length && lines.length) lines[lines.length - 1] = `${Array.from(lines.at(-1)).slice(0, maxLength - 1).join('')}…`;
  return lines.length ? lines : [''];
}

function svgLines(lines, x, y, lineHeight, className) {
  return `<text class="${className}" x="${x}" y="${y}">${lines.map((line, index) => `<tspan x="${x}" dy="${index ? lineHeight : 0}">${escapeXml(line)}</tspan>`).join('')}</text>`;
}

function previewImage(paper) {
  const question = paper.questions?.[0];
  const titleLines = splitText(paper.title, 25, 2);
  const questionLines = splitText(question?.q || '', 42, 2);
  const optionLines = (question?.options || []).slice(0, 3).map(option => splitText(option, 43, 1)[0]);
  const titleSvg = svgLines(titleLines, 282, 194, 38, 'paper-title');
  const questionSvg = question
    ? svgLines(questionLines, 333, 321, 27, 'question-title')
    : '<text class="question-title" x="333" y="321">공유된 문제지를 풀고 결과를 확인해보세요.</text>';
  const optionStartY = 321 + questionLines.length * 27 + 24;
  const optionsSvg = optionLines.map((option, index) => `<g transform="translate(0 ${optionStartY + index * 32})"><circle cx="340" cy="-5" r="5" fill="none" stroke="#aeb8c5" stroke-width="2"/><text class="option" x="356" y="0">${escapeXml(option)}</text></g>`).join('');
  const count = Math.max(0, paper.questions?.length || 0);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="${escapeXml(`[문블] ${paper.title} 문제지 미리보기`)}">
  <defs><clipPath id="frame"><rect width="1200" height="630" rx="26"/></clipPath></defs>
  <g clip-path="url(#frame)">
    <rect width="1200" height="630" fill="#e8f3ff"/>
    <rect x="224" y="25" width="752" height="850" rx="11" fill="#fff" stroke="#e1e6ec" stroke-width="2" transform="rotate(-1.4 600 300)"/>
    <g transform="rotate(-1.4 600 300)">
      <text x="282" y="117" fill="#2678ee" font-family="Arial, sans-serif" font-size="27" font-style="italic" font-weight="700">moonble</text>
      <text x="918" y="117" text-anchor="end" fill="#64748b" font-family="Arial, sans-serif" font-size="17">문제지</text>
      ${titleSvg}
      <text class="subtitle" x="282" y="270">개념을 확인하는 작은 시작</text>
      <line x1="282" x2="918" y1="291" y2="291" stroke="#e1e6ec" stroke-width="2"/>
      <text class="number" x="282" y="329">01</text>
      ${questionSvg}
      ${optionsSvg}
    </g>
    <g transform="translate(1042 554)"><rect width="112" height="42" rx="11" fill="#555d66"/><text x="56" y="27" text-anchor="middle" fill="#fff" font-family="Arial, sans-serif" font-size="18" font-weight="700">${count}문항</text></g>
  </g>
  <style>
    .paper-title { fill:#191f28; font-family:Arial,sans-serif; font-size:32px; font-weight:700; letter-spacing:-.6px }
    .subtitle { fill:#6b7684; font-family:Arial,sans-serif; font-size:19px }
    .number { fill:#2678ee; font-family:Arial,sans-serif; font-size:19px; font-weight:700 }
    .question-title { fill:#191f28; font-family:Arial,sans-serif; font-size:21px; font-weight:700 }
    .option { fill:#6b7684; font-family:Arial,sans-serif; font-size:17px }
  </style>
</svg>`;
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
  const imageUrl = paper.questions.length
    ? new URL(`/${encodeURIComponent(token)}/thumbnail.svg?preview=2`, requestUrl).href
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
  <meta property="og:image:secure_url" content="${safeImageUrl}">
  <meta property="og:image:type" content="${paper.questions.length ? 'image/svg+xml' : 'image/png'}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const thumbnailMatch = url.pathname.match(/^\/([A-Za-z0-9_-]{40,50})\/thumbnail\.svg$/);
    if (thumbnailMatch) {
      try {
        const paper = await getSharedPaper(thumbnailMatch[1], env);
        if (!paper) return htmlResponse('공유 링크가 만료됐거나 중지됐어요.', 404);
        if (!paper.questions.length) return htmlResponse('문제지 미리보기가 없습니다.', 404);
        if (request.method === 'HEAD') return new Response(null, { headers: { 'Content-Type': 'image/svg+xml; charset=utf-8' } });
        return svgResponse(previewImage(paper));
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
