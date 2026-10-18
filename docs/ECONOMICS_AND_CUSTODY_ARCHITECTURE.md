# Imperial Games — Custody, Token Economics & Hourly Rakeback Architecture

## Purpose

This document records the target architecture for Imperial Games' custodial digital-asset system and native-token economics. It is a design target, not a promise that any token, yield, staking product, or reward program is legally or economically viable in every jurisdiction.

## Custodial model

Imperial Games will assign custodial deposit addresses to users and control the signing authority for those wallets. The web application must never hold private keys, seed phrases, API secrets, HSM credentials, or recovery material.

### Key-management principles

- Keep signing keys outside the application database and outside the React/Vite application.
- Never place seed phrases or private keys in Git, Supabase environment variables, browser storage, logs, analytics, or support tickets.
- Use an HSM, MPC/custody provider, or equivalent dedicated signing boundary for production funds.
- Maintain limited-fund hot-wallet infrastructure for routine withdrawals and separate cold/offline treasury reserves.
- Maintain offline recovery material using a documented, tested disaster-recovery procedure and appropriate physical controls.
- Require transaction policy checks before signing: asset, network, destination, amount, limits, risk state, and available hot-wallet liquidity.
- Log every custody operation without logging secret material.
- Build reconciliation so blockchain state can be compared with the internal ledger continuously.

## Asset and network model

Never identify an asset only by ticker. A supported asset is identified by a network plus an asset identifier.

Examples:

- BTC / Bitcoin
- ETH / Ethereum
- USDC / Ethereum
- USDC / Base
- USDC / Solana
- Imperial native token / Solana
- Imperial stablecoin / its supported network(s)

The schema must allow multiple networks and future Imperial-issued assets without redesigning the accounting layer.

## Deposit lifecycle

1. Assign a custodial deposit address for the user and asset/network pair.
2. Detect an incoming blockchain transaction using a node, indexer, or webhook provider.
3. Verify chain, asset contract/mint, destination, amount, transaction identity, and event semantics.
4. Wait for the configured confirmation/finality policy.
5. Handle reorgs and duplicate webhook/events safely.
6. Create exactly one internal ledger credit for the settled deposit.
7. Mark the blockchain transaction and deposit as reconciled.
8. Alert administrators when automated verification cannot safely resolve an event.

## Withdrawal lifecycle

1. User requests an amount and destination for a specific asset/network.
2. Server validates balance and policy; browser cannot directly change balances.
3. Funds are reserved atomically in the internal ledger.
4. Compliance/risk and withdrawal rules run.
5. A withdrawal intent is created with an idempotency key.
6. The custody signer authorizes and signs the transaction subject to policy.
7. The transaction is broadcast and tracked.
8. Confirmations/finality are monitored.
9. The internal ledger settles the reserved amount and fee treatment.
10. Exceptions enter an administrator review queue rather than silently retrying.

## Native Imperial token economics

The planned native token will be issued on Solana and can be used for gameplay incentives and the platform's planned reward mechanics. The exact supply, allocation, emissions, staking rules, fee percentages, buyback policy, burn policy, and launch design remain parameters to be finalized after economic, technical, tax, securities/commodities/gambling, money-transmission, consumer-protection, and other applicable legal review.

The architecture should support a configurable reward share rather than hard-code 2%.

### Hourly house-edge reward pool

For each completed reward interval:

`reward_pool = eligible_house_edge * configured_reward_share`

For an eligible staker:

`staker_reward = reward_pool * (staker_eligible_stake / total_eligible_stake)`

Example from the proposed model:

- Eligible house edge for one hour: $100,000
- Reward share: 2%
- Hourly reward pool: $2,000
- A user owns 3% of eligible staked supply
- User's gross share: $60

If the reward share were later configured to 10%, the same $100,000 eligible house edge would produce a $10,000 reward pool instead. The percentage is therefore a governance/configuration parameter, not a schema constant.

### Important accounting distinction

House edge, gross gaming revenue, net gaming revenue, fees, promotional credits, and distributable reward revenue must be modeled separately. Only a specifically defined and auditable revenue base should feed the reward calculation. The reward engine must never infer house edge from client-reported results.

### Hourly settlement

Rewards should be generated from immutable, server-authoritative gaming and financial records. The hourly job should:

1. Close the interval.
2. Calculate eligible house edge using settled game/ledger records.
3. Calculate the configured reward pool.
4. Snapshot eligible stakers and total eligible stake at the interval boundary.
5. Calculate each user's proportional entitlement using fixed-precision integer/token accounting.
6. Create reward ledger entries idempotently.
7. Update claimable/staked accounting atomically.
8. Emit an auditable reward-distribution record.
9. Reconcile totals: sum(user rewards) must equal the distributable pool after explicitly documented rounding/dust rules.
10. Alert on discrepancies rather than silently correcting them.

The platform should use integer base units and deterministic rounding; it should not use JavaScript floating-point arithmetic for monetary or token settlement.

## Staking model

The eventual staking system should distinguish:

- wallet token balance
- staked token balance
- reward-eligible staked balance
- pending/claimable rewards
- unstaking request
- unstaking cooldown
- early-unstaking penalty, if legally and economically approved
- reward-distribution snapshots

The early-unstaking penalty must be configurable and should not be presented as guaranteed appreciation or guaranteed yield.

## Buybacks and token burns

Buybacks, treasury operations, and burns should be separate audited transaction types. They must not be treated as automatic mechanisms that guarantee token appreciation. Any eventual implementation should define:

- funding source
- authorization policy
- maximum/minimum limits
- cadence
- exchange/venue rules
- custody controls
- accounting treatment
- disclosure and audit trail
- emergency pause behavior

## Automation and human oversight

Normal deterministic operations should be automated. Humans should handle exceptions and governance.

Automated:

- blockchain monitoring
- confirmation tracking
- deposit crediting
- withdrawal lifecycle tracking
- ledger reconciliation
- hourly reward calculation
- routine alerts
- balance/liquidity monitoring

Human review:

- custody/security incidents
- suspicious or anomalous withdrawals
- failed reconciliation
- chain reorganizations beyond policy limits
- disputed gaming outcomes
- manual treasury movements
- parameter/governance changes
- emergency pauses

## Core invariants

- A browser cannot mint, credit, or debit value.
- Every value movement has an immutable ledger record.
- Every external blockchain transaction has a unique internal identity.
- Deposit processing is idempotent.
- Withdrawal processing is idempotent.
- Reward distribution is idempotent.
- Game settlement is authoritative and server-side.
- Custody secrets are outside the application runtime.
- Internal balances are reconciled against blockchain balances.
- Administrative actions are audited.
- Reward parameters are versioned so historical distributions remain reproducible.

## Regulatory and economic gate

Before launching a real-money custodial system, native token, stablecoin, staking/reward program, buybacks, burns, or crypto-enabled gambling in production, Imperial Games should obtain qualified legal/compliance advice for every jurisdiction in which the service will operate. Technical architecture should preserve the ability to restrict assets, games, rewards, withdrawals, and users by jurisdiction and risk state.
