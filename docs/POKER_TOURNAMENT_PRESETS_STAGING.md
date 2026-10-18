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
This is a **Superadmin staging preset creator**, not a 30-table live tournament launcher. Existing `poker_event_*` procedures include six-seat assumptions and require further work for 7–8 seat assignments, balancing across up to 30 tables, synchronized blind levels, elimination verification and hand-by-hand hand-history audits. Until that work and multi-user end-to-end tests are complete, presets remain `draft` and there is no activate/start tournament button.

The poker hand-settlement routine does **not** currently deduct rake. Configure rake by currency as a proposed policy only; financial chip collection, prizes, real-money buy-ins, crypto, tournament fees, rake distribution and redemptions remain disabled pending eligibility, regulatory and independent custody approval.

Bomb-pot cadence is stored but the server poker dealing engine does not yet create bomb-pot hands. Its UI explicitly marks it 'not yet playable'. The three-table desk runs embedded sessions and has not been load-tested with three active real participants.

## Reviewable source
- `pages/SuperadminPokerTournaments.jsx`
- `pages/PokerMultiTable.jsx`
- `supabase/migrations/20261018013000_poker_tournament_staging_presets.sql`
- `supabase/functions/ig-poker-tournament-admin/index.ts`
- `tests/pokerTournamentPresets.test.mjs`

**Do not merge this staging work into production or represent configured rake percentages as charged rake.**
