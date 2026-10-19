# Imperial Games IGN — staging tokenomics specification

Status: DRAFT / SIMULATION ONLY. No public token minted, no live deposits, withdrawals, investment returns, buybacks or distributions enabled.

## Token
- Working ticker IGN; verify name, trademarks and existing Solana mint collisions before launch.
- Proposed origin: Solana SPL token; not approved for production.
- Proposed hard cap: 1,000,000,000 IGN. Mint authority revocation only after audited allocations.
- Proposed allocations: player rewards 30%, staking incentives 20%, treasury 20%, liquidity 12%, development 10%, community 8%. All subject to vesting and governance review.

## Reward engine
- Rewards are variable, never promised APY or guaranteed profit.
- Illustrative allocation of *net eligible revenue*: staking 25%, buyback reserve 15%, treasury 30%, security/liquidity reserve 15%, development 10%, community 5%.
- These percentages are NOT applied to gross bets, deposits, player balances or reserved payout liabilities.
- Hourly cycle snapshots; eligible units = amount * lock multiplier, with 1.00x flexible, 1.15x 30d, 1.40x 90d, 1.75x 180d, 2.00x 365d. Eligibility must cover the complete cycle.
- Reward per user = distributable pool * user eligible units / sum eligible units; round down to token precision, retain dust in reserve.
- Idempotent cycle IDs and transaction IDs, atomic ledger entries, explicit reserve backing, immutable receipts.
- Auto-stake OFF by default and opt-in only; never auto-lock player deposits.
- Staking must be separate from gameplay, custody, and user withdrawal balances.

## UI
- Token overview, staking amount, flexible/locked terms, claimable balance, accrued rewards, next cycle, distribution history, circulating/locked/burned supply, verifiable buyback events.
- All values labeled simulation until independently reconciled with on-chain or accounting records. No fabricated price/market-cap charts.
- Responsive global wallet navigation; existing currency selector retained.

## Security and release gates
- Supabase RLS owner read only; no client-side ledger mutation.
- Settlement via reviewed authenticated server functions with rate limits, replay prevention, idempotency, transactional posting and role checks.
- No production staking/reward settlement, buyback, burn or on-chain mint until legal securities/gaming review, audit, custody controls, treasury funding verification, and authorized launch approval.
- Existing $2,500 superadmin withdrawal review and independent custody signing policies remain untouched.

## Acceptance criteria
1. Zero-value demo account displays all dashboard sections without misleading live values.
2. Hourly reward calculations reconcile exactly to funded pools, including zero pool and zero stakers.
3. Duplicate claim/cycle calls cannot double credit.
4. Concurrent stake/unstake cannot overdraw balances.
5. Cross-user reads/writes blocked by RLS and server authorization.
6. Simulated burns/buybacks do not alter real token supply.
7. Mobile and desktop layout, accessibility and currency labels verified.

Reference inspiration: BC.Game BC Token screenshots supplied by project owner. Design must be original, not a copied UI.
