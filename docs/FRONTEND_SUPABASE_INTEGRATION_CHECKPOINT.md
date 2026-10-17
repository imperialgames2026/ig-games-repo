# Frontend-to-Supabase integration checkpoint (2026-10-17)

## Verified
- Original frontend restored and built in `legacy-frontend/` (390 tracked files).
- Current app uses `lib/AuthContext.jsx` and `lib/supabaseClient.js` for Supabase Auth.
- Current `api/base44Client.js` reads wallet data through Supabase and rejects direct core wallet/transaction writes.
- Legacy payment checkout UI no longer invokes `create-checkout`; disabled pending server-side catalog, verified webhook, and idempotent settlement.
- Legacy wallet gifting UI remains present but transfers are disabled pending currency mapping and recipient verification.

## Security checks against live project (read-only)
- `secure_wallet_operation(uuid,uuid,text,numeric,uuid,integer)` is **not deployed**.
- Database privileges still report UPDATE granted to `anon` and `authenticated` on `public.wallets`, but current RLS policies only allow SELECT, not UPDATE. Revoke unused UPDATE grants as defense in depth after reviewing dependencies.
- Security advisor warns about authenticated-executable SECURITY DEFINER helpers `is_admin`, `is_admin_or_superadmin`, and `is_superadmin`. Assess their intended use and least privilege.
- `public.idempotency_keys` has RLS with no policy; server-only access may be intentional.

## Blocking work before merge
1. Resolve mapping of original IGC/IGUSD/IGT to Supabase balances; never infer financial equivalence.
2. Implement original 1–100 dice over/under rules in an atomic, idempotent server-side settlement function; the existing 1–6 secure-wallet function is not feature equivalent.
3. Implement server-verified token-pack checkout and signed, replay-safe payment webhook; test refunds/chargebacks.
4. Implement currency-specific gift recipient resolution and atomic transfer.
5. Audit other game components for client-side settlement and migrate one by one.
6. Add automated negative, concurrency, replay, authorization and end-to-end tests in an isolated staging environment.
7. Verify build and CI, security advisors, and migration rollout before merging into main.

No live balances, payments, or production schema were modified in this checkpoint.
