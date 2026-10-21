# Poker, Blackjack and Roulette — engine migration blueprint

Source references: uploaded `solana_casino_platform_blueprint.docx` and `ig-games (1).zip`.

## Shared server architecture
- Supabase Auth; roles enforced server-side; no browser authority over cards, spins, turn order, or balances.
- Server-side state machines with monotonically increasing revisions, authenticated actions, idempotency keys and immutable event histories.
- Cryptographically secure randomness and commitments before outcomes; protect hidden cards and seeds until appropriate reveal.
- One atomic ledger transaction per bet/settlement; no client-defined payouts, rake or currency conversion.
- WebSocket/realtime broadcasts of public table state only. Reconnect from canonical database state; reject stale or replayed actions.
- Free-play staging until independent game mathematics, authorization, race-condition, wallet and compliance tests pass.

## Roulette
- European single-zero wheel (0–36), automated rounds, 15-second bet window.
- State: BETTING -> LOCKED -> SPINNING -> SETTLED -> BETTING.
- Server generates wheel outcome; validates inside/outside bets, limits, cutoffs, payouts and duplicate submissions.
- Source UI: `src/pages/PlayRoulette.jsx`, `src/components/games/RouletteGame.jsx`, `RouletteWheelVisual.jsx`, `rouletteData.jsx`.
- Tests: every number and bet type, 0 behavior, exact cutoff, reconnect, idempotency, RNG audit.

## Blackjack
- Multiplayer seated table; natural blackjack pays 3:2; configurable dealer stands/hits soft 17 (blueprint does not settle this).
- State: WAITING -> BETTING -> DEAL -> PLAYER_TURNS -> DEALER -> SETTLED.
- Server manages shoe, hidden hole card, split/double/insurance/surrender only when explicitly configured, dealer rules and seat timers.
- Source UI: `PlayBlackjack.jsx`, `PlayMultiplayerBlackjack.jsx`, `BlackjackLobby.jsx`, `blackjack/TableSeatLayer.jsx`, `blackjack/TableBetSpots.jsx`; backend `base44/functions/dealBlackjack/entry.ts`, `blackjackAction/entry.ts`.
- Tests: ace handling, soft 17, naturals, splits, double, bust, simultaneous seats, turn order and stale actions.

## Poker
- Multiplayer No-Limit Texas Hold'em, blinds, preflop/flop/turn/river, showdown and blueprint-specified 5% rake (cap/eligibility must be decided).
- Server manages deck, private hole cards, button rotation, legal betting, min raises, all-ins, side pots, hand rankings, showdown, rake and disconnected players.
- Source UI: `PlayPoker.jsx`, `PokerLobby.jsx`, poker components; backend `base44/functions/generatePokerHand/entry.ts`.
- Tests: exhaustive hand ranking, tie splits, odd chips, multiway side pots, short all-in reopening rules, heads-up blinds, timers, duplicate actions and collusion signals.

## Build order and gates
1. Inventory legacy modules and verify rule parity.
2. Implement pure rules engines and exhaustive deterministic unit/property tests.
3. Implement server-owned round/table state, secure APIs and Realtime.
4. Integrate legacy UI into React/Supabase scaffold.
5. Implement atomic free-play accounting and end-to-end multiplayer load/race tests.
6. Security review and independent validation before any real-value mode.

No real-money game, wallet or Solana integration is authorized by this document alone.
