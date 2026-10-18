# Imperial Games — AI-assisted Crypto Operations Blueprint (not activated)

## Deployment and legality gate
Real deposits, real-value balances, wagers, prizes, rake, withdrawals and crypto signing remain DISABLED. A GitHub merge does not deploy a site or authorize financial transactions. Before activation: verify legal entitlement in every customer jurisdiction, custody/provider authorization, age/KYC/geo/AML/sanctions obligations, consumer protection, and third-party security review.

## Customer accounts versus blockchain wallets
Maintain an immutable internal balance ledger per player, token and network; a unique blockchain deposit address or tag is a receiving identifier, NOT a separately spendable user-owned wallet account.
- Map player + chain ID + asset/native/token contract to custody provider address/account ID and any memo/tag.
- Generate receiving identifiers with authorized custody MPC/HSM API; never in web browsers or by AI.
- Keep precise network/token IDs, not just symbols (USDT on Ethereum, Solana and Tron are different).
- XRP and some networks use destination tags/memos; UTXO chains support multiple addresses; many EVM tokens require gas top-up for sweeping.
- Never store plaintext private keys. Existing air-gapped Ellipal can serve treasury cold storage, with manual audited transfers, only after interoperability tests.

## Privilege separation
- Customer support AI reads permitted account and ticket context, answers FAQs, cannot mutate financial entries.
- Deposit AI triages alerts and unmatched transfers, cannot credit balances.
- Withdrawal AI recommends holds or approvals, cannot adjust thresholds, sign or transfer.
- Deterministic AML/KYC/risk rules engine verifies age, eligibility, jurisdiction, sanctions, KYT, velocity, source of funds, chain confirmations, balance and withdrawal destination.
- Distinct custody signer/MPC policy verifies authorization; signing material is out of reach of AI, web frontend, and Supabase functions.
- Withdrawals >= $2,500 USD equivalent require Superadmin approval; under $2,500 may pass automatically only after every required check. Enforce rolling aggregate thresholds. A Superadmin cannot override mandatory compliance holds.
- Keep immutable audit records for changed policy, human reviews, agent recommendations and custody approvals.

## Deposit lifecycle
assign address -> observe transfer -> confirm finality -> screen -> reconcile -> credit (or hold).
- Verify signed provider webhooks and independently reconcile chain status.
- Idempotency per chain + tx hash + output or event index + receiving account.
- Use serializable/locked accounting transaction linking unique deposit event to balanced debit/credit journal; never credit based solely on AI text or webhook.
- Hold on reorg, missing tag, unsupported chain, suspicious origin, unsupported asset, stale quote or inadequate finality.
- Sweep only under separate approved custody policy and maintain obligations/reserves.

## Withdrawal lifecycle
request -> reserve balance -> screen -> policy and approval -> custody signing -> broadcast -> finality -> settle.
- Screen every withdrawal at every amount, maintain rolling aggregate and account-risk limits, ensure replay protection and nonce/UTXO locks.
- Changes to destination or amount invalidate prior approval; log full risk decision and quote source/timestamp.
- Withdrawals remain halted when market pricing is missing/stale, sanctions/risk unknown, treasury unreconciled, signer compromised or provider errors.
- Maintain a ledger of user liabilities independent of hot/cold treasury balances; reconcile daily.

## Providers to evaluate
Fireblocks and BitGo provide enterprise wallets, receiving address workflows and custody controls. Obtain written confirmation that a legally licensed poker/gaming business is accepted, and an asset/network support matrix for BTC, LTC, ETH, Solana, EVM networks, XRP memo, and any XMR/ZEPH support. Chainalysis KYT can monitor origin/destination risk. Verify all contractual/regulatory rules before any use.
- https://fireblocks.readme.io/docs/manage-deposits-at-scale
- https://developers.bitgo.com/docs/wallet-types
- https://developers.bitgo.com/docs/wallets-create-addresses
- https://www.chainalysis.com/product/kyt/
- https://www.fincen.gov/resources/statutes-regulations/guidance/frequently-asked-questions-casino-recordkeeping-reporting

## Release criteria
1. Written legal and provider approvals by jurisdiction.
2. Independent fairness and tournament hand-history audit.
3. Security testing: double-credit, webhook replay, reorg, race, account compromise, multi-account fraud and sanctions block.
4. Controlled custody operations, key recovery drill, capped hot treasury, air-gapped transfer procedures.
5. Fully synthetic staging deposit/withdrawal tests with nonredeemable balances.
6. Separate explicitly approved production switch only after the above gates.
