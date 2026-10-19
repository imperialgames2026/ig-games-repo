# Backend migration follow-up — 2026-10-19

## Implemented and deployed to staging

- Wallet/admin HTTP handlers and atomic SQL operations now use canonical `user_roles`, including target-account protections and role changes before replay. Profile roles do not grant authority. Currency stays IGT; there is no token conversion.
- RLS admin helpers use canonical roles and account exclusion. The three public helpers are security invokers over a narrowly scoped internal lookup.
- Profile name saves, one-time public display names and avatar uploads now use dedicated Supabase operations. Display names are unique without regard to capitalization. The avatar bucket permits only owned image paths, has a 5 MB limit and allows JPEG/PNG/WebP/GIF. Testers cannot change names/photos, apart from their permitted initial display name. No identity documents are uploaded to this bucket.
- The profile screen no longer calls the unavailable Base44 upload integration or `updateUsername` function. Sonner notifications are mounted so saves and errors are visible.
- CoinFlip, Hash Dice, Limbo, Plinko and Wheel now have server-persisted practice rounds. Commitments hide seeds; reveals bind to one owner, game and client seed; retries preserve the original round. The browser independently verifies HMAC-SHA256-v3 proofs. Practice does not debit or credit monetary wallets, coins, tokens or prizes.
- Pending game requests survive a page reload and retry the same round. Server limits cap pending rounds and per-minute commitments.
- The route audit now correctly excludes `PlayerProfile` from game names. There are **44 game routes: 15 practice-backed and 29 blocked**. The previous total of 45 mistakenly counted Player Profile.
- Reviewed packaging now contains **87 recorded migrations and 27 functions**. `secure-wallet` and `admin-mutations` are version 3; `ig-originals-practice` is version 1. All three require JWT verification. Production has not been changed.

## Verification

- 93 offline Node tests pass, including independent Python-generated fairness vectors, forged identity/outcome denial, canonical-role checks, profile writes and uncertain-upload recovery.
- Three new transactional staging regressions pass and roll back all fixtures: wallet/admin authorization and conservation; profile/avatar access; five Originals games and unchanged monetary wallets.
- Nine authenticated HTTP test groups passed with five isolated disposable accounts: actual Auth login, RLS wallet isolation, transfers/retries, admin restrictions/exclusion, profile saves, real Storage upload/download/removal, IGN replay and Dice proofs, and existing practice table state.
- Five further authenticated game groups passed for Originals; a sixth check verified CORS headers and denial of raw seed-table access.
- These disposable accounts are not customer accounts. Account creation through trusted SQL fixtures tested password login; email signup/delivery itself was not exercised by these HTTP tests.
- Browser UI tests run separately with controlled API responses; they are not a claim of live multi-account browser E2E. The local browser connection was unavailable and the Chromium download failed. GitHub CI runs the new browser suite and retains failure traces.
- The Cloudflare Pages main build was inspected and contains the staging Supabase endpoint. The separate obsolete Worker check still references a nonexistent Worker.

## Remaining work

This follow-up does not complete full Base44 feature parity or a financial production launch. The remaining 29 game routes, legacy rewards/referrals/VIP/billing and other blocked business operations need dedicated replacements. Original slot engines have differing source paytables and settlement logic; they must be reconciled and tested before enabling those routes.

Custody, payments, KYC provider verification, deposits/withdrawals and real-value settlement require their actual provider integrations and credentials. Historical Base44 user/customer records have not been copied; no source export or authenticated source-data access is present in this session. Production schema reconciliation, a clean-install database replay and live browser E2E remain release gates. Existing leaked-password protection is disabled and the authenticated IGN simulation routine remains on the security-advisor review list.
