# Consolidated integration — 2026-10-19

This report supersedes older branch-status notes for **source integration**, not production launch readiness.

## Application source

`imperialgames2026/ig-games-repo` is the complete original React application baseline. All 14 existing branch tips were inspected for ancestry. Eleven were already represented by main (including main itself); the three outstanding branches were integrated: IGN tokenomics, Fireblocks sandbox, and poker player profiles. Preserved historical frontend files remain available.

`imperialgames2026/casino-zip` contains the original ZIP, the editable `original-app/`, and a separate small TypeScript scaffold. All ten existing branch tips were consolidated, preserving the combined player/admin migration, poker routes/client/AI lab, Crash v2 and craps practice-rule work. CI conflicts were resolved by retaining both sets of checks. The Node craps tests now run separately from Vitest; the scaffold has a committed lockfile and pinned Supabase client.

The main original app additionally receives the newer server-timed Crash/Trenball screens, Superadmin poker lab, minimal-data Superadmin user directory, verified KYC status, owner-only analytics and practice leaderboard from casino-zip. Corresponding missing function sources and existing migration files are preserved. Canonical `user_roles` now governs identity in both route access and compatibility identity reads. Failed profile/role checks deny access, anonymous accounts are rejected, exclusion is enforced at protected routes, and auth callbacks defer API reads to avoid auth-lock hangs.

## Supabase environments

- Staging: `qonqemhljgxlwpghkxhn`, active, 26 deployed functions at inspection.
- Older production project: `icwzqdbibhnrtjahfzsx`, active, only `api` and `admin-mutations` deployed at inspection.
- Source integration must **not** repoint the staging-only handlers at production or silently enable funds. Production is not equivalent to staging.
- This integration does not change production databases, live balances, provider credentials, custody or hosting settings.

## Verification performed

- Main original app: production Vite build and 70 offline Node tests pass.
- casino-zip: TypeScript checks, scaffold build, editable original-app build, 114 Vitest tests and four Node craps tests pass.
- Staging rollback-only four-player poker lifecycle: PASS, 4,000 practice chips conserved; no test data retained.
- Staging rollback-only 100-position tournament prize-plan validation: PASS; changes rolled back, payouts remain disabled.
- Role regression tests exercise stale privileged profile roles, missing/unknown canonical roles, query failures, mismatched ownership, anonymous users and exclusions.
- Credential-dependent admin/transfer tests were not run locally: the necessary test credentials are not present. Browser multi-account/end-to-end, responsive visual and production deployment checks remain outstanding.

## Remaining migration work (not completed by a merge)

1. **Legacy business parity:** 61 original backend function entrypoints remain the source inventory. The route audit still reports 35 blocked game routes and 10 practice-backed routes. Other legacy rewards, referrals, slots, admin mutations, AI analysis billing and membership billing need explicit implementation or retirement decisions. A compatibility filename is not itself a Base44 SDK dependency, but blocked calls are not working features.
2. **Database reproducibility:** Seven duplicate `20261018` migration filenames were renamed to their recorded staging versions, preserving their SQL and ordering the hand-credit table before the completed-hand foreign key. Other live staging migration history still differs from repository filenames. Reconcile an audited schema baseline and clean-install test before using `supabase db push` for a fresh or production project. Do not replay everything blindly.
3. **Financial/provider dependencies:** custodial deposits, confirmation/reorg reconciliation, signed payout workflow, provider KYC, subscriptions, reward funding and real-value game settlement are not fully integrated. Staging gates remain in force.
4. **Token definitions:** the older 1-billion IGN simulation proposal and the documented 10-billion Solana Devnet budget are different models. This merge preserves both as labeled proposals; it does not create supply, map simulated balances to Devnet tokens or resolve economic policy by guesswork.
5. **Release:** complete authenticated multi-account browser testing, production backend rollout/reconciliation, real host environment configuration and Android signing/build work. No live-site or Android release is claimed here.

Supabase advisor inspection still reports four authenticated-executable SECURITY DEFINER routines and disabled leaked-password protection. Numerous no-policy RLS tables are deliberately server-only; blanket policy creation would undermine that isolation. Review intended routine access individually.

## Backend recovery and deployed fixes — 2026-10-19 follow-up

- Restored all 83 previously applied staging migrations plus the new fix (84 total) under `supabase/deployed-migrations/`, with checksums in `supabase/backend-manifest.json`. All 26 deployed function sources are now in the main repository.
- `scripts/prepare-reviewed-backend.mjs` assembles the exact versioned staging history and explicitly listed functions, preserving JWT settings. The deployment workflow targets staging only and no longer converts/exports unreviewed Base44 handlers. Old migration files remain historical references; use the reviewed packaging workflow, not a blind push from the root folder.
- Applied staging migration `20261019195106_canonical_signup_and_ign_replay_guards`: new signups get a canonical player role independent of editable metadata; existing roles are preserved. IGN simulation now rejects tester/anonymous/excluded accounts for mutations, binds idempotency keys to the complete request and returns the original response on retry.
- Deployed `ign-staking-v1` v3 with JWT verification, canonical-role/exclusion checks, explicit owner queries, input validation and a pinned SDK. Four handler tests pass. A rollback-only database regression passed for signup initialization, attempted metadata escalation, exact replay, changed-payload rejection, tester denial and exclusion denial. No synthetic accounts or balances were retained.
- Packaging verification passes with 84 migrations and 26 functions. A fresh local Postgres replay and authenticated HTTP/browser E2E are not yet verified. Backend restoration does not implement the remaining legacy business features or copy production customer data.
