# Poker tournament presets and 3-table NLHE desk (staging)

## Added
- Superadmin route `/SuperadminPokerTournaments`, linked from the casino Admin dashboard.
- Server-verified role check and service-only transactional preset save on staging Supabase `qonqemhljgxlwpghkxhn`.
- NLHE preset capacity 6, 7, or 8 players per table and 1 to 30 tables (up to 240 configured seats); Omaha is currently limited to 6.
- Create separate presets for different buy-in price points and currencies: PRACTICE, IC, ID, IGD, IGN. Stored prices are configuration data, NOT real payments.
- Configurable nominal per-pot rake 0–10%, cap, no-flop-no-drop toggle, fixed prohibition on taking rake from forced small blind/big blind/antes before a contested pot.
- Starting tournament stack, ante and initial blind level / duration settings; bomb-pot toggle and scheduled cadence, stored as **configuration only**.
- `/PokerMultiTable` desk: up to 3 independent NLHE practice rooms open in separate same-origin embedded pages, add/remove by table UUID, open any room full-screen. No automatic seat reservation or duplicate chip minting.
- Node security tests in CI, rollback-only SQL test in staging, server JWT role validation and RLS.

## What this is **not**
This is a **Superadmin staging preset creator**, not a production tournament launcher. The staging lifecycle supports publishing a free practice event, accepting registrations, and initial event seating for supported table sizes. Production use still requires multi-user end-to-end testing and further work on synchronized blind levels, robust multi-table balancing, elimination verification, and hand-by-hand hand-history audits.

Published zero-buy-in PRACTICE events are visible at `/PokerTournaments`. Players can review the event configuration and register into a practice-only pool; an administrator starts the event and the existing event engine assigns registered entries to tables. Seated players can open their assigned table from the tournament details. This flow does not request or approve a wallet transaction. Late registration into a running event is not supported; running-event seating and wait-pool operations remain disabled until synchronized tournament seating is implemented and tested.

The poker hand-settlement routine does **not** currently deduct rake. Configure rake by currency as a proposed policy only; financial chip collection, prizes, real-money buy-ins, crypto, tournament fees, rake distribution and redemptions remain disabled pending eligibility, regulatory and independent custody approval.

Bomb-pot cadence is stored but the server poker dealing engine does not yet create bomb-pot hands. Its UI explicitly marks it 'not yet playable'. The three-table desk runs embedded sessions and has not been load-tested with three active real participants.

## Reviewable source
- `pages/SuperadminPokerTournaments.jsx`
- `pages/PokerMultiTable.jsx`
- `supabase/migrations/20261018013000_poker_tournament_staging_presets.sql`
- `supabase/functions/ig-poker-tournament-admin/index.ts`
- `tests/pokerTournamentPresets.test.mjs`

**Do not merge this staging work into production or represent configured rake percentages as charged rake.**
