# Imperial Games Base44 → Supabase migration: player surfaces and global layout

Review branch: `feature/base44-migration-player-surfaces-20261018`
Target: `integration/app-scaffold-audit`
Scope: **staging-only, no financial activation**. These changes are not a claim of full application migration.

## Changes in this tranche

| Surface | Before | Now |
|---|---|---|
| Shared global layout | Old Base44 compatibility calls plus unported referral, wallet, chat, and KYC widgets mounted on every allowed screen | `VerifiedLayout` uses Supabase-authenticated identity, navigation, and owner-only **read-only staging wallet indicators**. No legacy global widgets mount on approved pages |
| `/Games` | Disabled original Base44 catalogue / unverified game promotions | `VerifiedPracticeCatalog`: authenticated, owner-eligible, read-only `ig_practice_game_catalog`, with an explicit allowlist for server-verified practice Dice only |
| `/Leaderboard` | Blocked old global `UserWallet.list`/unrestricted financial balance ranking | `VerifiedPracticeLeaderboard`: `legacy-leaderboard-v1`, pseudonyms and weekly legacy practice-only results; **no real/IGN prizes** |
| `/ProfileStats` | Blocked legacy `PokerHandRecord.list` and ambiguous IGD P&L/score charts | `VerifiedPlayerAnalytics`: new authenticated `ig-player-analytics-v1` Edge Function, owner-only completed-hand denominators and accurate N/A scoring |
| `/KYCVerification` | Blocked ID/selfie/phone upload flow | `VerifiedKYCStatus`: verified profile status only, no sensitive uploads |
| Home/Profile navigation | Migrated endpoints undiscoverable | Links to approved routes |

## Backend boundary

- New endpoint: `supabase/functions/ig-player-analytics-v1`, staging-deployed with JWT verification.
- No client-supplied user IDs, role metadata, settlement instructions, grades or player IDs are accepted.
- On each call, the backend validates `auth.getUser(token)`, `profiles.is_excluded=false` and the server-managed `user_roles` entry.
- Reads only `ig_poker_hand_facts` and `ig_poker_decision_grades` for the **authenticated user's UUID**.
- A maximum 1,000 most recent hands and 1,000 most recent grades can be sampled; response states when historical data is truncated.
- VPIP/PFR/3-bet/fold-to-3bet/c-bet/WTSD/W$SD etc. use proper verified numerators and denominators. Zero-denominator rates are `null` (shown N/A).
- A provisional 0–1000 score requires at least 100 hands and 50 post-hand decision grades sharing one grader version; otherwise it remains N/A. No in-hand solver or hidden opponent card access.
- **No wallet/ledger writes, crypto transfers, cash payouts, KYC document uploads or casino deposits.** Own-wallet indicators are not wallets to which player actions can be applied.

## Staging evidence (2026-10-18 local / 2026-10-19 UTC)

- Deployed `ig-player-analytics-v1` (JWT enabled).
- CI: both root build/tests and preserved `original-app` compilation succeeded on feature branch.
- `ig_poker_hand_facts` and `ig_poker_decision_grades` have RLS enabled and owner-scoped policies; no new critical advisor warning from this endpoint.
- At observation time: **0** archived poker hand facts and **0** graded decisions. Analytics necessarily shows N/A.
- Server-approved original-app catalog has **1** currently active practice game (Dice); other currently staged games are separate integrations, not silently enabled by this tranche.
- Authenticated browser end-to-end verification has **not** yet been performed against the new screens, and no production deployment has occurred.

## Outstanding work to honestly complete Base44 migration

The original archive contains **61** Base44 function entrypoints and **23** entity definitions. This tranche does **not** convert every one of them. The original source is preserved in `original-app/` and `ig-games.zip`, and legacy API calls not explicitly translated by the fail-closed `base44Client.js` compatibility module remain blocked.

1. Bring the separate, reviewed Crash/Trenball, Craps, multiplayer Blackjack, Roulette and Poker frontend branches into a common tested app; run multi-client, replay, crash/reconnect and comprehensive responsive browser E2E checks.
2. Make all genuine game settlement atomic, fully server-controlled and auditable. Do **not** reuse client-side legacy `UserWallet.update`, `Transaction.create`, unsupervised dice resolution, or placeholder RNG as financial settlement.
3. Migrate or explicitly deprecate remaining legacy slots, quests, progression/rewards, referrals, AI hand study/credit charging, membership, admin commands and reporting. Inventory every legacy operation and map it to a test or a documented deny.
4. Complete **verified** age/jurisdiction checks, provider-backed KYC/AML, gaming law review and audit. Never upload identity documents through an old Base44 form.
5. Complete independent wallet custody/crypto integration verification, token smart-contract review, screening, per-user deposit attribution, withdrawal controls, idempotency/concurrency/recovery testing and independent financial security review **before** enabling real funds.
6. Production preparation: remove/replace the final compatibility module after all callers are migrated, finish authenticated browser E2E and deployment QA, obtain release approval and only then consider merging into `main` and publishing.

### QA commands

From repo root: `npm install --no-audit --no-fund && npm run typecheck && npm run test && npm run build`

For preserved casino: `cd original-app && npm ci --no-audit --no-fund && npm run build`.

CI source: `.github/workflows/base44-player-screens.yml`. Tests: `tests/base44-player-surfaces-migration.test.js`.

**Release status: blocked for production.** Do not merge to `main`, deploy to the live Cloudflare site, activate payments, or equate a green frontend build with complete casino migration.

## Direct Supabase client cleanup (follow-up)

The following currently approved application components no longer import the Base44-named adapter at all: `App.jsx`, `pages/Home.jsx`, `pages/Profile.jsx`, `pages/TransactionHistory.jsx`, `components/casino/WeeklyTokenLeaderboard.jsx`, and `components/VerifiedLayout.jsx`.

- `Home` calls `readApprovedPracticeGames`; `Profile` and `TransactionHistory` call the owner-scoped Supabase read helpers.
- Weekly practice reporting invokes the verified `legacy-leaderboard-v1` Edge function directly.
- Profile one-time display-name claiming uses `setOneTimeDisplayName`, which performs a verified current-identity lookup, only updates the authenticated profile's `display_name` when null, and requires a database-confirmed returned value. Database policy/constraints remain authoritative.
- The legacy compatibility module remains present **solely** for unconverted, denied features and preserved archival UI. This direct-client cleanup does not imply the historic 61 Base44 backend functions are implemented.
