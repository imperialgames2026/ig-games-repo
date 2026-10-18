# Poker fee model — 1% per-player ante + 2% final pot

**Status:** Staging policy and exact preview calculator deployed. Neither fee is currently deducted by the poker game engine. Existing tables still use forced blinds and no separate ante, so do NOT claim real hands follow this policy yet.

This policy **replaces the general 7% target edge for multiplayer poker**. Poker is player-versus-player; the site collects specified fees instead of imposing an RNG house edge.

## Rules

1. At the start of every eligible hand, each active player dealt in posts a clearly disclosed ante A (separately configured per table). Sitting-out players and players who are not dealt cards are not charged. Participants cannot be charged twice for the same hand.
2. For each player, ante fee = floor(A × 0.01) in whole practice chips. Net ante amount joins the pot. If A is below 100 chips, the integer-chip fee rounds to zero; define fractional chip units before promising an exact effective 1% fee at low stakes.
3. When a hand settles, gross final pot includes net antes plus eligible subsequent betting. Final-pot fee = floor(gross final pot × 0.02), charged once **before** calculating awarded net pot. The examples below use gross pot *before* ante fee, so subtract ante fees first.
4. Winner(s) receive the net pot. Record per-hand fee totals, player source, rake, chip currency, refunded/voided status and hand key in immutable audit receipts, with strict hand-level idempotency.
5. For all-in hands and side pots, decide and test rake allocation and chip remainder distribution; do not create fees from refunded uncalled bets. Tournament rules may require a separate structure or zero rake.
6. These are disclosed **practice-chip calculations only**. No real-money payments, IGN transfers or production casino operation are enabled. Revenue-linked IGN rewards should not assume actual realized poker fee revenue without reconciled, funded receipts.

## Examples with eight players and 100-chip antes

- 800 gross pot (no additional bets): ante fees 8, post-ante pot 792, final-pot fee floor(15.84) = 15, winners receive **777** chips.
- 5,000 gross final pot (including the 800 in antes): ante fees 8, post-ante pot 4,992, final-pot fee floor(99.84) = 99, winners receive **4,893** chips.

## Release checklist

- Add table-specific ante setting and enforce collection atomically in BOTH Hold'em and Omaha server-side hand start operations.
- Integrate 2% fee in the authoritative settlement transaction, return net awards, handle multi-pot and all-in edge cases, maintain conservation of chip ledger balances.
- Ensure no double charging during retries, crashes, reconnects or concurrent requests.
- Verify automated tests for insufficient chips, sit-outs, side pots, fold-to-one, no-contest, uncalled bets, rounding, and tournament exemptions.
- Display actual table ante/fee settings before buy-in; only toggle the staging policy when end-to-end correctness is proven.

Config source: `public.ig_poker_fee_policy` and preview: `public.ig_poker_fee_preview(ante_chips,players,gross_final_pot)`.
