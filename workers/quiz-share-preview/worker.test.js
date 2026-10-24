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
    return new Response(JSON.stringify({
      title: '<SQL & 데이터베이스>',
      description: '"상급" 문제 <20문항>',
      questions: [],
    }), { headers: { 'content-type': 'application/json' } });
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
    assert.match(html, /<title>&lt;SQL &amp; 데이터베이스&gt; · Moonble<\/title>/);
    assert.match(html, /<meta property="og:title" content="&lt;SQL &amp; 데이터베이스&gt;">/);
    assert.match(html, /<meta property="og:description" content="&quot;상급&quot; 문제 &lt;20문항&gt;">/);
    assert.match(html, /<meta property="og:image" content="https:\/\/moonble\.com\/assets\/moonble-open-graph\.png">/);
    assert.match(html, new RegExp(`<meta property="og:url" content="https://share\\.moonble\\.com/${token}">`));
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
  globalThis.fetch = async () => new Response(JSON.stringify({ title: '테스트 문제지', description: '' }), {
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
