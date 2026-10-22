# Android source reconciliation

## Source boundary

This integration brings main `76eb7ac94d3c5caaa8127ed03744e5908e9ef845`
(PR33 wallet-contract source and PR36 account-session fixes) into the isolated
Android branch after `a0787efbbc46f33927fb20bf5610f9c0c53f3568`.
It does not merge Android into main or publish a release.

The Supabase source tree is copied unchanged from that main baseline. Its 101
recorded migrations describe the already reviewed contract; no SQL is applied,
no hosted state is reset, and no existing migration is rewritten. Mobile bundle
verification now pins 101 instead of the stale 100 while retaining exact source,
backend, practice mode, legacy-off and all 23 excluded-game checks.

## Account and reward boundaries

- Bring in main's safe redirects, callback error handling, confirmation resend,
  password confirmation, duplicate/cooldown checks and account-cache cleanup.
- Retain native signup/recovery blocking, including the new confirmation-resend
  mode. Real native email callbacks and successful isolated Auth remain a gate.
- Preserve main's reviewed web wheel UI/service byte-for-byte in separately named
  modules. Native player and admin wheel entry points render an explicit disabled
  notice instead of mounting redemption/publication controls. The normal native
  service also rejects spin and publish before delegation. Browser behavior keeps
  the existing server-authorized implementation.
- These are native product-scope restrictions, NOT new server authorization or a
  platform-wide kill switch. The existing server active-stage/session/role checks
  remain unchanged. Fresh server-side redemption-off verification is required
  before authenticated acceptance or distribution; no hosted state check is claimed.
- Native release metadata explicitly records wallet-credit redemption disabled.

## Tests and evidence

Locally, 52 reconciled handler/policy/isolation/transport tests passed, with no
skips. They execute the actual login and service-wrapper functions against mocks
and verify that native player/admin wrappers do not mount interactive wheels.
Existing main unit, browser and database suites are included unchanged, including
Auth and wheel-contract tests. Their historical main results are not a substitute
for testing this integrated candidate.

The actual APK smoke retains all nine original scenario groups and adds an
explicit confirmation-resend rejection assertion. The API36 transport repair uses
the installed APK's PID-owned WebView over bounded loopback CDP with phase reports,
an eight-minute watchdog, and the existing pre-launch IPv4/IPv6 fence. No native
assertion, lifecycle cycle or isolation proof is removed. New remote native results
are pending until the exact integration commit's reports are collected.

## Still open

This does not finish visual parity, native successful Auth/game/device acceptance,
dependency-security remediation, permanent identity or owner-controlled signing.
The app ID remains provisional. The original owner checklist is unchanged. No
keystore, credentials, hosted callbacks, database settings, customer data, live
domain, real funds or distribution state was changed. No GO decision is implied.
