# Base44 admin user directory → Supabase (staging tranche)

**Status:** Review-only; no production deployment, client-role modification or financial activation.

## Replaced
- The original `original-app/src/pages/AdminUsers.jsx` is retained as an archival reference, but `/AdminUsers` now routes to `VerifiedAdminUsers.jsx` before the legacy route fallback.
- The canonical backend is `ig-admin-users-preview-v1`. It validates a real nonanonymous `auth.getUser()` session, the account's `profiles.is_excluded = false`, and the canonical `public.user_roles.role = 'superadmin'`.
- The service uses a server-held service-role credential only after permission checks and refuses execution outside `imperial-games-staging`.
- Strict `{action:'list',page:<integer>}` requests only, 25 results per page and a maximum 40 pages. No client-supplied role or target user ID.
- Response fields: profile UUID, opt-in display name, profile creation timestamp, exclusion flag and canonical role. No emails, addresses, phone numbers, KYC files, finance records, keys or balances.
- The React view and navigation are read-only. Approving KYC, making account changes, suspending accounts, changing roles, payouts and all legacy admin commands are intentionally unavailable.

## Safety / verification
- `tests/base44-admin-users-migration.test.js` checks the restricted source contract and gate.
- `.github/workflows/base44-admin-users-preview.yml` builds root and original frontend and runs tests on the feature branch.
- **Before deploying:** require green CI and verify `verify_jwt=true` on the staging Edge Function.
- **Before allowing broader access:** test with (a) Superadmin positive JWT, (b) Admin JWT, (c) Tester JWT, (d) anonymous request, (e) excluded Superadmin, and (f) invalid page. Non-Superadmin should see 403; anonymous/missing JWT should see 401. Do not log secrets.
- This implementation is not an import or synchronization of Base44 historic user records; migration of user data must separately validate provenance and duplication policies.

## Still blocked
Historic Base44 functions and entity definitions outside this surface; original financial settlement, rewards, referrals, KYC provider workflows, withdrawals, account modifications, and game releases. Separate Crash/Trenball, Craps, Poker and other game branches need reconciliation and multi-session testing.

**Do not merge into main or expose on a public domain without authenticated E2E, independent authorization/privacy review and explicit release approval.**

## Verified staging milestone — 2026-10-19 UTC
- GitHub Actions full root tests/types/build and original-app build succeeded on commit `4259493be17d` (CI run `39200690280`).
- Deployed the function to the existing `imperial-games-staging` Supabase project: `ig-admin-users-preview-v1` **ACTIVE v1**, with `verify_jwt=true`.
- A read-only database count showed 6 staging profiles and one configured Superadmin role. No profile or role data was changed.
- **Still unverified:** real authenticated Superadmin browser result, explicit Tester/Admin 403 responses, anonymous HTTP request, exclusion regression, and any production route behavior. The container runtime could not resolve the staging endpoint hostname for an unauthenticated probe.
- The frontend exists only in the draft development branch. It has **not** been deployed to the live Cloudflare website.
