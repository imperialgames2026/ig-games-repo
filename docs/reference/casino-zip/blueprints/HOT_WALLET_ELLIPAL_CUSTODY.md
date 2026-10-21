# Imperial Games operating custody — HOT Wallet app + ELLIPAL cold reserve

**Proposal recorded 2026-10-17; staging-only, no real funds.**

## User-selected wallets

- **HOT Wallet (HOT Labs)** is the proposed dedicated *operating* hot-wallet application/account. Official wallet information: https://hot-labs.org/wallet/ . Official developer documentation: https://docs.hotdao.ai/hot-kit .
- **ELLIPAL** is the owner's physical, air-gapped cold-storage wallet. It holds the bulk reserve offline and is not an automated payout signer.
- Users of the Imperial Games site receive individual **pending deposit attribution slots** per blockchain. These are NOT individual HOT Wallet app logins or ELLIPAL key accounts. The site will assign verified addresses, subaddresses or XRP address+tag routes only once an authorized custody integration can provision them.

## Why app support is not the same as merchant payment infrastructure

HOT Wallet advertises assets across many blockchains and supports user-initiated signing, swaps, bridges and dApp connectivity. This does NOT establish that a normal HOT Wallet account can:
- sign unattended server-originated withdrawals safely;
- enforce a durable, server-side $2,500 Superadmin policy and rolling limits;
- derive or own uniquely attributed user deposit addresses for every requested chain;
- provide reconciliation webhooks and immutable transaction IDs;
- support Monero / Zephyr / Cardano / XRP in every merchant API, rather than in the consumer wallet UI.

HOT Labs also offers **HOT Pay** (https://hot-labs.org/pay/) for merchant payment requests and separate **HOT Protocol MPC/API** capabilities (https://docs.hotdao.ai/mpc-wallet/signature-generation-via-mpc). These are *evaluation candidates*, not verified approvals or automatic substitutes for HOT Wallet. HOT Pay's advertised support must be checked against required chains, token contracts, individual account address attribution and business-use policies. Do not use a consumer-wallet browser extension, seed phrase or unattended desktop automation as a pseudo-server payout signer.

## Staging separation and controls

| Account | Role | Automated access | Real transfers |
| --- | --- | --- | --- |
| HOT Wallet operating account | Proposed bounded hot payout liquidity | **No confirmed enterprise signing API or policy integration** | Disabled |
| ELLIPAL offline reserve | Bulk treasury holding; discretionary offline top-ups | Never; sign physically/offline | Disabled |
| Player pending deposit routes | One account-specific route per network | No address provisioner integrated | Disabled |

Database: `crypto_treasury_accounts` lists the proposed HOT Wallet operating account and ELLIPAL cold reserve. `crypto_treasury_integration_readiness` documents unverified business/payout capabilities with all approval flags false. `user_crypto_deposit_destinations` provides pending user/network routes with all addresses and tags null.

Staging withdrawal policy: **$2,500 USD equivalent or above requires Superadmin review**, including sub-threshold withdrawals that collectively trigger the 24-hour or 7-day rolling limits. Every withdrawal requires screening regardless of size; even eligible automated candidates still require independent custody authorization. Actual funds release remains disabled.

## Secure activation checklist

1. Verify the *exact HOT Wallet/HOT Pay/MPC product* has a documented, contractually permitted business payout interface and that gaming/sweepstakes use is allowed in relevant jurisdictions.
2. Verify network-by-network native asset and token-mint support, including EVM chain IDs, USDT/USDC variants, XRP destination tags, Monero/Zephyr address monitoring and Cardano account attribution. The marketing claim of broad support is not proof of suitability.
3. Implement a server-only signing policy tied to a cryptographic digest of the final transaction (destination, network, token contract, nonce, full precision amount). Superadmin cannot edit an approved transaction after signing-policy validation.
4. Apply separate treasury sweeps and top-ups: cold reserve to HOT Wallet is a deliberate air-gapped ELLIPAL signing ceremony with a second-person verification step; HOT Wallet to cold reserve requires verified allowlisted recipient data. No keys, signatures or addresses committed to GitHub.
5. Complete compliance/legal clearance, immutable double-entry ledger, confirmations and reorg recovery, independent custody security assessment, audit logs, rate limits, and reconciliation tests.
6. Only then design separately reviewed production migrations that remove the hard-coded disabled CHECK constraints and enable specific verified networks one at a time.

**Never ask for or share any seed phrase, ELLIPAL backup material, HOT Wallet recovery phrase or private signing key in this repository or chat.**
