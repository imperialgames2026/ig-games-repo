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

The complete isolated validation passed on commit `641f735`: 80 offline tests, all 85 migration replays, eight transactional SQL suites, 26 desktop/mobile public browser checks and 13 authenticated checks, including two-player game services and password recovery. See [the successful run](https://github.com/imperialgames2026/ig-games-repo/actions/runs/39322241882). Two additional deployment-guard tests cover history drift, SQL integrity and transactional migration recording.

Production builds include the existing client-safe practice project URL and publishable key in `.env.production`. Explicit hosting environment variables take precedence; local test mode uses its own generated connection. No service-role key or privileged token belongs in frontend configuration. The original brand asset and the web app manifest are bundled locally.

The manual deployment workflow uses the existing `SUPABASE_ACCESS_TOKEN` through Supabase's documented management API and CLI. It compares every hosted migration against the reviewed SQL, rejects unknown or missing recorded history, and applies only explicitly pending migrations together with their original version records in a transaction. It deploys only functions marked pending and adds the primary website `https://imperialgaming.llc` and its confirmation/recovery destinations while preserving existing redirect entries, fallback Vercel destinations and other Auth settings. A database password is unnecessary for this path. A read-only manual run (`deploy_staging=false`) checks reconciliation without changing the project.

Hosted rollout is currently blocked: [the read-only deployment check](https://github.com/imperialgames2026/ig-games-repo/actions/runs/39323486372) received HTTP 401 from Supabase using the existing Actions token. Replace `SUPABASE_ACCESS_TOKEN` in this repository's Actions secrets or `staging` environment; never place it in frontend variables. No hosted migrations or Auth settings were changed. Public checks confirm Auth/email signup is enabled, the current poker endpoint lacks `x-client-info` in CORS and `ig-payment-requests` is not deployed (404). Branch previews build on both hosts but require hosting-account sign-in. The owner confirmed `imperialgaming.llc` as the current website; the earlier HTTP 402 observation was for a retired hostname and is not evidence about this site. Canonical metadata, social links, policy website references and pending Auth deployment settings now use `imperialgaming.llc`.
