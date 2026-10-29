# Booking reminder emails

Status: implementation tested; delivery stays OFF until configured and deployed to the existing Cloudflare Worker. Publishing to GitHub Pages alone does not deploy the Worker.

## Connections

1. Access the existing Cloudflare account that owns Worker `trainghiemdpa` and D1 `dpa-bookings`.
2. Create/sign in to Resend. Use an API key restricted to **Sending access**. Never commit or paste a key into frontend code, GitHub, or chat.
3. Confirm the destination inbox. For an initial trial, `DPA <onboarding@resend.dev>` can send only to the email that owns the Resend account. A verified sending domain is needed for other recipients / normal production sending.

Provider documentation: https://resend.com/docs/api-reference/emails/send-email and https://resend.com/docs/knowledge-base/403-error-resend-dev-domain

## Configure in Cloudflare dashboard

Workers & Pages → `trainghiemdpa` → Settings → Variables and Secrets. Set these server-side values:

| Name | Type | Value |
| --- | --- | --- |
| RESEND_API_KEY | Secret | Resend sending API key |
| BOOKING_EMAIL_TO | Secret | Confirmed recipient email |
| BOOKING_EMAIL_FROM | Variable | `DPA <onboarding@resend.dev>` for the account-owner-only trial; otherwise an address on the verified sending domain |
| BOOKING_EMAIL_DAILY_TIME | Variable | `08:00` |
| BOOKING_EMAIL_BEFORE_MINUTES | Variable | `120`; use `0` for daily-only notifications |
| BOOKING_EMAIL_ENABLED | Variable | Keep `false` until ready; change to `true` to activate |

Do not put a Gmail password in any of these fields. The website sends through Resend, not through the user's personal Gmail account.

## Deploy and verify

- Run `node --test email-reminders.test.mjs` and the TypeScript check.
- Authenticate Wrangler to the correct Cloudflare account. Apply `0018_email_reminders.sql` or the normal pending migrations, then deploy the Worker. The job journal also initializes automatically on the first enabled scheduled run.
- Retain the existing `* * * * *` Cron Trigger. Both dish-image processing and email reminders run independently from that trigger.
- Read `/api/email-reminders`: it reports configured/enabled state, a masked inbox and the latest provider-accepted send time. No public endpoint sends emails or changes the recipient.
- Activate only after confirming the inbox, provider identity and schedule with the owner.
- Verify the first actual email in the recipient inbox and in Resend delivery logs. A provider-accepted request does not prove inbox delivery. No real email has been sent as part of local tests.

## Behavior

Times are Asia/Ho_Chi_Minh (UTC+7). One daily summary is sent after the configured time, only when there are upcoming reserved dine-in bookings that day. The before-arrival reminder becomes eligible within the configured lead time, including bookings entered late and arrivals shortly after midnight. Cancelled, arrived, completed, takeaway and paid bookings are excluded. Empty days do not send mail.

Emails include the saved set name and dishes. They reflect a snapshot; staff should check the current booking before preparing. Durable job keys, atomic claims and Resend idempotency keys prevent duplicate sends across retries and concurrent cron ticks. Pending delivery snapshots retain the same request body for provider idempotency. Changed arrival times have a new reminder key; changes after an email was sent do not retract it. At most two unsent jobs are attempted per tick; errors retry with backoff up to eight attempts while the booking is still eligible. Operational logs contain job IDs and fixed error codes, never the API key or full email body.

To disable: set `BOOKING_EMAIL_ENABLED=false` on the Worker. Keep the Cron Trigger for the existing dish-image service.
