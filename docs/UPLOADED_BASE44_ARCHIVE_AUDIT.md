# Uploaded Base44 archive — source audit

Source: uploaded `ig-games (1).zip`; static review of extracted code. This report does not certify production readiness.

## Inventory

390 archive entries; 23 Base44 JSONC entity models; 61 backend functions; 79 React page modules. The source frontend uses `@base44/sdk` and `@base44/vite-plugin`.

## Critical migration gaps

- `sendWalletGift` debits and credits wallets in separate Base44 calls, with a third gift-record call. Replace with one idempotent database transaction.
- `generateDiceOutcome` uses `Math.random()`; `generateDiceOutcomeSSRCR` produces a cryptographic outcome but does not settle the bet against a wallet in that function.
- `create-checkout` accepts `packName`, `price`, `tokens`, and `cat_dollars` from the client. Resolve the product and price server-side.
- `wix-payments-webhook` updates wallet and transaction records separately; add verified payment event idempotency and atomic ledger credit.
- 51 of 61 functions reference `asServiceRole`; 11 reference `UserWallet.update`; 6 reference `Math.random`. These are audit flags, not proof of exploitation.
- Legacy currencies: `tokens`/IGC, `cat_dollars`/IGUSD, `igt_tokens`/IGT. Current Supabase columns: `cent_balance`, `igd_balance`, `igt_balance`. **Do not assume the mapping.** Validate before balance migration.
- The new `secure-wallet` Edge Function implements CENT transfers and a six-sided dice game. It does **not** yet implement the original 1–100 over/under dice rules or all original gift currencies. Do not claim feature parity.

## Migration coverage groups

| Group | Entities |
| --- | --- |
| Identity | User |
| Finance | UserWallet, Transaction, WalletGift, CryptoTransfer, IGTLedger |
| Game settings | OriginalGameSetting, SlotSetting |
| Claims | PrizeClaim, SweepstakesEntry |
| Rewards | VIPLevel, VIPBonus, Quest, UserQuest, Referral, RakebackPayout |
| Staking | StakingPool, StakingPosition, TokenConfig |
| Community | GlobalChat, SupportChat |
| Tournaments | WeeklyWager, WeeklyTournament |

## Release gates

1. Verify entity and UI parity with the integration branch.
2. Resolve currency semantics and wager rules.
3. Test concurrent settlement, insufficient balance, duplicate requests, rollbacks and ledger reconciliation.
4. Test exclusion, tester and admin authorization through direct APIs.
5. Sandbox-test Wix webhook authenticity, retries, forged events, mismatched amounts, refunds and chargebacks.
6. Verify build, lint, tests and staging integration before any merge into `main`.

No production data was modified as part of this source audit.
