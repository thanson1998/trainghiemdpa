# Daily booking email notifications

## Current behavior

The website's **Gửi mail thông báo** tab controls the shared schedule. Default: enabled, **06:00 every day, Asia/Ho_Chi_Minh**. Arrival-based reminders are removed entirely. A single email summarizes the day's reserved dine-in bookings, including customer, tables, time, guest count, set name, dishes and notes. Cancelled, paid, arrived/completed and takeaway orders are excluded. Empty days send a no-bookings summary.

Changing the time or enable switch requires **Lưu cài đặt**. Settings persist in D1 across devices and deployments. Version checks prevent overwriting changes from another device. Changing the time does not resend a summary already delivered that day. The mail settings API never accepts recipient, sender or API-key changes.

## Server configuration

The existing Cloudflare Worker is `trainghiemdpa`, with D1 `dpa-bookings`. Resend sends the emails. Configure these four values on Cloudflare, never in browser code, GitHub or chat:

| Name | Value |
| --- | --- |
| RESEND_API_KEY | Resend API key restricted to sending |
| BOOKING_EMAIL_TO | The confirmed destination inbox |
| BOOKING_EMAIL_FROM | Sender on a verified domain, or `DPA <onboarding@resend.dev>` for an account-owner-only trial |
| BOOKING_EMAIL_ENABLED | Bootstrap on/off state; shared saved settings take precedence |

For the initial trial, resend.dev can send only to the email that owns the Resend account. Use a verified domain for other recipients or normal branded sending. No Gmail password is needed.

https://resend.com/docs/api-reference/emails/send-email
https://resend.com/docs/knowledge-base/403-error-resend-dev-domain

## Deployment

Cloudflare Builds runs `npm run build` then `npm run deploy`. The deploy script applies pending D1 migrations, imports only the explicit mail allowlist from Build secrets to Worker runtime over stdin, and deploys with `--keep-vars`. It does not expose credentials in logs or import unrelated build credentials. The script also works when mail secrets are already configured at runtime.

Migration `0019_email_schedule.sql` initializes the requested 06:00 enabled schedule; repeating it preserves saved settings. Later updates through the website override bootstrap build/runtime variables, so subsequent deployments do not reset the schedule.

Retain the existing every-minute Cron Trigger. It runs the mail scheduler independently of dish-image processing. The scheduler sends at or after the configured time and can catch up after a brief outage. Durable job IDs, atomic claims and Resend idempotency keys prevent duplicate sends across retries and concurrent cron ticks. Unconfirmed delivery retries with backoff up to eight attempts while eligible; the request snapshot stays the same for provider idempotency.

## Verification

Run `node --test email-reminders.test.mjs`, the existing tests, the TypeScript check and a production build. Check `/api/email-reminders` for configured/enabled state, daily time, next send, a masked inbox and the latest provider-accepted timestamp. Verify actual delivery in Gmail/Resend; provider acceptance alone does not prove inbox delivery.

The status endpoint is read-only. POST to the same endpoint accepts only enabled, dailyTime and version, following the existing internal POS access model. Manual tests are limited to the configured recipient, at most one attempt per minute and five per Vietnam calendar day; clients never receive provider credentials. For the original test email Gmail marked it as spam; it was moved to Inbox using Report not spam.

To pause mail, switch off auto sending in the website tab and save. Leave the Cron Trigger in place for other services.

The “Gửi thử ngay” button posts an empty body to /api/email-reminders/test. It sends the current daily summary with [GỬI THỬ] in the subject, even when automatic sending is paused. Test delivery rows have independent keys and do not consume, reset or move the daily schedule. The automatic lastSentAt field deliberately excludes test emails. Provider acceptance is shown separately from actual inbox delivery.
