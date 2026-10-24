const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{40,50}$/;
const CRAWLER_PATTERN = /(?:bot|crawler|spider|slurp|facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|discordbot|telegrambot|whatsapp|kakao[^\s]*scrap|naverbot|google-inspectiontool)/i;
const META_IMAGE_FALLBACK = 'https://moonble.com/assets/moonble-open-graph.png';

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
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
  };
}

function appQuizUrl(token, env) {
  const appOrigin = env.APP_ORIGIN || 'https://moonble.com';
  return `${new URL('/solve.html', appOrigin).href}#share=${encodeURIComponent(token)}`;
}

function previewHtml(token, paper, requestUrl, env) {
  const title = paper.title;
  const description = paper.description || '공유된 문제지를 풀고 결과를 확인해보세요.';
  const canonicalUrl = new URL(requestUrl).href;
  const imageUrl = env.OG_IMAGE || META_IMAGE_FALLBACK;
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
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="흰색 배경의 파란색 Moonble 로고">
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
