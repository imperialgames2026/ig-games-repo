# Final owner-approved game migrations

Scope: Darts, Dice Zone, HiLo, Rocket and Towers only. The other 23 previously
blocked routes are explicitly on the non-migration list in
`config/game-migration-scope.json` until further owner instruction. Existing
verified games remain available. This is a fresh Supabase start with no customer
accounts, balances, history or files to import; no Base44 export is required.

## Implementation

| Route | Supabase service | Rules |
| --- | --- | --- |
| PlayDarts | ig-final-practice | Original four weighted difficulty tables; server-owned draw; multipliers are practice score labels. |
| PlayDiceZone | ig-final-practice | Uniform integer 1–100; selected inclusive interval is locked at commitment. |
| PlayHiLo | ig-final-practice | Server-owned 52-card draws with replacement; Ace low; higher/lower includes ties; Same requires equality. Stop, miss or 50 predictions ends the round. |
| PlayRocket | ig-crash-v2 | Rocket entry to the existing shared server-timed Crash flight, using its practice-chip and cashout protections. |
| PlayTowers | ig-final-practice | Nine floors of three tiles; Easy has one mine, Hard two. Only the current floor is playable. Stop, mine or ninth safe floor ends the round. |

No wallet/transaction/prize mutation is implemented by the four new games. Rocket
uses the existing nonredeemable practice chips. All paid settlement remains disabled.

Legacy discrepancies were resolved explicitly for this practice implementation:
HiLo's frontend used inclusive comparisons while its archived function used strict
comparisons. Towers had inconsistent difficulty/payout tables, including three
mines across all three tiles in Nightmare. Only the two distinct playable board
configurations are exposed; duplicate payout variants and the impossible mode
are not presented. No legacy RTP/house-edge or real payout claim is reproduced.

The new internal database service locks owner eligibility and round state, rejects
anonymous/excluded/tester mutations, binds retry IDs to the complete action and
version, rejects changed/stale actions and permits only one unfinished round per
owner/game. Commits bind game/options. Seeds and Towers layouts stay private until
the round ends. HiLo returns only cards already drawn. Browser commitments and
submitted client seeds are persisted before start; reload or a lost response
cannot silently establish a replacement proof baseline.

Independent HMAC-SHA256 rejection sampling derives server outcomes. Ended proofs
are recalculated in Web Crypto, including every card/tile selection and ending
reason. Committed SQL is exported from recorded history with exact checksums.

## Staging and verification

Staging project: `qonqemhljgxlwpghkxhn`. Recorded migrations:
`20261020220837_final_approved_practice_games` and
`20261020221122_final_approved_game_catalog`. `ig-final-practice` v1 is active with
JWT verification enabled; deployed source was read back byte-for-byte.

The reviewed package contains 92 migrations and 30 functions. The catalog has 20
entries and 21 verified routes, including the Blackjack and Rocket aliases. The
other 23 routes remain gated and are classified as non-migration/on-hold.

Live rollback tests passed independent Python vectors, all four game round flows,
commit/start/move replays, seed conflicts, other-owner denial, unfinished-round
limits, stale moves, tester/exclusion retries, hidden-state grants, final reveals,
invalid settings and unchanged financial ledgers. Test fixtures rolled back.
The isolated runner adds the new SQL suite (14 total) and actual local Supabase
Auth/Edge Function/browser checks for all five routes. Offline proof/handler tests
and browser coverage supplement, rather than replace, those runtime checks.

Production cutover, payment providers and other account/business features remain
separate from these free practice game migrations. Historical customer import is
out of scope by owner instruction.
