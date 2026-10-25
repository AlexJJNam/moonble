import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import worker from './worker.js';

const token = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFG';
const env = {
  SUPABASE_URL: 'https://example-project.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key',
  APP_ORIGIN: 'https://moonble.com',
  OG_IMAGE: 'https://moonble.com/assets/moonble-open-graph.png',
};

const paperSnapshot = {
  title: '<SQL & 데이터베이스>',
  description: '"상급" 문제 <20문항>',
  questions: [{
    q: '정규화의 목적은 무엇인가요?',
    options: ['중복을 줄입니다', '처리를 늦춥니다', '인덱스를 삭제합니다'],
  }],
};

test('human visitors are redirected to the app with the share token in the hash', async () => {
  const response = await worker.fetch(new Request(`https://share.moonble.com/${token}`, {
    headers: { 'user-agent': 'Mozilla/5.0' },
  }), env);

  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), `https://moonble.com/solve.html#share=${token}`);
});

test('social crawlers receive escaped, problem-specific Open Graph metadata', async () => {
  const originalFetch = globalThis.fetch;
  let rpcUrl;
  let rpcHeaders;
  let rpcBody;
  globalThis.fetch = async (input, init) => {
    rpcUrl = String(input);
    rpcHeaders = new Headers(init.headers);
    rpcBody = JSON.parse(init.body);
    return new Response(JSON.stringify(paperSnapshot), { headers: { 'content-type': 'application/json' } });
  };

  try {
    const response = await worker.fetch(new Request(`https://share.moonble.com/${token}`, {
      headers: { 'user-agent': 'facebookexternalhit/1.1' },
    }), env);
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.match(rpcUrl, /\/rest\/v1\/rpc\/moonble_get_quiz_share$/);
    assert.equal(rpcHeaders.get('apikey'), env.SUPABASE_PUBLISHABLE_KEY);
    assert.equal(rpcBody.p_token_hash, createHash('sha256').update(token).digest('hex'));
    assert.match(html, /<title>\[문블\] &lt;SQL &amp; 데이터베이스&gt; · Moonble<\/title>/);
    assert.match(html, /<meta property="og:title" content="\[문블\] &lt;SQL &amp; 데이터베이스&gt;">/);
    assert.match(html, /<meta property="og:description" content="&quot;상급&quot; 문제 &lt;20문항&gt;">/);
    assert.match(html, /<meta property="og:image" content="https:\/\/share\.moonble\.com\/[A-Za-z0-9_-]+\/thumbnail\.png\?preview=4&amp;tint=%23e8f3ff&amp;group=%EB%AF%B8%EB%B6%84%EB%A5%98">/);
    assert.match(html, /<meta property="og:image:type" content="image\/png">/);
    assert.match(html, /<meta property="og:image:width" content="1200">/);
    assert.match(html, /<meta property="og:image:height" content="675">/);
    assert.match(html, new RegExp(`<meta property="og:url" content="https://share\\.moonble\\.com/${token}">`));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('shared quiz thumbnail renders the saved paper preview as an accessible image', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify(paperSnapshot), {
    headers: { 'content-type': 'application/json' },
  });
  try {
    const response = await worker.fetch(new Request(`https://share.moonble.com/${token}/thumbnail.svg?preview=3&tint=%23e8f3ff&group=%EB%AF%B8%EB%B6%84%EB%A5%98`, {
      headers: { 'user-agent': 'kakaotalk-scrap/1.0' },
    }), env);
    const svg = await response.text();
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /image\/svg\+xml/);
    assert.match(svg, /\[문블\] &lt;SQL &amp; 데이터베이스&gt; 문제지 미리보기/);
    assert.match(svg, /width="1200" height="675" viewBox="0 0 300 168\.75"/);
    assert.match(svg, /fill="#e8f3ff"/);
    assert.match(svg, /class="group-label" x="15" y="23">미분류<\/text>/);
    assert.match(svg, /data:image\/png;base64,/);
    assert.match(svg, /rotate\(-2 /);
    assert.match(svg, /정규화의 목적은 무엇인가요\?/);
    assert.match(svg, /중복을 줄입니다/);
    assert.doesNotMatch(svg, /<script/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('share thumbnail PNG endpoint returns a public, directly readable PNG', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify(paperSnapshot), {
    headers: { 'content-type': 'application/json' },
  });
  try {
    const response = await worker.fetch(new Request(`https://share.moonble.com/${token}/thumbnail.png?preview=4&tint=%23e8f3ff&group=%EB%AF%B8%EB%B6%84%EB%A5%98`, {
      headers: { 'user-agent': 'kakaotalk-scrap/1.0' },
    }), env);
    const image = new Uint8Array(await response.arrayBuffer());
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /image\/png/);
    assert.match(response.headers.get('cache-control'), /public/);
    assert.deepEqual(Array.from(image.slice(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('invalid and revoked links are not exposed to the app or crawler', async () => {
  const invalid = await worker.fetch(new Request('https://share.moonble.com/not-a-token', {
    headers: { 'user-agent': 'Mozilla/5.0' },
  }), env);
  assert.equal(invalid.status, 404);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('null', { headers: { 'content-type': 'application/json' } });
  try {
    const revoked = await worker.fetch(new Request(`https://share.moonble.com/${token}`, {
      headers: { 'user-agent': 'kakaotalk-scrap/1.0' },
    }), env);
    assert.equal(revoked.status, 404);
    assert.match(await revoked.text(), /공유 링크가 만료됐거나 중지됐어요/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('HEAD crawler requests return metadata headers without an HTML body', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ title: '테스트 문제지', description: '', questions: [] }), {
    headers: { 'content-type': 'application/json' },
  });
  try {
    const response = await worker.fetch(new Request(`https://share.moonble.com/${token}`, {
      method: 'HEAD',
      headers: { 'user-agent': 'Twitterbot' },
    }), env);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/html/);
    assert.equal(await response.text(), '');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
