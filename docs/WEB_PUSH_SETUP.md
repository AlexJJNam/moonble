# Background web push setup

Moonble currently detects shared-quiz submissions while a signed-in page is open. This setup stores each browser's Web Push subscription, sends a push from Supabase when a `quiz_share_notifications` row is inserted, and displays it from the service worker while the page is closed.

## 1. Add the database migration

After the existing profile avatar migration, run `database/009_web_push_subscriptions.sql` once in Supabase → SQL Editor. It creates a private subscription table and two authenticated RPCs. The table is not directly readable by browser clients.

## 2. Create VAPID keys

On a trusted local machine, run:

```sh
node scripts/generate-vapid-keys.mjs
```

Keep the output private. The `publicKey` is public configuration. The `privateKey` must only be stored in Supabase Edge Function secrets and must never be committed or sent in chat. Generate a separate random webhook secret (for example, `openssl rand -hex 32`) and keep it private too.

## 3. Configure the frontend public key

In the GitHub repository, open **Settings → Secrets and variables → Actions → Variables → New repository variable** and add:

- Name: `VITE_WEB_PUSH_PUBLIC_KEY`
- Value: the generated `publicKey`

This is a public VAPID key and is embedded in the site build. The private key does not belong in GitHub Pages variables.

## 4. Deploy the Supabase function

From this repository, link the Supabase project if it is not linked already and deploy the function:

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy quiz-share-push
```

In Supabase **Project Settings → Edge Functions → Secrets**, set:

- `VAPID_PUBLIC_KEY` — the same public key used in GitHub
- `VAPID_PRIVATE_KEY` — the generated private key
- `VAPID_SUBJECT` — `https://moonble.com`

Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions. Do not put the service-role key or VAPID private key into frontend variables.

## 5. Connect new submissions to the function

In Supabase **Database → Webhooks**, create a webhook with:

- Table: `public.quiz_share_notifications`
- Event: `INSERT`
- Type of webhook: **Supabase Edge Functions**
- Function: `quiz-share-push`
- Under **HTTP Headers**, choose **Add secret key**

The function verifies the project secret API key on the webhook request before it reads subscriptions or sends notifications. Supabase's Database Webhook setup stores this key in its trigger definition; do not put it in source control or screenshots. If configuring a plain HTTP webhook instead, set `PUSH_WEBHOOK_SECRET` in Edge Function secrets and send it as `x-moonble-push-secret`.

## 6. Publish and enable on each device

Push the frontend change to `main` after adding the GitHub variable; the Pages workflow will embed the public key. Each signed-in device must then open **알림 → 푸시 알림 켜기** once to grant permission and register its browser subscription.

On iPhone or iPad, first use Safari's **Share → Add to Home Screen**, launch the installed Moonble app, then enable notifications there. iOS/iPadOS web push is available to Home Screen web apps on version 16.4 and later; permission must be requested from a user action. Other supported browsers also require a secure HTTPS origin and a one-time permission grant.

Until the migration, keys, function, webhook, frontend deployment, and per-device opt-in are all complete, the UI will keep push setup disabled and continue to show in-app notification history when the site is open.
