# Imperial Games — Multiplayer Craps & Roulette (Staging)

**Status:** multiplayer casino-style PRACTICE ONLY. No real-money play, cash prizes, transfers, crypto deposits or withdrawals.

## Implementation
- Pages: pages/PlayCraps.jsx and pages/PlayRoulette.jsx; lobby links in pages/Games.jsx.
- Felt and betting UI: components/games/MultiplayerPracticeTable.jsx.
- Browser synchronization: hooks/useMultiplayerPractice.js (server state refresh every 3 seconds).
- JWT-authenticated API: supabase/functions/ig-multiplayer-practice/index.ts, deployed exclusively to Imperial Games staging project qonqemhljgxlwpghkxhn.
- Database migrations: supabase/migrations/20261017200000_multiplayer_practice_tables.sql and 20261017200500_fix_multiplayer_practice_role_variable.sql.
- Postgres shared state: ig_mp_tables, ig_mp_players, ig_mp_bets and ig_mp_events.
- Postgres RPC actions and state views are service-role-only; browser roles are denied direct table writes by grants and RLS.
- Up to 24 actively seated participants per room. An inactive seat is reclaimed after ten minutes; users can explicitly leave and rejoin without losing or resetting their existing chips. Every eligible player begins with 1,000 nonredeemable, nontransferable imaginary chips per game room once. Read-only testers can watch without joining.

## Craps
- Shooter box supports swipe-to-shoot or the Shoot the Dice control. Browser gestures never decide dice values.
- The betting felt has Pass Line, Don't Pass, Field, Any Seven, and Place 4/5/6/8/9/10 zones.
- Come-out 7/11: Pass wins, Don't Pass loses. Come-out 2/3: reverse. Come-out 12: Pass loses, Don't Pass pushes.
- Come-out establishes point 4/5/6/8/9/10. Pass and Don't Pass stay active until point hit or seven-out. Place bets settle when that number hits or 7 rolls while a point is ON.
- Field and Any Seven are one-roll side bets. Field 2 and 12 pay 2:1 profit; other winning field totals pay 1:1 profit. Any Seven pays 4:1 profit.
- Seven-out during point phase resets point and rotates shooter to the next eligible active seat. Come-out seven does not rotate shooter. Absent shooter can be claimed after a 60-second inactivity window.

## Roulette
- European single-zero (0-36) table, with inside straight-up numbers, red/black, odd/even, low/high, dozens and columns.
- One designated spinner resolves all placed practice bets for the shared round. Outside bets lose if zero appears.
- Straight-up 35:1 profit, dozen/column 2:1, even-money bets 1:1; winning returns include initial stake.
- Every result and settled practice bet is recorded before a new betting round opens.

## Shared betting countdown and seat lifecycle
- The authoritative database clock opens each new round for 12 seconds. Every eligible player can place nonredeemable side bets during that window; the shooter/spinner cannot act until it closes.
- The server rejects late bets and premature throws/spins regardless of what a player's browser clock displays. The UI uses the server time to display a synchronized countdown.
- Players can leave a room, releasing their seat while retaining existing practice-chip balances and outstanding bets. Leaving as shooter hands control to another recently active seated player; when no shooter remains, the next new join starts a new betting window.
- Joining reactivates an existing seat rather than giving another initial 1,000 chips. Seats inactive for ten minutes are automatically reclaimed on subsequent joins without resetting their chips.
- Two additional rollout migrations implement these rules: 20261017201000_multiplayer_betting_windows_and_seats.sql and 20261017201500_multiplayer_idle_seat_reclamation.sql.

## Security and correctness
- PostgreSQL locks the shared table row before accepting chip bets or resolving a round.
- Bet request IDs and shooter action IDs are idempotent. Replay with altered details or stale round IDs is rejected.
- The server generates outcomes with rejection-sampled cryptographic random bytes; no browser-provided dice or wheel result is trusted.
- No mutations of wallets, transactions, crypto custody, payouts or payments.
- Excluded accounts and unauthorized users are denied; tester is read-only.
- Staging SQL rollback tests verified two simultaneous simulated participants, side bet settlement, non-shooter rejection, idempotent roll, and roulette spin.
- GitHub CI runs multiplayer, legacy backend guard and independent SHA-256/HMAC practice-Dice proof tests before the Vite build. SQL integration tests are run as rollback-only staging transactions (not against real wallets).

## Not yet production-ready
This is a bounded prototype with one shared room per game and 3-second polling, not a fully certified real-time casino. Simultaneous signed-in browser testing, independent randomness audit, responsible-gaming checks, anti-collusion controls, legal licensing review, concurrency/load tests, accessibility/usability testing, more tables/matchmaking and moderation remain open. Real-money wagering MUST NOT be enabled. Keep integration/casino-zip separate from main until the broader migration is fully verified.
