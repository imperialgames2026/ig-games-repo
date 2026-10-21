# Original Imperial Games application — Base44 → Supabase migration status
Updated 2026-10-17, **integration branch only**.

## What is in source control

- **`original-app/`** is the full original casino React/Vite application, promoted from the 390-entry `ig-games.zip` into editable tracked code by GitHub Actions. Original pages and styling are preserved.
- The old Base44 SDK, Vite plugin, auth context, and SDK network client have been replaced with Supabase dependencies and a fail-closed compatibility boundary. Active frontend direct `@base44` SDK imports are prohibited by CI.
- **`ig-games.zip`** retains the original Base44 backend (61 entrypoints) for inventory, comparison and controlled porting. The 61 backend entrypoints are **not** all replaced, and none is active just because its source is archived.
- A dynamic React Router allowlist gates routes that have not been independently migrated. Authorization is also enforced by Supabase for each migrated backend action. An excluded player may contact Support but cannot use gameplay or staff queues.

## Migrated or newly integrated capabilities

| Capability | State | Security / evidence |
|---|---|---|
| Auth, profiles, canonical role verification | Staging adapter | Supabase session, owner-scoped profile/role, exclusion checks; fail closed |
| Own wallet and transaction history reads | Staging read-only | Server/user scoped; no client wallet mutations |
| One-time display name change | Staging adapter | Existing DB lock/trigger and canonical user |
| Weekly **practice CENT** leaderboard | Staging function v1 | Server role only aggregate, pseudonyms; no prizes or IGT minting |
| Support ticket creation / replies | Staging E2E **passed** | `ig-support-v1` v2, atomic idempotent SQL, private tables, Tester cannot enter staff queue |
| Support staff queue | Implemented on staging | Server verifies Admin/Superadmin; staff browser/login E2E still pending |
| Revealed practice randomness history | Staging `provably-fair-v2` v5 | Only authenticated account's *revealed* seeds; no unrevealed randomness exposed |
| Practice Dice game | Implemented in `original-app` | Server commit/reveal, browser HMAC verification, **no wager, reward or ledger mutation** |
| 12-chain crypto deposit catalog / account slots | Disabled staged foundation | 24 proposed asset entries, 72 pending assignments for 6 profiles, **0 usable addresses** |
| HOT Wallet / ELLIPAL reserves | Disabled staging configuration | Separate proposed operating and offline reserve accounts; no keys, no signing |
| $2,500 Superadmin review threshold | Staging-only policy simulator | Universal compliance screening and rolling limits; **`can_release_funds=false`** |
| Stripe / PayPal / Cash App | Deferred | No provider connection or payment acceptance |
| Generic legacy entity writes | **Revoked** | No `app_records` insert/update/delete grants or RLS write policies for authenticated clients |

## Verification gates

- CI separately builds untouched original ZIP, full first-class Supabase `original-app`, legacy archive + overlay, and initial scaffold; root Vitest and typecheck also run.
- The automated authenticated support E2E passed: a real staging Tester opened one ticket, replayed the same request, posted an idempotent message, read their conversation, and received 403 for staff queue/status actions. Only one test ticket/two messages exist after the run.
- Earlier authenticated staging tests verified role-separated practice poker operations and provably fair dice/coin/number commit/reveal/replay.
- The first-class original frontend **browser** E2E (Chromium) is separately gated and must pass before treating those screens as end-to-end usable.

## Release blockers — still substantial

The original 61 Base44 function entrypoints include game settlement, slots, blackjack, poker, crash, staking, daily/weekly quests, rewards, referrals, KYC, admin adjustments, withdrawals, crypto gifts, Wix payments, and more. Most remain disabled rather than receiving unverified client-authoritative replacements. A successful Vite build is not evidence that these transactions are implemented or safe.

Required before release: explicitly port every desired feature and reject/remove obsolete entrypoints; complete transactional ledger settlement, wallet concurrency/replay tests, fraud/abuse limits, age/jurisdiction gating, admin/superadmin authorization, KYC/compliance, independent HOT Wallet payment-processor/business API verification, separate ELLIPAL signing controls, user deposit address attribution, chain confirmations and asset verification, withdrawal signing/reconciliation, KYC provider integration, end-to-end responsive/browser tests, privacy/legal review and independent security assessment.

**The site is not release-ready. Do not merge draft PR #1 to `main`, do not replace the live Cloudflare site, and do not enable real crypto, Stripe, PayPal, or Cash App funding.**
