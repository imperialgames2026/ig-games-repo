# Imperial Poker: four-account AI bot laboratory (staging only)

## Current deployment state

The `ig-poker-bot-lab` Edge Function is deployed to staging project `qonqemhljgxlwpghkxhn`, JWT verification required. The private `ig_poker_lab_bots` and `ig_poker_lab_tables` tables are created with RLS and no anonymous or authenticated SQL grants. Source is tracked on branch `feature/poker-ai-lab-staging` based on `work/poker-frontend-route-20261018`.

**Important:** The four Auth user records are **not automatically created by deployment**. That is an explicit Superadmin operation from `/PokerBotLab`, only after the original-app branch has been deployed to an authenticated staging preview. At deployment-time inspection, zero bot Auth records and zero bot tables were provisioned. Do not report them as existing accounts yet.

## Personalities

- Imperial Ace **[AI BOT]**: tight selective strategy, folds weaker hands to meaningful bets.
- Bluff Baron **[AI BOT]**: aggressive bet and raise pressure.
- Calling Carl **[AI BOT]**: frequent checks and calls.
- Wildcard Wendy **[AI BOT]**: mixed raises, folds and occasional all-ins.

These are transparent **rule-based simulation agents**, not general-purpose LLMs, and they cannot see opponents' private cards during action selection. Only publicly dealt board and own cards inform the rule-based decisions; cryptographically secure randomness supplies varied play.

## Activate in staging

1. Build and deploy the original app's branch to a **staging preview only**. Sign in with a verified, non-excluded Superadmin account.
2. Visit Poker Lobby → **AI Poker Test Lab**, or navigate to `/PokerBotLab`. The server checks a real Supabase JWT, profiles and canonical `user_roles` for each action. No client-provided actor IDs are accepted.
3. Click **Provision four AI bot accounts**. This creates four distinct Supabase Auth entries with randomized unreturned passwords under `example.invalid`, banned interactive login, `app_metadata.imperial_poker_bot=true`, approved `player` role for practice poker, and clearly labeled display names. The accounts are not human test credentials.
4. Click **Create 4-seat test table**. The server creates a 1,000-chip practice Hold'em table and seats all four bots, using the existing `poker_create_v1` and `poker_join_v1` RPCs.
5. Click **Simulate a full hand**. Each server-validated bot decision flows through `poker_action_v3` with an action UUID and table version; dealing, street advancement and settlement reuse the production candidate's *practice* engine RPCs. The simulator checks that the original 4,000 play chips remain accounted for.
6. Open the table link to view cards/board/action changes. Bot seat names are annotated `[AI BOT]`. Human observers may join while the table is waiting; then the test console's full-hand simulator **refuses to play through their turn** and a Superadmin must choose individual steps instead.

This API does **not** run an unattended cron agent and has no access to the financial wallet operations; only a Superadmin-triggered batch or step runs. No live poker deployment or real-value betting is authorized.

## Poker engine integration tests executed

Rollback-only SQL integration tests ran against staging poker tables using existing distinct staging Auth identities as **test participants** (not impersonated or renamed as bots). All mutations were undone at the end of each test.

- **Two-player complete Hold'em**: independent seats and hole cards; blinds; check/call; every board street; settlement; replay idempotency; sum of stacks plus committed bets always **2,000**.
- **Four-player complete Hold'em**: four distinct hole-card hands, valid raises/checks/calls, another-seat turn rejected, an identical action UUID replayed without double debit, full five-card board, settlement, sum of stacks plus commitments always **4,000**.
- Root typecheck, Vitest suite, root build, preserved original-app build, and Deno Edge Function typecheck are configured in `.github/workflows/poker-ai-bot-lab.yml`. Build status must be confirmed on final branch SHA.

## Release blockers

- Four real bot Auth records and bot-owned table have not been provisioned yet; the Superadmin action requires an authenticated staging session.
- Authenticated browser and runtime API E2E with the newly provisioned bots has not run.
- The bot strategies are simple test heuristics and not a trained poker agent or real-money competitor.
- Side-pot correctness, short all-in rules, dealer fairness audits, latency races, watchdog/turn deadlines, profile security, 8-seat capacity, and multiple hand stress tests still require independent validation.
- No bot account or table may connect to real deposits, withdrawals, rewards, wallet payment providers or external casino play. Do not deploy this feature on the production app or enable real-money poker.

The historical staging database's `auth.users` entries and player wallets are never used as a source of a bot password or impersonated during provisioning.
