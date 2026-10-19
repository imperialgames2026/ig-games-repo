# Practice release validation

This change builds on main's consolidated integration and checksum-verified backend manifest. The 84 recorded staging migrations remain byte-for-byte unchanged. One pending migration and the authenticated `ig-payment-requests` function are added to the reviewed package; neither is claimed deployed.

The player surfaces now use dedicated Supabase operations for profile/display-name settings, transaction history, provable dice history, support links and self-exclusion. Password reset requests and recovery complete through Supabase Auth. A missing session is a signed-out state; other identity failures still deny access. Existing canonical-role authorization is preserved.

`Payments`, `Withdraw` and `CryptoWallet` support preparation requests, history and cancellation. Requests are owner-scoped, bind replay keys to the full payload, validate asset/network combinations and remain `awaiting_provider`. They never reserve, debit, credit or send funds. Provider address validation, charges, custody signing and payouts remain disabled. The existing deposit-network readiness catalog is linked from this page.

Local and CI commands:

- `npm test`: offline tests, excluding credential-dependent wallet/transfer suites.
- `npm run build`: production build with approved public Supabase configuration.
- `npm run test:e2e`: desktop/mobile public lobby and authorization checks, two workers.
- `npm run test:database`: eight rollback-only SQL suites against the isolated local Supabase container. Never points at a hosted database.
- `npm run test:auth`: local-only authenticated profile, support, dice and payment preparation browser tests.

The `Practice release integration validation` workflow assembles the reviewed backend, starts a disposable Supabase instance, replays the real recorded migration history, runs SQL tests and browser checks, then stops it. Public test configuration is generated in ignored `.env.test.local`; local service credentials are kept in `/tmp` and never uploaded as artifacts.

The root `supabase/migrations/` directory remains historical reference material. Use `scripts/prepare-reviewed-backend.mjs` for deployment. Reconcile hosted migration history before applying pending changes. CI and packaging success do not establish hosted rollout, live payment readiness, complete parity for archived blocked games, or Android distribution.

Type checking now targets the actual repository paths and exposes inherited JavaScript typing errors in the old UI. It is still a failing check; no assertions or type checks were disabled to hide it.
