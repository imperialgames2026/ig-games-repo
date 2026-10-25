# Practice-game fairness and replay boundaries

The table-game protocol is `hmac-sha256-table-v1`. The authenticated state RPCs expose the current commitment and up to twelve completed proofs. The private `internal.table_fair_rounds` records are immutable after the seed, seat plan or result is first set. Client roles cannot read the table or execute its secret-bearing helpers.

Each game and round has a fresh 32-byte server seed. Before the deal/roll, publish:

```
SHA256("table-fair-v1|" + game + "|" + round + "|" + serverSeed)
```

For step `i` and rejection attempt `a`, calculate HMAC-SHA256 with the UTF-8 hexadecimal seed as the key and this exact message:

```
"table-fair-v1|" + game + "|" + round + "|" + i + "|" + a
```

Interpret the first four bytes as unsigned big-endian. Reject samples outside `floor(2^32/bound)*bound`, then take modulo `bound`. Attempts are bounded at 64; sampling failure aborts the transaction.

- Blackjack: canonical 312-card six-deck shoe, card values `i % 52`, forward Fisher–Yates steps 0 through 310. The deal records the participating seat order and original wagers. Browser verification reconstructs initial dealing, observed player draws in turn order, dealer draws, totals, main-hand returns and Perfect Pairs returns. Dealer stands on all 17s. The seed is withheld until every hand settles.
- Baccarat: canonical 416-card eight-deck rank shoe, values `i % 13 + 1`. Shuffle the first six positions with partial Fisher–Yates. The verifier independently executes natural/third-card rules, totals and winner selection.
- Craps: sample steps 0 and 1 with bound 6 and add one. Verify dice, total and point transition, including the point observed before the roll.
- Roulette: sample step 0 with bound 37; zero is green. The existing house clock and settlement rules remain in place. The seed is withheld during the spinning presentation and released when that round settles.

The browser keeps up to 256 device witnesses per game, separately from the server ledger, to prevent browser storage filling during long sessions. Clearing or expiring a witness removes the original-lock comparison for that device; it never retroactively certifies a round.

The browser pins game/round commitments before accepting snapshots. A changed pin, observed card, seat plan, point or displayed result fails closed. A mathematically consistent proof without a pre-deal device pin is explicitly labeled as unwitnessed consistency, not as proof of the original lock. A matching proof cannot independently establish that an operator did not choose a seed before publishing it.

The migration does not invent deterministic proofs for legacy Blackjack hands already playing or Roulette results already selected. Those rounds finish with their previous rules; the next round creates the first new commitment. Existing stakes, chips, request receipts, turn deadlines and role checks are preserved. No financial wallet or currency logic changes.

## Reported verifier fixes

- Dice requires the submitted client seed as an explicit verification input.
- Crash compares against a saved preflight hash. Its new queue hashes canonical two-decimal numbers. The browser also supports the legacy zero/cap encodings without rewriting historical commitments. This proves commitment consistency, not seed-derived Crash randomness.
- HiLo, Mines and Towers persist observed card/move prefixes and submitted choices, validate action responses before subsequent refreshes, and reject contradictions at reveal. HiLo also checks the displayed starting card against the seed-derived initial card.

## Replay is a separate record

Poker/Omaha already store numbered, hash-chained, participant-bound hand events and provide play/pause, forward/back and step selection. A replay is a reconstruction from recorded events rather than a screen video. The viewer can see their own private information and public actions; folded opponents' cards stay private. The existing poker player authorizations and private-card rules must not be weakened when expanding recording.

For every future PvP game, record accepted commands, actor/turn, version, timestamps, public state transitions and terminal result atomically. Retain private setup separately and produce an authorized viewer projection. Reveal information only when that viewer was entitled to it in the original sequence. Aiming/bowling additionally require authoritative scoring and physics/input validation; Battleship requires committed hidden placements and shot validation. Those game implementations are absent from this repository and cannot yet be integrated or certified here.

## Validation

`npm test` includes real PostgreSQL/pgcrypto protocol tests via PGlite, mixed interleaved games, hidden-seed checks, independent Node HMAC comparisons, tampering/role tests, legacy hand transitions, Crash formatting boundaries and all four reproduced regressions.

`npm run test:fairness:browser` creates proofs from that isolated database and exercises the actual four table screens at desktop/mobile sizes. It verifies device pins, seed/outcome checks, reload recovery, rejected proofs and honest unwitnessed-history wording. The controlled browser API is a test fixture, not a hosted authentication test. The release pipeline separately replays the complete database and runs real local Auth/API/browser integration tests before deployment.

## Hosted release checks (2026-10-25)

Migration `20261025060513_table_game_fairness_and_verification` was applied only after the complete release CI passed. Source readback matched all 15 tested function bodies. The rollback-only hosted QA passed 16 independent Python HMAC vectors across all four game contexts, hidden/revealed seed checks, immutable commitment checks and client-access denial. No fixture rows remain. Current live rounds retain private seeds. Four completed hosted house-clock Roulette proofs were independently reconstructed in Node after deployment. Security advisors reported no warning/error findings; the new private table intentionally denies direct client access through RLS and explicit privilege revocation.
