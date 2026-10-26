import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

type QuizShareNotification = {
  id: string;
  owner_id: string;
  paper_title: string;
  score: number;
  correct_count: number;
  total_count: number;
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

async function secretMatches(received: string, expected: string) {
  if (!received || !expected || received.length > 1024) return false;
  const encoder = new TextEncoder();
  const [receivedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(received)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  const left = new Uint8Array(receivedHash);
  const right = new Uint8Array(expectedHash);
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

Deno.serve(async request => {
  if (request.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SECRET_KEY') || '';
  let configuredSecretKeys: string[] = [];
  try {
    const parsedKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
    configuredSecretKeys = Object.values(parsedKeys).filter((value): value is string => typeof value === 'string');
  } catch { /* 구버전 프로젝트는 개별 secret key 환경변수를 제공할 수 있다. */ }
  const expectedWebhookSecret = Deno.env.get('PUSH_WEBHOOK_SECRET') || '';
  const customHeaderSecret = request.headers.get('x-moonble-push-secret') || '';
  const apiKey = request.headers.get('apikey') || '';
  const bearerSecret = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  const apiKeyMatches = apiKey !== '' && (await Promise.all([
    ...configuredSecretKeys.map(key => secretMatches(apiKey, key)),
    secretMatches(apiKey, Deno.env.get('SUPABASE_SECRET_KEY') || ''),
  ])).some(Boolean);
  const authorized = await secretMatches(customHeaderSecret, expectedWebhookSecret)
    || apiKeyMatches
    || await secretMatches(bearerSecret, expectedWebhookSecret)
    || await secretMatches(bearerSecret, serviceRoleKey);
  if (!authorized) return jsonResponse(401, { error: 'Unauthorized' });

  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY') || '';
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') || '';
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'https://moonble.com';
  if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey) {
    console.error('Push function configuration is incomplete.');
    return jsonResponse(500, { error: 'Push service is not configured' });
  }

  let payload: { type?: string; table?: string; schema?: string; record?: QuizShareNotification };
  try {
    payload = await request.json();
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON payload' });
  }
  if (payload.type !== 'INSERT' || payload.table !== 'quiz_share_notifications' || payload.schema !== 'public') {
    return jsonResponse(202, { ignored: true });
  }

  const notification = payload.record;
  if (!notification?.id || !notification.owner_id || typeof notification.paper_title !== 'string') {
    return jsonResponse(400, { error: 'Invalid notification record' });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: subscriptions, error } = await supabase
    .from('web_push_subscriptions')
    .select('endpoint, subscription')
    .eq('user_id', notification.owner_id);
  if (error) {
    console.error('Unable to load push subscriptions:', error.message);
    return jsonResponse(500, { error: 'Unable to load subscriptions' });
  }
  if (!subscriptions?.length) return jsonResponse(200, { sent: 0 });

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  const message = JSON.stringify({
    title: '문블 · 공유한 문제 풀이',
    body: `${notification.paper_title.slice(0, 80)} · ${notification.score}점 (${notification.correct_count}/${notification.total_count})`,
    tag: `moonble-share-${notification.id}`,
    url: 'https://moonble.com/quiz.html?openNotifications=1',
  });

  const results = await Promise.all(subscriptions.map(async item => {
    try {
      await webpush.sendNotification(item.subscription, message, { TTL: 3600 });
      return true;
    } catch (sendError) {
      const statusCode = Number((sendError as { statusCode?: number })?.statusCode || 0);
      if (statusCode === 404 || statusCode === 410) {
        await supabase.from('web_push_subscriptions').delete().eq('endpoint', item.endpoint);
      } else {
        console.warn('A web push delivery failed.', statusCode || 'unknown status');
      }
      return false;
    }
  }));

  return jsonResponse(200, { sent: results.filter(Boolean).length, attempted: results.length });
});
