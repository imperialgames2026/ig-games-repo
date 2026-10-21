# Test the Imperial Games Poker staging lobby

**Status (2026-10-17):** Edge Functions and database migrations deployed in `imperial-games-staging` (`qonqemhljgxlwpghkxhn`). React changes committed on `integration/app-scaffold-audit`; **frontend has not been deployed**. No real-money chips, financial wallets, redemption, rake, or prizes.

## Required setup

1. Two distinct registered Supabase Auth users (one to create an event, another to join as player; both may join the same event).
2. An explicitly approved **Superadmin account** with a row in `public.user_roles`. There are no Superadmin roles currently assigned on staging. The account owner must choose which email receives the role. From the Supabase SQL Editor, after verifying the intended identity:

```sql
insert into public.user_roles (user_id,role)
select id,'superadmin' from auth.users where lower(email)=lower('REPLACE_WITH_YOUR_TEST_EMAIL')
on conflict (user_id) do update set role=excluded.role;
```

3. Clone the integration branch and configure the public Supabase client key (never put `service_role` in the browser):

```bash
git clone --branch integration/app-scaffold-audit https://github.com/imperialgames2026/casino-zip.git
cd casino-zip
cat > .env.local <<'ENV'
VITE_SUPABASE_URL=https://qonqemhljgxlwpghkxhn.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_STAGING_PUBLISHABLE_OR_ANON_KEY
ENV
npm install
npm run typecheck
npm test
npm run build
npm run dev
```

Find the public/publishable key in the Supabase project dashboard's API settings. Only proceed to browser tests if the commands pass.

## Two-player Sit & Go test

1. In browser A, sign in as designated Superadmin. Open **Admin** -> **Poker Event Builder**. Choose Sit & Go, 2 seats, 2 maximum players, 1,000 practice chips, blinds 5/10 and a 10-minute level; create draft.
2. Click **Refresh drafts**, then **Publish registration**.
3. In browser A, open **Games** -> **Online Poker**, and register. In an independent incognito window or another browser, sign in as player B and register for the same event. Each account needs a distinct Supabase Auth user.
4. Superadmin returns to **Admin** -> **Refresh drafts** and clicks **Seat players & start**. A full Sit & Go won't start until all seats are registered.
5. Both players open **Games** -> **Online Poker** -> **Open my table**. The assigned table owner clicks **Deal next hand**. Only your own hole cards should appear in the snapshot.
6. The player whose seat matches **Turn** can check, call, fold, raise, or go all-in. Use **Reconnect / refresh snapshot** after closing/reopening a browser tab to confirm the server retains turn, stacks, and cards.
7. When a street completes, click **Deal next street**; after river showdown, click **Settle showdown**. After a hand ends, click **Process eliminations / balance seats**, then the owner deals the next hand.
8. If a player loses all practice chips, process eliminations; if only one remains, the event should become `finished`.

For scheduled MTTs, use a future scheduled time. **Seat players & start** is manual and prohibited before the scheduled time. With more than six players, tables are created in groups of up to six; table balancing is restricted to between hands. No unattended schedule runner exists yet.

For ring tables, this build supports an initial fixed practice stack and repeated hands; **cash buy-in, top-up, cash-out, and rake are not implemented**.

## Security/regression verification

The committed SQL test `supabase/tests/poker_event_smoke.sql` checks registration, hand start, action replay, chip conservation and dealer rotation using two Auth accounts. It runs inside `BEGIN ... ROLLBACK` and does not leave test data. A separate two-request concurrency test was run on staging: one action accepted, one rejected, one action row committed, and a 2,000-chip invariant preserved.

The `poker-table-v1` Edge Function uses Supabase Auth; only seated users can request private snapshots, and undisclosed deck/seed are withheld until the hand is complete. A cryptographic seed commitment is checked before each hand and the deck is HMAC-shuffled deterministically. Use separate real sessions to check permissions, hidden cards, and reconnect behavior.

## Not yet verified / not production-ready

- CI TypeScript, Vitest, build status on the latest commit has **not** been confirmed.
- Authenticated full browser E2E across two separate accounts has **not** been performed.
- Comprehensive multi-table balancing under concurrent actions, long-run game logs, timeouts and automatic player actions need testing.
- Game rules still need exhaustive edge-case review (side pots, short all-in raises, split pots, odd chips, dead blinds, tournament ante).
- Automated scheduled starts, late registration, disconnect timeouts and blind-clock background jobs are not implemented.
- Provably fair complete-hand postmortem replay and independent security audit remain required.
- Sweepstakes/financial compliance, real-value settlement and production deployment are disabled.

Do not merge into `main` or activate real-value play without a clean CI and live session test.

## Ten-second turn clock and purchasable time extension (staging)

- **Base time per turn:** 10 seconds, measured using Postgres `turn_started_at` and `turn_deadline_at`. Each new actor and each new betting street gets a fresh 10-second deadline.
- **Expiry:** Check automatically if there is no wager to call; otherwise fold. Late actions are rejected by the database even if the UI is delayed or the user disconnects.
- **Unattended tables:** `pg_cron` job `imperial-poker-turn-timeouts` runs `public.poker_process_due_turns_v1(50)` every **1 second**. The scheduled job was observed active and succeeding in staging, and an expired test turn was folded without a browser request. Monitor job load when scaling and tune batching if necessary.
- **Extension:** Once per **turn**, add exactly 30 seconds to the existing deadline (for up to 40 seconds total). The server checks turn ownership, expiry, idempotency key and table revision with row locks.
- **Price:** Configured at **0.15 IGD**. IGD wallet debit and the matching financial transaction record execute in the same database transaction as the extension. The debit path passed a rollback-only test, including insufficient funds, exact 0.15 charge, no duplicate charge on retry, and ledger receipt. **Paid mode is disabled by default** on staging.
- **IGN equivalent:** Not configured. The existing schema has an IGT balance, not an IGN balance; never infer that IGN equals IGT. The server rejects IGN purchases until a specific asset, exchange rate and ledger mapping are approved.
- **How to test without IGD:** On the player’s turn, click **Try +30s (free staging preview)** before the 10-second deadline. You should see the countdown extend to approximately 40 seconds. The practice extension never modifies the wallet. It is enabled only in staging until paid mode is audited.
- **Testing a timeout:** Leave the browser unattended for 10 seconds. You should see the turn automatically check or fold and transfer to the next player. The page polls for snapshots, but the server timeout job does not depend on the browser staying open.
- **Database regression test:** Run `supabase/tests/poker_timebank_smoke.sql` in staging. It rolls back all changes. Separate tests verified the paid debit path, simultaneous extension requests (one accepted), free-check timeout, and the server background watchdog.
- **Operating control:** To suspend the job if required, use the Supabase SQL editor to run `SELECT cron.unschedule('imperial-poker-turn-timeouts');`. Do not disable deadlines in the database.

**Remaining gate:** The full React app build and signed-in two-browser E2E are unverified. Do not call paid IGD extensions production-ready until permissions, account eligibility, refunds/disputes and real-value wallet behavior pass review.

## Planned IGN Solana token: market-priced (not deployed)

IGN is a **future, market-priced Solana token**, distinct from the legacy IGT balance. It has not been minted; no mint address, pool, valid market feed, token decimal precision or liquid market is yet established. IGN purchases remain **disabled** until these requirements are independently verified.

For Poker's +30-second timebank, the base price stays at **0.15 IGD**. Its market-value equivalent in IGN must be quoted using an explicitly validated IGD/USD valuation and an independent, fresh IGN/USD market price. The quote must include signed timestamp, source(s), slot/observation details where available, spread/slippage constraints, token decimals and a short expiry; reject stale or manipulated/illiquid prices and unavailable oracles. Never equate IGN with IGT.

Before enabling an IGN timebank purchase: verify Solana mint and accepted token program; verify the actual SPL token transfer and finality; bind transfer, wallet ownership, quoted price, purpose, table/turn and unique idempotency key; settle the charge and deadline extension together or compensate on-chain transfers safely if off-chain state fails. Ensure one extension per turn across races and reconnects. A client-provided price or transaction hash alone must never authorize an extension.

No market-priced token payment feature should be activated without compliance review, pricing/oracle tests, replay-attack protection and a complete chain-to-ledger reconciliation.
