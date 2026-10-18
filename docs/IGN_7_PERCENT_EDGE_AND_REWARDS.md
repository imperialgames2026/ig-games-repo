# IGN 7% Target House Edge / Dual Reward Specification

**Status:** configured and math-tested in Supabase staging ONLY. This is not an active game odds engine or a live reward scheme. The public token, cash gaming, external assets, payouts, and burns remain disabled.

## Target house edge

7% (700 basis points), corresponding to theoretical 93% return-to-player *for games whose exact payout schedule is proven to meet the target*. This is **not** a license to describe all games as 93% RTP: dice, roulette, blackjack, craps, poker, slots, and outside-provider games have distinct rules, distributions, and fee models. Any game implementation must be independently audited before changing its odds or displayed RTP. Poker player-versus-player needs a separately disclosed rake rather than a claim of 7% house edge. Existing practice game probabilities are unchanged.

## Dual rewards from expected house edge

For an eligible wagering total W:
- Expected house revenue = W × 7%.
- Player wagering reward budget = W × 7% × 10% = W × 0.7%.
- Hourly staking reward budget = W × 7% × 10% = W × 0.7%.
- Combined theoretical reward budget = W × 1.4%.
- Remaining theoretical house revenue, before all expenses and obligations = W × 5.6%.

For W = 100,000 units: expected house revenue 7,000, wagering budget 700, staking budget 700, remaining theoretical 5,600. This is **not** actual net profit.

Real distribution requires: verified and settled qualifying game rounds, corresponding game-specific effective edge, no excluded/ineligible bets, treasury reserve funding, anti-abuse policy, independent compliance review, robust user-specific ledger posting, complete-hour stake snapshots, deterministic decimal rounding/dust, and audit-safe replay protection. Neither class of reward can be credited solely from projected hold. The SQL preview function is read-only.

## Staking mechanics

- 60-minute complete-cycle eligibility target.
- Optional automatic staking after reward claim.
- 1% early unstaking burn target if a stake is released in less than seven complete days. This penalty is **not currently activated**. Each deposit lot would require its own timestamp to prevent resetting/evading the rule; do not enable the toggle until lot accounting, fee explanation and tests exist.
- No fixed APY. Rewards scale with the funded eligible pool and individual stake share.
- Proposed supply 1 billion IGN; no mint or market mechanism is activated.

## Implementation boundaries / remaining work
- IGN settings migrated and preview function math tested in staging.
- Staking Edge Function v2 returns policy fields. IGNToken frontend displays them on the feature branch.
- Real payout calculations, per-game paytables, hourly accounting jobs and staking penalty ledger *remain to be implemented and independently verified*. All activation booleans remain false.
- Staging branch is not merged into production. Do not merge without game-by-game RTP simulations, authentication/security integration tests, CI build/lint and regulatory review.
