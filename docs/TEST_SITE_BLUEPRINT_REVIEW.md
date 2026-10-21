# Imperial Games test-site blueprint review

Review date: 2026-10-20. Scope: the documents in `ig-games-repo/docs/` and
`casino-zip/docs/`, their application READMEs, and the current poker lab/profile
screen contracts. This is a product/design audit, not a claim that a new hosted
deployment, bot account or authenticated playtest has passed.

## Product baseline

Publishable test-site scope is the full original **Imperial Games** React/Vite
application with Supabase authentication and **nonredeemable practice chips**.
`ig-games-repo` is the application baseline; the ZIP, `casino-zip/original-app`,
its overlay, and its smaller TypeScript scaffold are source/reference material.
Consolidation must preserve useful migrated behavior without installing a second
disconnected `src/` app or replacing newer Supabase-aware files with Base44 files.

The latest consolidated [migration status](SUPABASE_MIGRATION_STATUS.md) records
96 staging migrations, 30 reviewed functions, 17 transactional SQL suites and
21 verified practice routes / 20 catalog entries. These are documentary baseline
counts, not fresh test results. Older 10-game, 15-game, 84-migration and
35-blocked-route reports describe historical snapshots.

Human playtesters need eligible **player** accounts. The canonical `tester` role
is deliberately read-only and must remain unable to join, bet or mutate games.
Use that role for permission-denial tests; do not weaken it to make playtesting
work. Dedicated poker bot identities are separately provisioned by the authorized
Superadmin and clearly labeled `[AI BOT]`.

## Preserved design intentions

| Area | Concrete requirement | Current documented boundary |
| --- | --- | --- |
| Brand | Preserve original Imperial Games casino screens/assets and original IGN feline/crown artwork. IGN token artwork has seven gold crown points. | No replacement with a generic scaffold or competitor artwork. |
| Palette | Charcoal `#0B0E16`, antique gold `#D9B35B`, pink `#F54EAC`, ivory `#EFF2F8` are the Treasury design proposal. Retain readable numbers, contrast, focus indicators and labels in addition to color. | Apply consistently with existing app styling; do not treat proposed palette as proof that every current screen already matches. |
| Navigation | A cohesive lobby, game discovery, global wallet/currency navigation, account/profile, transaction/fairness history, support and protected operator tools. Mobile navigation remains usable. | Display only approved practice routes as playable; explain held/unavailable routes. |
| Currency | Explicit separation of practice chips, IGD, legacy IGT, IGN Devnet, any future Mainnet asset, and source GC/SC concepts. | No inferred exchange rates, redeemability, wallet credits, market price or cross-ledger conversion. |
| Game experience | Authoritative shared table state, visible turn/betting clocks, legal-action controls, clear results and recoverable sessions. | Client animations, gestures and sounds never choose cards, dice, spins or settlement. |
| Fairness | Persisted commitments, hidden active seeds/cards, independent ended-round proof verification and useful fairness history. | Do not label missing/mismatched proofs as verified after reload. |
| Poker | Hold'em and Omaha, private hole cards, legal betting, dealer rotation, reconnect, server deadlines and free/equal practice timebank. | Per-game rules and current engine limits take precedence over aspirational blueprints. |
| Analytics | Owner-only hand history/HUD metrics; accurate opportunities and N/A for insufficient data. Any study assistance is post-hand. | Archive/event ingestion and calibrated scoring are documented as unfinished; no fabricated scores or live-hand assistance. |
| Token/Treasury | Devnet/test label, read-only balances and nominal allocation budget distinctly identified. | Minted, allocated, circulating, locked and reconciled balances are different facts. No invented balances or fiat valuations. |
| Future interaction | Dealer audio, chip/card sounds, animations, NFT avatars/items and social cosmetics remain design references. | Optional later enhancements; they do not block a reliable practice test site. |

## Acceptance required before poker bot and human play sessions

| Priority | Acceptance requirement | Evidence to obtain in the current release |
| --- | --- | --- |
| P0 | One canonical runnable app and a locked production build; SPA deep links load the same app. | Clean install/build and direct-route preview checks; no archive/scaffold deployed in place of the main app. |
| P0 | Public lobby accurately advertises nonredeemable practice play and links the approved catalog. | Desktop/mobile browser checks, including reload/back navigation and empty/unavailable catalog states. |
| P0 | Real signup/login/logout/session recovery works on the intended test hostname. Canonical role and exclusion failures deny access. | Independent browser sessions and configured callback/recovery URLs; no invented role grants or client-provided authority. |
| P0 | A player can enter a practice poker room and receive only the defined initial practice stack. Reconnect/join retries do not mint another stack. | Two distinct player sessions; refresh, disconnect/reconnect and repeated-request checks. |
| P0 | Players see only their own private cards; spectators and other accounts cannot retrieve private state. | Independent participant/observer sessions plus direct API denial checks. |
| P0 | Check/call/fold/raise/all-in controls match the authoritative turn. Stale actions cannot change the hand. | Complete hands including turn changes, duplicate requests, a reconnect and an expired turn. |
| P0 | The 10-second poker deadline and free one-use +30-second practice extension agree with the server; expiry checks when legal and otherwise folds. | Browser countdown plus unattended expiry; verify the service/watchdog actually advances a stalled table. Paid IGD/IGN extension remains off. |
| P0 | Explicit Superadmin-only bot provisioning/run controls, visible bot roster and table status. Four bots are distinct identities with blocked human login. | Confirm actual provisioning response before claiming accounts exist; ensure missing/failed setup has a useful message and retry. |
| P0 | Every bot decision uses the same validated practice engine, without opponents' hidden cards or financial wallet APIs. Mixed human/bot turns never auto-play a human's turn. | A complete four-bot hand with 4,000 initial chips conserved; a human-observer/mixed-table interruption case where supported. |
| P0 | Chip totals remain conserved through folds, showdowns, ties, side pots, retries and reconnects. | Current transactional regressions and at least one authenticated full-hand session; record failures before broader testing. |
| P0 | Financial/provider controls remain disabled. No deposit address, payout, paid membership, paid timebank or token transfer is offered as working. | UI route review and unchanged monetary ledger assertion during practice sessions. |
| P1 | Account, profile/avatar, owner transaction/fairness history, support and self-exclusion workflows are understandable and recover from errors. | Meaningful positive/negative browser coverage; keep self-exclusion confirmation explicit because it changes eligibility. |
| P1 | The app fits desktop and mobile with readable table seats/cards, reachable actions, keyboard focus and visible loading/error/empty states. | Real viewport checks of lobby, auth, poker, wallet, account and operator lab. |
| P1 | Host, frontend public settings, allowed Auth redirects, staging backend target, runtime startup and rollback instructions are concrete. | A tested preview URL and release record that distinguishes local, staged and hosted verification. Publishing remains a separate user action. |

## Current gaps and implementation order

1. **Prove the current runnable site.** Prior build/browser reports describe
   specific historical commits. Establish the canonical app's current locked
   build, preview process, route fallback, target project and test results.
   Inherited JavaScript typing issues are documented; report their actual state
   rather than suppressing checks or calling a green bundle full completion.
2. **Make practice scope visible.** Preserve the full lobby and game identity,
   but keep the [approved game scope](GAME_MIGRATION_SCOPE.md): the 23 explicitly
   held routes are not implicit implementation work. Approved Darts, Dice Zone,
   HiLo, Rocket and Towers have bounded practice rules described in
   [the final-games report](FINAL_APPROVED_GAMES_20261020.md).
3. **Complete the poker session preflight.** Bot UI/function source exists;
   actual bot provisioning, a bot-owned table and authenticated browser play
   must be observed afresh. Old bot-lab notes explicitly say deployment alone
   creates no bot accounts. Separate Superadmin operator, player playtest and
   read-only tester responsibilities.
4. **Make failures recoverable.** Preserve original idempotency keys after an
   uncertain request, distinguish a successful save from a failed follow-up
   refresh, and resume the server state after reload. A missing backend or
   wrong role should provide a clear actionable state rather than a dead button.
5. **Verify table operation and rules.** Side pots, short all-ins, odd chips,
   heads-up blinds, timeouts, dealer rotation, concurrency and repeated hands
   are explicit poker blueprint gates. Four rule-based bots do not establish
   load capacity or independently certified poker correctness.
6. **Keep configuration distinct from implemented play.** NLHE presets support
   6–8 seats and a desk can display three independent rooms. Thirty-table MTT
   scheduling/balancing, bomb pots, automatic prizes, rake and cash-style
   buy-in/top-up/cash-out are not proven by saved configuration. Do not turn them
   on merely to make the site appear complete.
7. **Retain honest analytics and optional features.** Profile metrics need a
   trusted server hand archive and replay-safe ingestion. Different historical
   documents specify different score sample thresholds; retain the current
   implementation's N/A behavior until the grading contract is reconciled.
   Membership credits, boosters, staking and referral/reward schemes remain
   proposals or disabled legacy work, not test-site requirements.
8. **Preserve references without reintroducing legacy behavior.** The original
   archive, migrated source and design docs should have a source map in the
   consolidated repository. Do not copy old Base44 auth, generic mutations,
   original client wallet writes, outdated domains or downloaded APK/AAB files
   into the active application.

## Conflicts resolved for this test-site scope

- **Customer migration:** current owner-approved scope is a fresh Supabase start.
  Old export/import requests are historical and are not a test-site blocker.
- **Backend inventory:** use `supabase/backend-manifest.json`, reviewed packaging
  and latest consolidated migration status, not an older document's count.
- **Games:** latest approved scope and verified catalog supersede older route
  counts. Held slots/external games remain held.
- **Poker seats/timing:** early six-seat/no-watchdog design notes are historical.
  Current code and later documented 6–8-seat NLHE capability and server timeout
  implementation require current runtime verification; they do not imply a
  30-table tournament is operational.
- **Poker fees:** an old blueprint says 5% rake; later documents propose a 1%
  ante fee plus 2% pot fee and configurable nominal presets. No documented
  settlement path actually deducts those fees. Keep practice play fee-free until
  a single explicit engine policy is implemented and tested.
- **Token economics:** one-billion IGN simulation proposals and the distinct
  ten-billion Devnet mint/budget are separate models. Hourly reward cycles and
  two-hour Anchor epochs are likewise separate references. They must not be
  silently merged or represented as live economics.
- **Wallet linking:** present public-address/Phantom viewing is read-only; a
  public key does not prove signed account ownership. The stronger signature
  challenge in the blueprint is a future feature, not a current prerequisite
  for practice poker.
- **Treasury roles:** design matrices propose possible read-only tester access,
  but current Treasury QA restricts the dashboard to Superadmin. Preserve the
  deployed canonical access boundary rather than broadening it by inference.

## Reviewed source library

The NotebookLM links in the blueprint indexes are external references whose
contents have not been imported or verified. This review uses repository text;
it does not invent requirements from inaccessible notebooks or claim to have
reviewed original screenshots/documents absent from the checkout.

| Source group | Documents reviewed | Relevance |
| --- | --- | --- |
| Main product/design | `BLUEPRINT.md`, `application-blueprint/README.md`, `ECONOMICS_AND_CUSTODY_ARCHITECTURE.md`, `AI_CRYPTO_OPERATIONS_GOVERNANCE.md` | Cohesive app, role boundaries, authoritative gameplay, distinct assets, future custody architecture. |
| Main poker | `POKER_DUAL_FEE_POLICY.md`, `POKER_PLAYER_ANALYTICS_SKILL_SCORE.md`, `POKER_TOURNAMENT_PRESETS_STAGING.md`, `DEPLOY_MAIN_AND_TOURNAMENT_PRIZES.md` | Practice poker, analytics, tournament/prize configuration and hosting requirements. |
| Main games | `EIGHT_MULTIPLAYER_GAME_IMPLEMENTATION.md`, `MULTIPLAYER_CRAPS_ROULETTE_STAGING.md`, `MINES_BACKEND_20261020.md`, `FINAL_APPROVED_GAMES_20261020.md`, `GAME_MIGRATION_SCOPE.md`, `CATALOG_RECORD_ISOLATION_20261020.md` | Current route boundaries, shared-state games and practice/fairness behavior. |
| Main account/security | `ACCOUNT_BACKEND_INTEGRATION_20261020.md`, `BACKEND_FOLLOWUP_20261019.md`, `BACKEND_ONLY_RLS_REVIEW_20261020.md`, `IGN_FUNCTION_SECURITY_20261020.md`, `support-supervisor-runbook.md` | Account flows, authorization, private tables, support and operator limits. |
| Main proposals/release | `IGN_7_PERCENT_EDGE_AND_REWARDS.md`, `IGN_TOKENOMICS_STAGING.md`, `IMPERIAL_3BET_MEMBERSHIP.md`, `INDEPENDENT_ANDROID_RELEASE.md`, `PRACTICE_RELEASE_VALIDATION.md` | Simulation/research and optional later release work; not activation authority. |
| Main provenance/history | `SUPABASE_MIGRATION_STATUS.md`, `INTEGRATION_STATUS_20261019.md`, `INTEGRATION_REFRESH_20261020.md`, `POST_MERGE_VERIFICATION_20261019.md`, `MIGRATION_STATUS.md`, `PHASE1_BACKEND_CALL_MIGRATION.md`, `FRONTEND_SUPABASE_INTEGRATION_CHECKPOINT.md`, `BASE44_EXPORT_INPUTS.md`, `UPLOADED_BASE44_ARCHIVE_AUDIT.md`, `casino-zip-feature-audit.md`, `casino-zip-integration.md` | Distinguish current decisions from historical blockers and retain source provenance. |
| Casino design | `casino-zip/docs/IMPERIAL_GAMES_BLUEPRINT.md`, `blueprints/solana-casino-platform.md`, `blueprints/IGN_TOKENOMICS_BENCHMARKS_PROPOSAL.md`, `blueprints/IGN_TREASURY_AND_DASHBOARD_DESIGN.md`, `blueprints/IGN_WALLET_TREASURY_STAGING_QA.md` | Original design identity, seven-point crown, palette, asset distinctions and read-only Treasury acceptance. |
| Casino custody/KYC | `blueprints/HOT_WALLET_ELLIPAL_CUSTODY.md`, `blueprints/MULTICHAIN_CRYPTO_DEPOSITS.md`, `blueprints/IGN_SUMSUB_KYC_DECISION.md` | Future provider boundaries; no live financial/identity-provider activation for the test site. |
| Casino game design | `game-engines/POKER_AI_BOT_LAB.md`, `game-engines/POKER_STAGING_TEST.md`, `game-engines/poker-blackjack-roulette.md`, `game-engines/poker-tournaments-and-ring.md`, `provably-fair.md` | Bot personalities/provisioning, engine invariants, timing, tournament goals and historical demo proof limitations. |
| Casino audits | `audits/application-inventory.md`, `audits/ORIGINAL_APP_RELEASE_READINESS_20261017.md`, `audits/INTEGRATION_STATUS_20261019.md`, `audits/base44-admin-users-preview-20261019.md`, `audits/base44-player-surfaces-20261019.md`, `audits/ign_staging_security_check_20261017.md`, `audits/original_app_migration_progress_20261017.md`, `audits/supabase-migration-status.md` | Historical source/migration and browser-validation evidence; superseded where later main docs differ. |

Casino paths in the table are relative to that repository's `docs/` directory
unless the full repository prefix is shown. Preserve this source attribution if
those reference documents are copied into the canonical repository.
