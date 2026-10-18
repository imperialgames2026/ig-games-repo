# Imperial Games customer support supervisor — staging runbook

## What is deployed

- Player route: `/Support`, with authenticated ticket submission, conversation, and replies through `ig-support-v1`.
- Staff route: `/AdminSupport` (Admin/Superadmin only), with ticket search, conversation, replies and case status controls.
- Supabase Edge Function: `ig-support-supervisor`, with an authenticated `dashboard` and manually triggered `scan`; `decision` is **Superadmin-only**.
- Postgres: restricted queue, AI/rules reviews, alert outbox, and append-only Superadmin review records. Staging `pg_cron` job `imperial-support-rules-watch` runs each minute to flag critical player messages without sending personal information off platform.

### Safety limits

No support AI operation can send a message to a customer, approve withdrawals, change KYC, release a wallet hold, settle a game, or approve a payment. The `review_complete` button only records completion of reviewing **the support escalation**. Actual financial or compliance actions must be performed through separately authorized processes.

The rule-based automatic review is enabled for staging. **External AI enrichment and all email/SMS notifications are OFF by default.** Even if those providers are configured, SMS/email are only sent if the verified-recipient controls and `SUPPORT_ALERTS_ENABLED=true` are set. Alerts contain an ID and secure dashboard link, *not the player's message*.

## Configure external AI (explicit opt-in)

In Supabase Dashboard > Project `qonqemhljgxlwpghkxhn` > Edge Functions > Secrets, configure:

- `SUPPORT_AI_ENABLED=true`
- `SUPPORT_OPENAI_API_KEY`: dedicated least-privilege API key in Supabase Secrets (never GitHub/client environment)
- `SUPPORT_AI_MODEL`: specific supported model approved for use with ticket redaction

The worker sends *sanitized portions* of the subject and latest player message to the configured model using `store:false`. This sanitization is best-effort: do not submit raw IDs, passwords, recovery phrases, medical detail, or financial secrets in tickets. Ensure your published privacy notice and vendor data-processing settings reflect the use of external AI.

The worker refuses unsupported structured results and **always retains a rule-based escalation**, even if a model says that no Superadmin is needed. Generated customer replies are drafts for humans to review.

## Configure verified email and SMS notifications

Set up a verified domain/sender with Resend and a properly registered messaging service/number with Twilio, following their compliance and carrier requirements. In Supabase Edge Function Secrets:

| Setting | Purpose |
|---|---|
| `SUPPORT_ALERTS_ENABLED` | Set to `true` **only after** all validation and test approval; default is disabled |
| `SUPPORT_RESEND_API_KEY` | Email provider server-side credential |
| `SUPPORT_EMAIL_FROM` | Verified sender identity on your Imperial Games domain |
| `SUPPORT_SUPERADMIN_EMAIL` | Email address verified to be controlled by the Superadmin |
| `SUPPORT_SUPERADMIN_EMAIL_VERIFIED` | `true` only after owner verifies delivery out of band |
| `SUPPORT_TWILIO_ACCOUNT_SID` | Twilio account |
| `SUPPORT_TWILIO_AUTH_TOKEN` | Twilio private credential |
| `SUPPORT_TWILIO_FROM` | Registered sender in E.164 format |
| `SUPPORT_SUPERADMIN_PHONE_E164` | Superadmin SMS number in E.164 format |
| `SUPPORT_SUPERADMIN_PHONE_VERIFIED` | `true` only after owner verifies and opts in to receiving SMS |

Do **not** paste API keys or private tokens into chat or frontend variables. Consent/opt-in and correct sender registration are needed for SMS; check local messaging requirements.

The alerting implementation creates one notification record per ticket message and channel and does not blindly retry attempted notifications, avoiding duplicate messages after network timeouts. Check failed/sending states in the admin panel and server logs rather than automatically resending.

### Important: automatic delivery worker scheduling is not activated

To run external AI/enrichment and pending notification sends unattended, configure a securely authenticated scheduled call (Supabase cron using `pg_net` and Vault, or a locked-down Cloudflare scheduled worker) to:

`POST https://qonqemhljgxlwpghkxhn.supabase.co/functions/v1/ig-support-supervisor`

Body: `{"action":"scan"}`

For the internal account, both the legacy service-role JWT authorization header and an independently generated strong `x-supervisor-token` header are required, matching `SUPPORT_SUPERVISOR_CRON_TOKEN` in Secrets. **Do not use a public cron URL, query-string secrets, an anonymous API key, or a browser-based timer.** Supabase's function JWT validation must remain enabled. Do not enable scheduled external scanning before the owner verifies destinations and provider agreements.

Manual `Run supervisor review` in the Admin Support page remains available and only requires a signed-in authorized operator. Rule-based cases are automatically queued and flagged every minute regardless.

## Validation

1. Sign in as a player and create a ticket from `/Support`; reply to it.
2. Sign in as Admin or Superadmin; open `/AdminSupport`, filter the queue, open the ticket, and reply. Verify the player sees the staff reply.
3. Create a test ticket mentioning a payment dispute. The automatic rule watch should flag it for a Superadmin within about a minute, without emailing or texting anyone.
4. Sign in as Admin (not Superadmin): case replies are allowed, but the Superadmin decision action is forbidden by the Edge Function even if called directly.
5. Sign in as Superadmin: record a support-escalation acknowledgement with a note, and verify that the audit record is shown. This does not change any wallet or financial state.
6. Only after the provider secrets are set and both destinations are verified, explicitly enable outbound notifications and secure background invocation; test with a harmless staged escalation and verify the expected destination. Leave real funds disabled.

## Monitoring / rollback

Review `ig_support_supervisor_queue`, `ig_support_supervisor_reviews`, `ig_support_supervisor_alerts`, and `ig_support_supervisor_decisions` from Supabase admin tools. The rules-watch schedule is named `imperial-support-rules-watch`. To stop automatic rule triage, use `select cron.unschedule('imperial-support-rules-watch');` after appropriate change approval. To disable external delivery immediately, set `SUPPORT_ALERTS_ENABLED=false` in Supabase secrets. Nothing in this workflow controls actual payment approvals.
