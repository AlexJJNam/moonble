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

The `deploy-web-push.yml` workflow deploys `quiz-share-push` when its source changes. Add these GitHub Actions settings once:

**Actions → Secrets and variables → Actions → Variables**

- `VITE_WEB_PUSH_PUBLIC_KEY` — the generated public key (the Pages workflow embeds the same value in the site)

**Actions → Secrets and variables → Actions → Secrets**

- `SUPABASE_ACCESS_TOKEN` — a Supabase personal access token for CLI deployments
- `VAPID_PRIVATE_KEY` — the private key generated in step 2

The workflow uses the existing `VITE_SUPABASE_URL` repository variable to identify the Supabase project, writes the VAPID key pair and `VAPID_SUBJECT=https://moonble.com` to that project's Edge Function secrets, then deploys the function. The private key is passed through GitHub Actions as an encrypted secret and is never included in the site build or source code. Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to the function automatically.

To deploy it immediately after adding these settings, open **GitHub → Actions → Deploy background web push → Run workflow**. Later changes to the function deploy automatically when pushed to `main`.

## 5. Connect new submissions to the function

In Supabase **Database → Webhooks**, create a webhook with:

- Table: `public.quiz_share_notifications`
- Event: `INSERT`
- Type of webhook: **Supabase Edge Functions**
- Function: `quiz-share-push`
- Under **HTTP Headers**, choose **Add secret key**

The function verifies the project secret API key on the webhook request before it reads subscriptions or sends notifications. Supabase's Database Webhook setup stores this key in its trigger definition; do not put it in source control or screenshots. If configuring a plain HTTP webhook instead, set `PUSH_WEBHOOK_SECRET` in Edge Function secrets and send it as `x-moonble-push-secret`.

## 6. Publish and enable on each device

After adding the GitHub settings, run **Actions → Deploy background web push → Run workflow** to deploy the sender. Then run **Actions → Build and deploy Moonble → Run workflow** so the public VAPID key is included in the website. In Supabase, confirm the `quiz-share-push` Edge Function has the three VAPID secrets and that the `quiz_share_notifications` INSERT webhook is enabled. Each signed-in device must open **알림 → 푸시 알림 켜기** once to grant permission and register its browser subscription.

On iPhone or iPad, first use Safari's **Share → Add to Home Screen**, launch the installed Moonble app, then enable notifications there. iOS/iPadOS web push is available to Home Screen web apps on version 16.4 and later; permission must be requested from a user action. Other supported browsers also require a secure HTTPS origin and a one-time permission grant.

Until the migration, keys, function, webhook, frontend deployment, and per-device opt-in are all complete, the UI will keep push setup disabled and continue to show in-app notification history when the site is open. A Cloudflare API token is separate from `SUPABASE_ACCESS_TOKEN` and cannot deploy this Edge Function.

## 7. Study schedule reminders (워크스페이스 시간표)

The workspace timetable (`prd.html`, default tab) stores weekly study schedules in `public.study_schedules` (RLS: each user reads and writes only their own rows). A schedule can link a paper; tapping its reminder opens that paper's solve screen.

**Now (app work):** run `database/024_study_schedules.sql`. It creates the schedule table, the reminder queue `public.study_reminder_notifications` and `moonble_enqueue_study_reminders()`, but schedules no background job. Then run `database/026_study_schedule_dates.sql`, which adds one-time dates and weekly start dates (`repeat_weekly`, `start_date`) and makes the reminder queue respect them. Schedules saved on a device before 024/026 move to Supabase automatically. While any Moonble page is open, reminders appear as an in-app card and a system notification (after the user allows notifications).

**Later (push deployment, after the app work is finished):**

1. Complete steps 2–5 above (VAPID keys, `VITE_WEB_PUSH_PUBLIC_KEY`, function secrets, `quiz-share-push` deployment). The function already handles reminder rows.
2. In **Database → Webhooks**, add a second webhook like step 5 for table `public.study_reminder_notifications` (event `INSERT`, Edge Function `quiz-share-push`, same secret header).
3. Run `database/025_study_reminder_cron.sql` to schedule the `pg_cron` job `moonble-study-reminders` every minute. If it reports that pg_cron was skipped, enable **pg_cron** in **Database → Extensions** and run it again.
4. Each device turns on push once from the timetable (**푸시 알림 켜기**).

Each schedule keeps the browser time zone it was saved with, and `last_reminded_at` prevents duplicate reminders for the same occurrence. In-app and push reminders share the tag `moonble-schedule-<id>`, so a device shows one notification per occurrence.
