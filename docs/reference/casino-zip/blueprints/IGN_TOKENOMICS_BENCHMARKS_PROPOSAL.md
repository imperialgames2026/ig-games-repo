# IGN — Imperial Games Network: tokenomics & casino benchmark blueprint (WORKING ALLOCATION APPROVED)

**Status:** the 7-bucket distribution percentages and token amounts below were approved by the project owner as the **working design baseline** on 2026-10-17. This is not approval of on-chain transfers, wallet creation, vesting milestones, financial product release, or Mainnet launch. Last reviewed 2026-10-17. Do not enable wagering, redeemable balances, real-value payouts, wagering-based VIP rewards, revenue-linked staking or token purchases in production without legal, security, risk and financial review.

## Existing facts / architecture alignment

- IGN has a fixed-supply Solana **Devnet** SPL token with mint `CQpbojFzQJfcEjXJYRHSg4bnTheGKDJtEgPxQZLdivvz`, 9 decimals and 10,000,000,000 token units issued. Mint and freeze authorities are absent per owner's CLI output. This is *not* a Mainnet token or a public trading price.
- Metaplex fungible metadata account: `AwunVJkw7XnhGXtKWjHCBD9vJE2wJcRuBSNjZ7a6GQSF`. Public JSON: https://gateway.pinata.cloud/ipfs/bafkreihf7evpmwrr6khqw6u5nobws7ekveivmyjirqd65rrct6r7uz6fle ; image: https://ipfs.io/ipfs/bafybeieqxbi5xoca3mubw4al5hsavsfdco3xxspu2363rkrneyr6ofp6ga.
- Art direction: original hot-pink big-cat mascot; seven-point metallic-gold crown; black/gold medallion; IGN gold monogram. Use 256px icon in wallets, 512/1024px on app cards, and a simplified high-contrast silhouette at small sizes.
- Current backend: Supabase Auth + RLS, server-only gameplay RPCs and ledger functions, React/Vite lobby, 10-second Poker timer and +30s **one-use free staging preview**. The proposal retains practice-only staging.
- The uploaded Solana casino blueprint specifies GC/SC and SPL token separation, 2-hour staking epochs, Phantom account watchers, NFT avatars, VIP scorecard, anti-collusion, server-backed Poker/Blackjack/Roulette. This document *does not* treat the proposed 2-hour rake distribution or wagering as approved or deployed. GitHub `docs/game-engines/poker-tournaments-and-ring.md` explicitly forbids real-value settlement in the staging build.

## Competitive benchmarks: source facts versus proposed IGN adaptations

| Comparator / published fact | What is useful | IGN adaptation (proposal, not competitor implementation) |
| --- | --- | --- |
| BC.GAME publicly described $BC as a **10B fixed-supply** token with 2024 allocation of 20% community airdrop, 50% liquidity mining, 10% liquidity bootstrap, 10% advisors, 10% marketing. Its 2026 update describes a staking-engine/burn mechanism. | Publish transparent supply, distribution, wallet labels, vesting, and active utility. | Use **different**, reserve-conscious allocations and publish Devnet evidence plus later audited Mainnet addresses; do **not** promise yield or price support. |
| BC.GAME distinguishes its native $BC from BCD (a casino-specific play/reward accounting unit). | Avoid conflating tradable token and internal games balance. | **IGN** is market-priced Solana SPL token; **IGD** is app balance; **practice chips** never redeem. IGT legacy wallet balance is *not* IGN. |
| Stake VIP documentation describes tiers, weekly/monthly benefits, rakeback, host service. | Clear tier progression and player dashboard. | Start with **non-financial** perks earned by safe activity (profile customization, badge, table themes, tournament UI) rather than wager-volume incentives. |
| Shuffle describes SHFL airdrops, VIP boosts and wagering-linked token mechanics. | Transparent campaigns and token utility. | Any community distributions: capped, sybil-resistant, no deposit/wager requirements in the initial test pilot; legal review before transferable rewards. |
| Rollbit 2021 RLB whitepaper describes staking-linked lottery and burn. | Mechanism disclosures are important. | **Do not** ship lottery, revenue share, 2-hour staking returns, or early unstake burn without financial/regulatory and smart-contract review. |

**Sources**
- Original project blueprint: `solana_casino_platform_blueprint.docx` (uploaded)
- BC.GAME official community allocation (2024): https://forum.bc.game/topic/15976-introducing-the-bc-token-empowering-the-future-of-crypto-gaming/
- BC.GAME $BC 2026 update: https://www.newswire.ca/news-releases/bc-game-updates-bc-white-paper-revealing-new-details-on-token-utility-and-burn-mechanism-837991373.html
- BC.GAME BCD help: https://help.bc.game/en/articles/7831369-deposit-bonus-and-locked-bcd-rakeback-all-your-questions-answered
- Stake VIP: https://stake.com/vip-club
- Shuffle SHFL: https://help.shuffle.com/en/articles/8282770-shuffle-token-shfl
- Rollbit RLB whitepaper (2021): https://rollbot.rollbit.com/rlb.pdf

## Approved working fixed-supply IGN allocation (not allocated on-chain yet)

| Bucket | Share | IGN | Proposed administration |
| --- | ---: | ---: | --- |
| Community access, rewards and ecosystem education | 25% | 2,500,000,000 | Public campaign budgets with transparent eligibility, anti-sybil controls and rolling releases |
| Market liquidity / trading infrastructure reserve | 20% | 2,000,000,000 | Segregated treasury with explicit market-risk policy; no artificial price support or wash trading |
| Product development & security operations | 20% | 2,000,000,000 | Budgeted vesting/disbursement, audited vendor payments, security research |
| Long-term company treasury | 15% | 1,500,000,000 | Multisig custody, 48-hour transfer delay for large moves, disclosures |
| Founders and team | 10% | 1,000,000,000 | Proposed 12-month cliff + 36-month monthly vesting after Mainnet launch |
| Partners & integrations | 5% | 500,000,000 | Milestone-based unlocks; prohibit self-dealing |
| Emergency security and contingency reserve | 5% | 500,000,000 | Multisig + incident approvals; do not use as discretionary hidden supply |
| **Total** | **100%** | **10,000,000,000** | **Fixed supply; no further minting** |

This distribution is approved as a **working plan**, not a binding transfer authorization. The existing Devnet token has not been distributed into these buckets. All releases, recipients, lockups and Mainnet decisions remain subject to separate approvals.

### Treasury/vesting safety

- Wallet model: immutable mint identity; distinguish holding ATA from treasury multisig, community program and liquidity wallets. Prefer hardware-backed multisig with independent approvers. Avoid storing Solana private keys in Supabase, GitHub, environment files, or browsers.
- Use tested SPL Token transfers for scheduled distributions, or an independently audited vesting program. Publish custody wallet addresses and allocation transaction links when launching.
- Maintain per-bucket current, committed, available, vested and unlocked balances. Sum balances including outstanding escrow should reconcile to total supply (minus provable burns).
- Any lock-up/vesting is a separate custody/program mechanism. Revoking **mint authority** does not lock existing wallet-held tokens.

## Product integration roadmap

1. **Devnet wallet UI:** Connect wallet, challenge-signature verification (non-custodial), store only public addresses server-side; prevent replay/cross-account linking. Detect token ATAs, show IGN balances and token explorer. Never treat a signed message as approval to transfer assets.
2. **Token asset registry:** Separate `IGN_DEVNET`, future `IGN_MAINNET`, `IGD`, `IGT`, and non-redeemable practice chips. Explicit mint/program/decimals/chain ID. Reject any automatic switch from Devnet mint to Mainnet.
3. **Treasury dashboard:** Superadmin view of allocations, vesting calendars and on-chain balances; read-only tester permitted; admin cannot alter mint or release tokens. Audited approval queue.
4. **Rewards / VIP:** Staging only: cosmetics, badges, themed tables, avatar/NFT presentation, leaderboards, non-financial social milestones. Verify abuse prevention. No financial gameplay benefits for higher-paying players.
5. **Poker 10s +30s extension:** Keep 0.15 IGD *configured but payment disabled*. Market-priced IGN quote requires independently established IGD/USD valuation and live IGN/USD data (liquid, non-manipulated market); compute as `ceil_to_token_precision(0.15 * IGD_USD / IGN_USD)`, enforce minimums/slippage and a short expiry. Quoted IGN amount must be displayed before wallet approval. Payments and timebank entitlement have different finality/failure domains: implement durable intent/reservation and compensating refund flow rather than pretend cross-chain + SQL are one ACID transaction. Since paying for thinking time creates an uneven poker competition and possible inducements, default to a **free/equal timebank** in competitive tournaments until independently approved. Disable on price outage.
6. **2-hour staking epochs described in blueprint:** Treat as **future research**, not a promised product. Staking rewards funded from casino rake/profits can raise securities, gambling, money-transmission and consumer protection concerns. Require specialized US/legal counsel, audited Anchor programs, vault accounting, pause and recovery paths, plus terms/geo/KYC before consideration.
7. **Games & fairness:** Keep Poker / Blackjack / Roulette practice-only until server-owned fairness proofs, side-pot rules, recovery tests, payout invariants, audit and 2-client browser E2E pass. No wallet transfers triggered by client game results.

## Architecture boundary (non-negotiable)

```text
React / Vite (Supabase Auth) ---- Edge Functions ---- Postgres (RLS + audit)
         |                              |
 Phantom / Solana wallet                +-- Token quote & verifier (disabled in staging)
         |                              |    `price -> intent -> approval -> finality -> ledger`
 Solana Devnet RPC ----------------------+ 
         |
 IGN Devnet SPL mint / metadata (public addresses only)
```

Only use an external price feed when IGN trades at meaningful volume; a Devnet token has no independent market price. Avoid unsupported guarantees of returns, appreciation, floor prices or buybacks.

## Release checklist / required owner decisions

- [x] Approve working percentage buckets and nominal IGN amounts (owner approval, 2026-10-17; no tokens transferred).
- [ ] Approve recipients, vesting/cliffs, liquidity budgets, wallet addresses and custody multisig members separately.
- [ ] Decide whether the public name should remain “Imperial Games Network” or “Imperial Games” across site, legal documentation and token registries.
- [ ] Agree to independent legal review of token distribution, U.S./other jurisdiction restrictions, sweepstakes/crypto/gaming mechanics, marketing and rewards before Mainnet.
- [ ] Add Devnet-only dashboard, wallet public key binding, explorer links, token-specific balance view and regression tests.
- [ ] Document migration to a **separately created** Mainnet mint (not the Devnet address).
- [ ] Complete contract auditing and price/oracle/finality threat models before any token settlement or staking launch.
- [ ] Require passing CI and PR review; leave this proposal in integration branch and do not merge to `main` until approved.

## Branding implementation notes

- Token badge: use original pink big-cat with **seven crown tips** / deep charcoal and metallic gold. Preserve legibility at 32px and 64px; simplified shape for favicon.
- Lobby feature: clear **IGN** wallet balance with a distinct gold/pink token emblem; label **Devnet / Test** in a visible manner.
- Treasury view: dark charcoal background, sharp gold typography, hot-pink status accents, accessible contrast, strong number typography. Show **token supply** and **circulating supply** separately and never imply a price or market cap for Devnet.

## Treasury/dashboard continuation

Detailed proposed wallet/account model, UX specifications, role boundaries, implementation contracts, and acceptance criteria: [`IGN_TREASURY_AND_DASHBOARD_DESIGN.md`](./IGN_TREASURY_AND_DASHBOARD_DESIGN.md). Design only; no deployments, custody signers or asset movements.
