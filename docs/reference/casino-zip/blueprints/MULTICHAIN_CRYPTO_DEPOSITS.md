# Imperial Games — Multichain crypto deposit architecture (staging blueprint)

**Status: PLANNED / NOT ACCEPTING FUNDS.** This document records requested deposit methods, safety controls and implementation gates. The current GitHub integration branch and Supabase staging database deliberately contain no usable deposit address and no crediting function.

## Requested launch scope

| Network | Chain identifier / accounting family | Proposed assets | Initial state |
| --- | --- | --- | --- |
| Solana Mainnet | Solana | SOL, USDT, USDC SPL tokens | Disabled |
| Ethereum Mainnet | EVM chain ID 1 | ETH, USDT, USDC ERC-20 | Disabled |
| BNB Smart Chain | EVM chain ID 56 | BNB, USDT, USDC BEP-20 | Disabled |
| Arbitrum One | EVM chain ID 42161 | ETH, USDT, USDC ERC-20 | Disabled |
| OP Mainnet | EVM chain ID 10 | ETH, USDT, USDC ERC-20 | Disabled |
| Polygon PoS | EVM chain ID 137 | POL, USDT, USDC tokens | Disabled |
| Bitcoin | Bitcoin UTXO | BTC | Disabled |
| Litecoin | Litecoin UTXO | LTC | Disabled |
| XRP Ledger | XRPL | XRP | Disabled |
| Cardano | Cardano UTXO | ADA | Disabled |
| Monero | CryptoNote | XMR | Disabled |
| Zephyr Protocol | CryptoNote-derived | ZEPH | Disabled |

**All EVM networks** means a reviewed allowlist, not blindly enabling every EVM-compatible chain. Additional EVM networks require distinct verified chain IDs, RPC endpoints, contracts, replay protection and network-specific credit rules.

Token rows above are **proposals only**. Issuer-approved mint/contract addresses, token versions (native versus bridged), token decimal precision, proxy status and supported issuer/network combinations are not verified. A familiar ticker is NOT enough to credit an incoming transaction. Some combinations may have to be removed if authentic issuer support is missing.

## Implementation already staged

- `migration/legacy-overlay/src/lib/depositNetworks.js` lists these 12 networks and 24 candidate chain/asset entries. It enforces `DEPOSITS_ENABLED = false`.
- `supabase/migrations/20261017233000_crypto_deposit_network_catalog.sql` defines the 12-network catalog, 24 asset combinations, and private non-crediting observation records. Database CHECK constraints forbid enabling a network or asset and forbid an observation from becoming credited.
- The authenticated `crypto-deposit-preview-v1` Edge Function allows only **catalog** and **own observations** reads, enforces profile exclusion and canonical role membership, and returns no receiving addresses.
- The preserved original React frontend has a read-only `/DepositNetworks` staging preview. It cannot show a QR code, assign an address, accept a payment or change balances.
- Unit and authenticated staging checks must prove these safeguards are active. Production Cloudflare is unchanged.

## Required production architecture before ANY actual deposits

1. **Custody and compliance decision:** decide regulated crypto payment processor versus vetted self-custody. Obtain legal review of sweepstakes/gaming laws, payments, AML/sanctions obligations, age/identity checks and permitted jurisdictions. Implement withdrawal/source-of-funds controls consistent with that analysis.
2. **Asset registry and addresses:** verify *each* chain + token/mint and its exact decimals/issuer. Never derive an EVM contract by symbol. Maintain immutable asset IDs, production/testnet separation, approved recipient ownership and destination-tag mapping. Use HSM/MPC or external custodian for private keys—never browser secrets or GitHub secrets holding withdrawal keys.
3. **Attribution and watchers:** independently ingest, deduplicate and reconcile chain data from verified block explorers/nodes/provider webhooks. For EVM, inspect receipt status and individual Transfer logs by contract address, chain ID and log index, including native transfers. For Solana use transaction metadata and exact SPL mint, owner and associated token account. BTC/LTC/Cardano require distinct UTXO output accounting and spend/reorg handling. XRP may require a unique destination tag; missing/wrong tags must be held for review. Monero/Zephyr require secure view-only scanning/subaddresses and separate privacy/AML review.
4. **Finality and reversals:** set documented per-network confirmation/finality thresholds, chain reorganization handling, expired address rules, minimum amounts, dust treatment, chain outages and asset delist procedures. Never assume a bridge or L2 deposit finality is identical to L1 finality.
5. **Atomic credit pipeline:** verified observations enter an immutable raw-events table; server-only workers transition through observed -> confirmed -> reconciled -> credited. Credits require an idempotency key covering network, canonical transaction identity, output/log index and asset, protected by database unique constraints and an atomic double-entry ledger. A failed transaction, wrong contract, wrong tag, watch-only spoof, replay or reorg must never award funds.
6. **Operations and controls:** audit logs, alerting, liquidity/custody reconciliation, deposit limits, transaction risk screening, support escalation and emergency circuit breaker. Provide dashboards for pending/held/rejected and no unrestricted admin balance adjustments.
7. **Testing:** isolated chain-fork/testnet runs, token impersonation, RPC manipulation, webhook signature validation, missing tags, deposit replay, duplicate callbacks, concurrent credits, reorgs, failed receipts, fractional token precision, XMR scanning recovery and full end-to-end account separation. Commission independent financial security review.

The staged `crypto_deposit_observations` table is intentionally **not the final money ledger**. Its disabled `credit_status` and owner-read RLS demonstrate that no financial activity has been authorized. A later audited migration is required to enable funds.

## Decision needed before implementing receiving addresses

Choose **managed/regulated payment processor** (preferable for broad initial chain coverage) or **self-custody with separate chain indexers and key management**. We should not issue deposit addresses until that choice and the compliance/ledger requirements above are settled.

When the project is licensed/approved for its target jurisdictions, deployments must still remain separately reviewed for staging, production, and mainnet. A green application build alone does not authorize receipt of crypto assets.
