# IGN staging security check — 2026-10-17

## Scope
React read-only IGN Wallet and Royal Treasury, Supabase staging permissions, four tester accounts, one-time player name, staged Sumsub KYC. Review performed on integration/app-scaffold-audit, not main.

## Verified in staging database
- All four registered tester accounts returned the `tester` role through their own authenticated RLS context; each could read only its own `public.user_roles` row.
- None of the four tester contexts returned true from `public.is_admin()` or `public.is_superadmin()`.
- One-time name setup permitted a previously blank `display_name`, trimmed input, and blocked subsequent self-service name changes.
- A tester was denied attempts to modify `full_name` or update `user_roles`. All simulated mutations used ROLLBACK.
- Main poker action/settlement RPC functions and the `secure_wallet_operation` RPC are not executable by `authenticated` or `anon` database roles.
- `public.kyc_verifications` has RLS with owner-only read, no authenticated write policy.
- The production-like game backend has other mutation surfaces and has not received a complete independent security review.

## Code and deployed endpoint source verified; authenticated HTTP E2E still pending
- Deployed `poker-events-v1` (v4), `poker-table-v1` (v8), and `provably-fair-v2` (v3) to staging; compared their deployed source with GitHub and confirmed exact matches. All require JWTs, deny tester mutations, and fail closed on missing or excluded profiles. Authenticated HTTP end-to-end requests are still pending.
- Added regression assertions in `tests/ign-readonly-endpoints.test.js` for role checks and profile exclusion before mutation points; these are source-level checks and still require a successful Vitest run.
- Existing `src/lib/ign/` unit tests cover BigInt precision, selected Devnet RPC responses and Superadmin role checks, but a passing current CI run is not available.
- No authenticated browser E2E, Phantom extension test, live Devnet RPC browser access test, or provider Sumsub sandbox end-to-end evidence has been obtained.
- GitHub connector reports no visible CI status/check results on reviewed commits. The CI workflow now includes both staging scaffold and preserved `ig-games.zip` legacy-app builds. Manually dispatched authenticated staging smoke tests require explicit opt-in; no passing build has been confirmed.

## KYC gate
- Sumsub chosen for ID and selfie/liveness. Frontend feature flags default off; no real collection until verified provider configuration.
- The drafted Sumsub webhook needs verified applicant-session binding, vendor event-format validation, replay/idempotency and evidence that required document + liveness steps passed. Never trust a single unverified field to issue `verified`.
- Phone SMS remains disabled until Supabase Auth SMS provider configured.
- Do not expose sensitive identity documents in application SQL, GitHub, or support chats.

## Cloudflare decision
- No Cloudflare Worker is required for current Sumsub or authenticated gameplay. Supabase Edge Functions remain the single server implementation.
- Consider Cloudflare Pages for React static frontend, WAF/Turnstile/rate limiting for public abuse, and only later a Worker for centralized Devnet RPC throttling/caching if browser RPC rate limits justify it.
- Web edge protection is not a replacement for RLS, Auth or game settlement validation.

## Blockers before main merge
1. Verify current CI and resolve any TypeScript/build/test failures.
2. Perform authenticated HTTP calls against already-deployed staging Edge Functions for Tester, Admin, Superadmin and excluded-account cases; no actual user test credentials are stored in this repository.
3. Authenticated tester/Admin/Superadmin browser and HTTP scenarios.
4. Verify Sumsub provider webhook handshake in sandbox before enabling flags.
5. Independent review for financial/game settlement and legal controls.

## Supabase security advisor and current integration warning
- After the `20261017210000_lock_timestamp_function_search_paths.sql` migration, the two mutable function search-path warnings disappeared from the latest security advisor output.
- Service-only Poker/audit tables with RLS enabled and no client policies are intentionally closed, not inadvertently exposed; do not add broad policies merely to clear informational notices.
- Three role-check SECURITY DEFINER helpers are currently externally callable by authenticated clients; they report the caller's own authorization and are used in RLS. This is an intentional surface needing periodic review.
- **Leaked-password protection is disabled** in Supabase Auth settings. This must be enabled by a project administrator if the project plan supports it: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- The original app contains 390 archive entries and many Base44 dependencies. This PR does not yet restore its complete UI/backend. Keep it draft until legacy migration and real builds pass.
