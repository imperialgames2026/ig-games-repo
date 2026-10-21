# IGN Treasury + Branded Dashboard — Implementation Design
**Status:** Design specification, not deployed. Written 2026-10-17.
**Dependency:** [Approved working token allocation](./IGN_TOKENOMICS_BENCHMARKS_PROPOSAL.md).
**Repository branch:** `integration/app-scaffold-audit`. Do not merge into `main` before the staging gates pass.

## A. Immutable design baseline and network warning

- Network: **Solana Devnet only**. Mint: `CQpbojFzQJfcEjXJYRHSg4bnTheGKDJtEgPxQZLdivvz`; Token program `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`; decimals **9**.
- Supply reported in owner's on-chain CLI: `10000000000000000000` atomic units = **10,000,000,000 IGN**. Mint authority **none**; freeze authority **none**. Verification of remote mainnet or circulating supply has *not* been performed by this documentation change.
- Metaplex metadata PDA: `AwunVJkw7XnhGXtKWjHCBD9vJE2wJcRuBSNjZ7a6GQSF`; public JSON `https://gateway.pinata.cloud/ipfs/bafkreihf7evpmwrr6khqw6u5nobws7ekveivmyjirqd65rrct6r7uz6fle`. The JSON image currently references `ipfs.io`; clients should implement gateway fallbacks if needed.
- **Critical:** supply locking via revoked mint authority does not lock owned tokens against transfer. Distribution, custody, vesting, and escrow remain separate work. Never label all 10B Devnet tokens as circulating or assign fictitious wallet balances to buckets.
- Mainnet launch requires a **different mint**, separate verification and separate approvals. Do not auto-map the Devnet mint to a Mainnet wallet.

## B. Approved working 10B allocation (design accounting; no disbursement)

| Bucket key | Approved share | Units (IGN) | Initial balance shown in UI |
| --- | ---: | ---: | --- |
| COMMUNITY | 25% | 2,500,000,000 | `Unallocated on chain` |
| LIQUIDITY | 20% | 2,000,000,000 | `Unallocated on chain` |
| BUILD_SECURITY | 20% | 2,000,000,000 | `Unallocated on chain` |
| TREASURY | 15% | 1,500,000,000 | `Unallocated on chain` |
| TEAM | 10% | 1,000,000,000 | `Unallocated on chain` |
| PARTNERS | 5% | 500,000,000 | `Unallocated on chain` |
| EMERGENCY | 5% | 500,000,000 | `Unallocated on chain` |
| TOTAL | 100% | 10,000,000,000 | `Token in existing holder ATA(s); bucket transfers not confirmed` |

All percentages approved as working budget structure only. Specific addresses, beneficiaries, vesting and signers remain **TBD**; system must not invent them or imply balances exist.

## C. Treasury wallet architecture (recommended, not created)

```text
Founder-held IGN Devnet ATA (current on-chain holder; query, do not guess)
                           |
                 propose allocation only
                           |
                 MULTISIG SAFE / GOVERNANCE
               (TBD independent human signers)
                    /   |    |     \
                   /    |    |      \
             Reserve   Grants Liquidity Emergency
                       |       |          |
                     Claims  Provider   Break-glass
              ---------+
              Vested team/partner escrow (TBD verified program)
```

**Separation of responsibilities:**

1. **Current holder ATA:** derive using mint + verified owner address; inspect chain balance. It is the present custody point until owner-approved movements occur; do not call it a multisig.
2. **Governance treasury:** hardware-backed independent signers, preferably **3-of-5**, with two signers outside daily app operations; choose a reviewed Solana multisig provider or correctly configured native Token multisig, noting these products have different control surfaces. Require a rehearsed recovery plan. No signer secrets in SQL, GitHub, frontend or Edge Functions.
3. **Community program wallet:** capped distribution ledger, approval workflow and sybil-resistant eligibility. No wagering/deposit prerequisites during practice testing.
4. **Liquidity reserve:** segregated, strictly labeled **reserved rather than supplied to markets** until exchange/listing/legal approval. Financial reporting must not count locked reserve as circulating tokens without an explicit methodology.
5. **Development/security:** per-grant budgets, release approvals, monthly reconciliation and security incident freezes at application/disbursement level (not via the revoked token freeze authority).
6. **Company treasury:** holds unused discretionary reserves; a 48-hour timelock above a defined threshold is a future product requirement, not a currently deployed control.
7. **Team vesting:** proposal only: 12-month cliff plus 36 months linear unlock after an owner-defined launch anchor. Requires contract/escrow verification, no hidden unlocked founder allocations.
8. **Partners:** milestone and deliverable approvals; sanctions and beneficial ownership screening before any Mainnet allocation.
9. **Emergency:** dual-control, documented incident criteria, public post-incident reconciliation. Never an unaudited discretionary fund.

### Move tokens only after separate authorization

Every token movement requires recorded `who/why/which mint/which network/amount/destination`, simulation, verified public key, multisig approvals, transaction signature, confirmation/finality, and post-transaction ledger reconciliation. Read-only UI in phase 1. No unsigned raw transfer requests originating from a browser; no server-held personal keypairs.

### Treasury inventory and accounting model

- An `allocation_plan` stores design-budget **amounts** per category, with version and approved_at; it is **not** a token balance.
- `treasury_wallets` contains chain, network, public address, purpose, controller type, verification status and optional owner label; never secrets.
- `treasury_positions` records reconciled token accounts + slot + observed atomic balances from chain. Do not infer balance from a percentage.
- `proposals` and `approvals`: durable, auditable read-only previews until transfers are enabled in a separately reviewed release.
- `disbursement_history` links confirmed signatures and memo hash to each approved budget release; idempotent to signature + instruction index.
- Track **nominal approved**, **planned**, **escrowed**, **released**, **locked**, **circulating** and **unknown** as different concepts. Do not calculate market cap or ROI from Devnet.
- Use 64-bit-safe integer strings or `bigint` for raw SPL balances. Raw supply `10^19` exceeds JavaScript Number's exact integer range; do **not** parse into `number` or use `number * 1e9` for transfers or financial displays. Format with bigint/string decimal functions.
- Transaction finality matters: a successful API response is not sufficient evidence of completed transfer. Record `processed/confirmed/finalized` separately.

## D. Role and read-policy matrix

| Operation | Public | Player | Read-only tester | Admin | Superadmin |
| --- | --- | --- | --- | --- | --- |
| Read token facts and published distribution | Yes | Yes | Yes | Yes | Yes |
| Read treasury addresses already published | Yes | Yes | Yes | Yes | Yes |
| Read private internal allocation plans | No | No | As explicitly granted | Yes, masked | Yes |
| Create/edit proposed budget draft | No | No | No | Maybe with explicit authorization | Yes |
| Approve actual token transfer | No | No | No | No | Not alone; requires separate multisig |
| View private transfer audit trail | No | No | Test-only | Yes, masked | Yes |

**Supabase constraints:** enforce superadmin with server-side `public.user_roles` only after explicit owner assignment, RLS on all treasury tables, and a denial-by-default role lookup. Client UI hiding an action is not authorization. Never use `profiles.role` if the current canonical roles mechanism is `public.user_roles` without reconciling the migrations. Create no role grants in this design phase.

## E. Dashboard: IGN Royal Treasury (dark / gold / pink)

**Brand assets:** original IGN feline logo with **exactly seven gold crown points**, supplied PNG on Pinata; never use a competitor's logo. Palette proposal: `#0B0E16` charcoal, `#D9B35B` antique gold, `#F54EAC` imperial pink, `#EFF2F8` ivory text. Check contrast and show text labels in addition to colors.

**Page 1: Player Wallet — IGN (Devnet):**

```text
[7-point Crown / IGN] Imperial Games Network             [DEVNET · TEST]
IGN balance [connect wallet]        [View on Solana Explorer]
Mint: CQpbojF...Ldivvz           Token: Solana SPL / 9 decimals
[Connect Phantom / compatible wallet] [Copy mint]
IGD (in-app) | IGT (legacy) | Practice chips (nonredeemable)  <separate>
Notice: IGN on Devnet has no independently established market price.
```

No 'Buy', 'Sell', 'Cash Out', on-chain staking, deposit-to-play or automated game debits on staging. Never request wallet seed phrase.

**Page 2: Superadmin — Royal Treasury (read-only v1):**

```text
IMPERIAL GAMES NETWORK   | Royal Treasury                       [DEVNET]
[ Total supply: 10,000,000,000 IGN ] [ Minting: REVOKED ] [ Freeze: NONE ]
[ Circulating: NOT ESTABLISHED ]     [ Wallets reconciled: 0/TBD ]
---------------------------------------------------------------------------
[ 7-category allocation chart ]   [ Approved working budget totals ]
Community 25% | Liquidity 20% | Build 20% | Treasury 15% | Team 10%...
---------------------------------------------------------------------------
Wallet registry: [purpose] [address] [observed balance] [slot] [verified]
Vesting calendar: [DRAFT / NOT CONTRACT-ENFORCED]
Transfer proposal queue: [DESIGN ONLY — actions disabled]
Audit / reconciliation feed: [slot] [signature] [status] [diff]
```

UI should never confuse the **10B minted token supply** with **10B distributed** or **10B circulating**. No treasury card should display a fictional fiat equivalent.

**Page 3: Governance + disclosures:** method of circulating supply, category budgets, public token explorers, published contract audits when available, risk labels and approved changelog. Work from separately approved facts.

## F. Recommended code boundaries for current React/Vite + Supabase build

```text
src/lib/ign/asset-registry.ts          # explicit devnet/network mint, metadata, 9 decimals
src/lib/ign/format-token-units.ts      # bigint safe formatting
src/components/IGNWalletPanel.tsx     # devnet read-only connected wallet screen
src/components/IGNAllocationChart.tsx # nominal approved budget chart (not live balances)
src/components/IGNTreasuryPanel.tsx   # role-checked read-only treasury admin screen
supabase/migrations/*ign_treasury*.sql # later, after schema audit, RLS + audit tables
supabase/functions/ign-*.ts           # later, server-side auth and token reads only
tests/ign-tokenomics.test.ts          # % sum 100; amount sum 10B; integer formatting
tests/ign-treasury-access.test.ts     # role matrix; impersonation/denial testing
```

The existing app has a single `src/App.tsx` page-navigation type (`Lobby | Games | Wallet | Account | Admin`). Integrate IGN Wallet into `Wallet` and read-only Treasury into `Admin`, gated on verified superadmin role; do not replace the existing account or Supabase session flow. Current code in the integration branch remains practice-only.

## G. Acceptance tests / rollout gates

1. Unit test category weights sum to 100% and exact atomic values sum to `10000000000000000000`; no floating-point accounting.
2. Wallet disconnected, wrong network, absent ATA, 0 balance, public RPC rate limit and revoked mint/freeze states all render correctly.
3. Test browser cannot change allocation/treasury records; user cannot impersonate admin via client-provided role.
4. Wallet link signature challenge includes origin, user, nonce, timestamp, expiry and network domain; nonce is single-use and wallet signature verification is server-side.
5. Staging accounts show only **Devnet** and never use Mainnet send calls; no secret keys in bundle, environment examples, analytics or logs.
6. Treasury inventory requires confirmed/finalized evidence for observed balances; discrepancies produce audit alerts, not silent overwrites.
7. 10s Poker timer, +30s staging timebank and practice chip invariants remain unchanged. **No paid or IGN-financed timebank** is activated.
8. Typecheck, Vitest, build and authenticated browser E2E pass. Update `docs/audits/supabase-migration-status.md` accurately. Independent security, legal and financial review precedes any real-value release.

## H. Pending explicit decisions

- Appoint independent custodial signers and decide on the multisig provider, transfer thresholds and rescue procedure.
- Approve vesting timeline, starting event, recipients, contract/provider and initial unlocked amount; no cliff is effective until programmed.
- Approve whether 2h staking/rake revenue, IGD convertibility and future IGN poker timebank should ever be considered; these remain disabled.
- Approve Mainnet network mint deployment only after the security, regulatory and economic assessments.

**Decision note:** User approved the **working allocation** in chat on 2026-10-17. This document does **not** imply authorization for executing on-chain transactions, deploying privileged code, or transferring Devnet or Mainnet token supply.
