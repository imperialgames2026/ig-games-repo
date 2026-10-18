# Imperial Games — Solana Devnet integration

## Scope
This is an **incomplete, paused Anchor program scaffold**, not a production staking contract. It is based on the uploaded `solana_casino_platform_blueprint.docx`.

### Blueprint parameters
- Solana SPL mint; separate staking and rake vaults, both controlled by pool PDA.
- Epoch duration defaults to 7200 seconds (two hours), configurable within 1–24 hours.
- Flexible / 1-day / 7-day / 30-day lock tiers: 1.00x / 1.25x / 1.50x / 2.00x.
- Reserve floor and pause circuit breaker.
- Future: stake/unstake, rewards snapshots, claims, vault transfers, on-chain audits, NFT integration, and deposit/withdrawal reconciliation.

### Local prerequisites
Install the Solana CLI, Rust toolchain, and Anchor CLI compatible with Anchor 0.31.1. Verify versions before running. Do not commit wallet keypairs.

### Before Devnet deployment
1. Replace placeholder `declare_id!` and `Anchor.toml` program IDs with a generated deployment keypair's public key.
2. Add verified staking vault creation, PDA ownership, token transfer and claim instructions.
3. Add access-control, time-lock, arithmetic, reserve floor, reward accounting, and replay tests.
4. Run `cargo test --manifest-path solana/programs/imperial_staking/Cargo.toml`, `anchor build`, and local-validator integration tests.
5. Obtain independent security review before any asset-bearing deployment.
6. Deploy to **Devnet only** using a secured signer; mainnet deployment is intentionally not automated.

### Architecture boundaries
The React frontend may connect a user's Solana wallet and subscribe to token account changes, but must not receive a custody private key or service-role secret. Supabase validates chain events and records settled deposits with unique transaction+instruction identity, finality, and reconciliation. Custody signing belongs in a dedicated signer boundary, not Supabase or the browser.

The existing `docs/ECONOMICS_AND_CUSTODY_ARCHITECTURE.md` specifies hourly rakeback; the uploaded Solana blueprint specifies two-hour staking epochs. Keep those schedules separately configurable until economics are approved.
