# Imperial Games — original application release readiness (2026-10-17)

**Status: STAGING / NOT RELEASE READY.** The user requested completing the *original* casino, not substituting the small React scaffold. The complete React/Vite original app is now version-controlled under `original-app/`. Immutable Base44 source remains in `ig-games.zip` as an archival migration reference. The live site and GitHub `main` are unchanged.

## Proven first-class original app features

| Feature | State | Actual evidence |
| --- | --- | --- |
| Supabase authentication, profile and canonical user role | Integrated | JWT-backed Auth provider; fail-closed missing/excluded/unknown role |
| Account and staging balances | Integrated read-only | `original-app/src/pages/Profile.jsx`, RLS-backed own wallet reads; no redeemable balance claims |
| Own staging transaction history | Integrated read-only | `original-app/src/pages/TransactionHistory.jsx`; owner-scoped, no gift or payout UI |
| Home and approved games | Integrated read-only | `Home.jsx`, `ig_practice_game_catalog`; only zero-wager practice Dice enabled |
| Practice Dice | Functioning in staging | `provably-fair-v2` commit/reveal with browser SHA-256/HMAC verification; no ledger mutations |
| Provably Fair history | Integrated read-only | Own, already-revealed practice rounds only |
| Player support tickets | Functioning in staging | `ig-support-v1` plus database service-only idempotent RPCs |
| Admin/Superadmin support queue | Server role checks implemented | Still needs authenticated *positive* staff E2E; Tester denial verified |
| Responsible Play self-exclusion | Staging API + original policy UI implemented | One-way, audited service-only RPC, cannot reinstate from client; no permanent mutation E2E against existing accounts |
| Weekly practice leaderboard | Integrated read-only | Authenticated, pseudonymous CENT-only Supabase aggregate |
| Twelve crypto networks and 24 asset candidates | Staged disabled | No address assignments issued, no deposit signing/monitoring/credits |
| HOT Wallet operating account, ELLIPAL cold reserve | Staged disabled | Both remain unverified/no keys/no connected transaction signing |
| $2,500 USD-equivalent Superadmin withdrawal threshold | Staging policy only | Every amount screening, rolling limits, independent signing; real funds cannot release |
| Stripe, PayPal and Cash App | Explicitly deferred | No provider integrations or payment credentials enabled |

**Frontend routes and unconverted controls are deliberately guarded.** Unfinished original slot/poker/blackjack/other game screens remain in source, but are not a production-ready casino. The original archive still contains historical functions and assets; preserving an archive is not the same as migrating the backend.

## Exact original Base44 backend inventory from CI

Deterministically extracted via `scripts/audit-base44-legacy.mjs` from the original `ig-games.zip`:

| Workstream | Legacy entrypoints | Current equivalence |
| --- | ---: | --- |
| Game and outcome | 25 | **Not ported as real-value games.** A separate zero-wager Dice/coin/number practice engine exists. |
| Financial and wallet | 10 | **Not ported** as real deposit/payout/treasury/ledger flows. |
| Identity, support and operations | 10 | `initializeUserIdentity` and `updateUsername` have limited Supabase mappings; Support tickets replace historical chat use but AI, email/phone verification, KYC notifications and session telemetry are not feature-equivalent. |
| Privileged administration | 4 | **Not ported** as full admin UI; dedicated role-protected staging functions exist for selected areas only. |
| Progression and rewards | 8 | **Not ported**; client reward claims and staking are disabled. |
| Read-only reporting | 4 | `getWeeklyTokenLeaderboard` has a limited pseudonymous practice-only counterpart; other reports are not migrated. |
| **Total** | **61** | **3 narrow named mappings**; new independent staging modules do not constitute feature parity. |

This audit distinguishes `Base44 eliminated from the active new client` from `all Base44 business functions ported`, which are NOT equivalent achievements.

## Evidence and current tests

- GitHub CI independently compiles: small integration scaffold, original frozen ZIP, old overlay preview, and first-class `original-app/`.
- Chromium browser E2E authenticates staging Tester and player, checks owner-only account and support views, denied admin/legacy poker routes, approved game catalog, and practice Dice with verified hash and no money movement.
- Authenticated support E2E verifies idempotent ticket create/reply, own conversations and Tester denial of staff permissions. Dedicated negative tester exclusion checks are also staged.
- Remaining tests must include positive authenticated Admin/Superadmin support workflows, real browser registration/password recovery, account suspension/appeals, cross-account denial tests, retries/concurrency and real mobile QA.

## Nonnegotiable release blockers

1. **Wallet/ledger:** Every external crypto deposit and withdrawal must use network-specific verified receiving addresses, chain monitors, finality/reorg handling, sanctions/AML screening, immutable double-entry journal and atomic replay-proof crediting. The HOT Wallet consumer app is a *candidate*; business signing APIs, custody, chain coverage and approval hooks have not been verified. ELLIPAL must stay air-gapped.
2. **Approval engine:** Enforce the $2,500 USD-equivalent threshold from an authoritative time-of-request price oracle; aggregate 24-hour/7-day committed + submitted payouts inside a serialized transaction; require automatic/manual compliance screening at ALL amounts and independent custody authorization bound to transaction bytes. Client inputs cannot set policy totals, prices or release flags.
3. **Gameplay:** Rebuild 25 legacy outcomes, many player actions, rewards, poker, slots, blackjack, and multiplayer states as server-authoritative, properly licensed game functions with provable fairness and race/replay/negative-balance tests. Current practice proof does not certify real wagering.
4. **Identity/compliance:** Finish age and geographic eligibility, KYC verification and record-handling, AML policy, self-exclusion reinstatement process, data privacy and provider sanctions checks under qualified legal review.
5. **Site and deploy:** Feature-complete all originally intended screens, migrate external Base44 media/analytics/integrations, complete staging visual/mobile QA, finalize secrets and audit trail, pass independent security review, then review draft PR, merge `main`, and create a separately approved Cloudflare/Android release.

**No production deployment/merge or crypto activation is authorized by passing staging builds.** Keep approval/crypto circuit breakers locked until these gates are independently verified.
