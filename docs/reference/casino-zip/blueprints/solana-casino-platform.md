# Solana Sweepstakes & Crypto Casino Platform — Technical Blueprint

> Source: user-supplied `solana_casino_platform_blueprint.docx` (3 pages, October 2026). Reference specification only; no implementation or legal compliance is implied.

## 1. Architecture
- Dual wallets: separate Gold Coins (GC), Sweeps Coins (SC), and Solana SPL token balances and transaction records.
- Solana Anchor (Rust) contracts: staking, vaults, 2-hour rake distribution, and lockup tiers.
- React/TypeScript/WebSocket multiplayer: roulette, baccarat, blackjack, craps, Texas Hold'em.
- Web Audio/Web Speech dealer effects; heuristic security auditor; Telegram/Twilio alerts.

## 2. Staking state specification
`PoolState`: authority, total_staked, total_weighted_staked, epoch_duration (7200 seconds), last_epoch_timestamp, current_epoch, pending_rake_vault, reserve_floor, is_paused, bump.

`UserStake`: owner, amount_staked, weighted_amount, lock_tier, staked_at_timestamp, lock_expiry_timestamp, last_claimed_epoch.

Lock tiers: Flexible (1.0x), Day1 (1.25x), Days7 (1.5x), Days30 (2.0x).

## 3. Solana frontend
React wallet adapter + `connection.onAccountChange` subscribed to a user's associated token account (ATA), with listener cleanup on unmount. Reconcile balance from verified chain state rather than trusting frontend event callbacks; handle missing ATA, reconnects, commitment/finality, and token decimals.

## 4. Multiplayer rules
- European single-zero auto-roulette, synchronized 15-second betting clock, nominal 2.70% house edge.
- Punto Banco baccarat, modulo-10 valuation, Bead Plate, Dragon 7 (40:1), Panda 8 (25:1).
- Blackjack, multiplayer turns, 3:2 naturals, dealer rules to 17 (soft-17 behavior must be specified).
- Craps shooter queue, action bets, Seven-Out rotation.
- No-limit Texas Hold'em, blinds/streets/showdown, 5% pot rake.

## 5. Interactive experience
Procedural Web Audio chip/card effects; Web Speech dealer voice; animated table projectiles (poop, dynamite, tomatoes, champagne, crown, rocket); cheers on wins.

## 6. NFTs
Phantom wallet integration; Metaplex verified-collection ownership checks; equip owned NFTs as avatars or throwing items.

## 7. Rakeback and HUD
Daily +10% base and weekly +15% base rakeback boosts with VIP staking percentage points. HUD: VPIP, PFR, 3-bet, Fold to 3-bet, WTSD, WSD. Export hand histories in PokerStars-compatible text format.

## 8. Security
Heuristic decision timing, cursor trajectory, IP/device clusters, chip-dumping patterns; account quarantine and Telegram/Twilio alerts. Require human review, privacy controls, and appeals for false positives.

## 9. Devnet
Source outlines Solana Devnet RPC setup, SPL token mint (9 decimals), token minting, `anchor build` and `anchor deploy --provider.cluster devnet`. Never run mint/deployment steps without environment isolation and explicit review.

## Implementation gates and cross-reference checklist
1. **Inventory** current repository tree, app build scripts, legacy Base44 dependencies, Supabase migrations, Edge Functions, and tests.
2. **P0: Financial correctness**: server-authoritative ledger, atomic settlement, idempotency keys, concurrency protection, balance constraints, audit trail, authenticated role checks, replay prevention, and refund/rollback policy.
3. **P0: Security**: RLS and least privilege, protected admin roles, secrets management, verified payment webhooks, abuse controls, independent test coverage.
4. **P0: Legal/product boundary**: evaluate sweepstakes promotional rules, geographic eligibility, age checks, AML/KYC obligations, licensing, and whether crypto wagering/staking must be a separate product. Do not assume sweepstakes and crypto real-money wagering are legally interchangeable.
5. **P1: Game engine**: deterministic server-side state machines, secure RNG, provable-fair design where appropriate, WebSocket event sequencing, reconnect/resume, table lifecycle, comprehensive rules tests.
6. **P1: Dual wallets**: maintain strict GC/SC separation and separately model any on-chain token assets. Do not allow cross-ledger mixing or client-authoritative balances.
7. **P2: Solana proof of concept**: Devnet-only wallet adapter, ATA listener, Anchor vault/staking prototype, invariant/property tests, external contract audit before mainnet.
8. **P2: UX**: table interactions, sound, dealer voice, NFTs, rakeback and HUD, privacy-safe analytics.
9. **Release gates**: CI build, integration/e2e tests, security review, migration validation, reconciliation tests, operational runbooks, regulatory sign-off.

### Known uncertainties
The source document describes desired functionality, not verified working code. No repository feature is marked complete without code inspection and tests. The excerpted staking state is not a complete deployable Anchor program. The source's staking/rakeback economics and real-money mechanics require independent financial, security, and legal assessment.

### Source references
- Original uploaded document: `solana_casino_platform_blueprint.docx`.
- Other NotebookLM references supplied in the project conversation should be indexed separately once their content is available for verification.
