# Migration completion checkpoint — 2026-10-20

The approved practice release remains the target. Customer data is not imported.
The 23 games on the non-migration list remain on hold. No real-value settlement,
provider custody execution or unverified reward issuance is enabled.

## Recovered environment failure

The shared `Set up ig-games-repo` conversation reports
`failed to query executor configuration capabilities` before repository commands
could run. This is an executor startup/capability-query failure. The message does
not establish its underlying platform cause. It is distinct from earlier website
HTTP 403 checks and Supabase deployment-token HTTP 401 failures.

Source: https://chatgpt.com/s/cx_6ad7f5c1135c81918463046faab2bc0e

PR15 is merged and its head is an ancestor of the current main branch. Its saved
account/recovery/support/payment-preparation work has not been lost. This working
workspace can read/edit files, run commands and use the connected Supabase service;
recovery of the old executor is not required to continue from GitHub main.
The old environment's draft/settings are not accessible from this workspace.

## Announcement replacement

`AdminAnnouncements` no longer writes generic legacy records. Dedicated Supabase
content uses canonical admin/superadmin checks and account exclusion in RLS.
New drafts start inactive; publishing exposes only active, unexpired content.
Author IDs are not selectable by normal API roles. Actors, revisions and creation
metadata cannot be supplied as arbitrary client writes. Updates use revisions to
reject stale edits; uncertain saves retain the original UUID/revision for retry.
Archive deactivates content without deleting history.

The existing banner is now rendered in the public/player layout. Its reads use
explicit publication/expiry filters even for administrators, whose RLS rights
also permit viewing drafts in the admin module. Unsafe link schemes, oversized
content and malformed priorities are rejected. React renders content as text.
No legacy/customer announcement content is copied.

Recorded staging migrations:

- `20261020231614_dedicated_announcement_content.sql`
- `20261020231753_announcement_public_field_grants.sql`

The reviewed package contains 96 migrations and 30 Edge Functions. The new table
has SELECT/INSERT/UPDATE policies; no new exposed SECURITY DEFINER is introduced.
Hosted rollback tests cover public draft/expiry/author privacy, actor spoofing,
admin saves/revisions, script links and player/tester/excluded/demoted denial.
The isolated runner now has 17 SQL suites, plus the new real Auth/REST/browser
announcement publish/edit/archive flow. Offline coverage has 122 tests.

## Remaining completion gates

- Replace remaining nongame business compatibility paths (including legacy VIP,
  rewards/referrals and IGT staking) according to their reviewed product rules.
  They are not authorized to credit monetary wallets from practice outcomes.
- Financial provider execution/custody/reconciliation remains incomplete. Payment
  preparation is implemented and does not move funds.
- Reconcile and verify the final hosting/Auth/production target and credentials.
  This workspace has no launch-check, Vercel, Cloudflare or Supabase CLI access
  token configured; connected Supabase operations remain available. Do not assume
  a separate broken environment's saved secrets exist here.
- The full migration is not declared complete by this checkpoint or a passing
  frontend build. See `SUPABASE_MIGRATION_STATUS.md` for the current release scope.
