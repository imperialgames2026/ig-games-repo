# Imperial Games — Supabase migration status

Updated 2026-10-20. The migration is **not complete**.

Staging `qonqemhljgxlwpghkxhn` has 90 recorded migrations and 29 reviewed deployed
functions. Source checksums, recorded SQL history and JWT settings are reconciled
in `supabase/backend-manifest.json` and `supabase/backend-readback-20261020.json`.
Use `scripts/prepare-reviewed-backend.mjs` to assemble the reviewed backend;
root migration files also contain historical reference material.

Verified implementations include canonical Supabase Auth/roles, profile names and
avatars, protected wallet/admin operations, support, KYC status, self-exclusion,
poker analytics, 15 distinct practice games (16 routes including an alias),
practice fairness verification and owner-scoped payment preparation/cancellation.
Payment preparation never moves or reserves funds. The public game library and
approved catalog expose these practice games; other game routes remain gated.

GitHub verification includes locked dependency builds, isolated recorded SQL
replay, real local Auth/REST/Storage and session/browser checks, game/account
browser tests, and 13 transactional SQL suites. Hosted staging rollback tests and
public endpoint preflight/auth-denial checks supplement these isolated checks.
No production cutover or real-money readiness is established by this coverage.

Remaining work:

- Implement or explicitly retire the 28 blocked game routes and remaining archived
  rewards, referrals, quests, VIP, billing and other business functions.
- Obtain the authoritative Base44 export/inventory and migrate/reconcile customer
  identities, data, storage and financial history. Application source archives
  contain no customer export. See `BASE44_EXPORT_INPUTS.md`.
- Complete provider-backed custody, deposit/withdrawal execution and reconciliation.
- Reconcile the chosen production backend and hosting/Auth configuration, then
  verify cutover. Existing inherited JavaScript typing errors also remain visible.

Detailed evidence: `ACCOUNT_BACKEND_INTEGRATION_20261020.md`,
`CATALOG_RECORD_ISOLATION_20261020.md`, `POST_MERGE_VERIFICATION_20261019.md`
and `MINES_BACKEND_20261020.md`.
