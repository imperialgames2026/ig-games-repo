# Imperial Games — Supabase migration status

Updated 2026-10-20. The migration is **not complete**.

Staging `qonqemhljgxlwpghkxhn` has 92 recorded migrations and 30 reviewed deployed
functions. Source checksums, recorded SQL history and JWT settings are reconciled
in `supabase/backend-manifest.json` and `supabase/backend-readback-20261020.json`.
Use `scripts/prepare-reviewed-backend.mjs` to assemble the reviewed backend;
root migration files also contain historical reference material.

Verified implementations include canonical Supabase Auth/roles, profile names and
avatars, protected wallet/admin operations, support, KYC status, self-exclusion,
poker analytics, 21 verified practice routes (20 catalog entries including Rocket),
practice fairness verification and owner-scoped payment preparation/cancellation.
Payment preparation never moves or reserves funds. The public game library and
approved catalog expose these practice games; other game routes remain gated.

GitHub verification includes locked dependency builds, isolated recorded SQL
replay, real local Auth/REST/Storage and session/browser checks, game/account
browser tests, and 14 transactional SQL suites. Hosted staging rollback tests and
public endpoint preflight/auth-denial checks supplement these isolated checks.
No production cutover or real-money readiness is established by this coverage.

Remaining work:

- The five final games (Darts, Dice Zone, HiLo, Rocket and Towers) now have
  practice implementations; see `FINAL_APPROVED_GAMES_20261020.md` for exact rules
  and limitations. The other 23 routes are on the non-migration list until
  explicit owner instruction. They are not pending migration work.
- Finish the remaining account/business features within the approved app scope.
  This is a fresh start: no customer accounts, balances, history or files will
  be imported, and no Base44 customer export is required.
- Complete provider-backed custody, deposit/withdrawal execution and reconciliation.
- Reconcile the chosen production backend and hosting/Auth configuration, then
  verify cutover. Existing inherited JavaScript typing errors also remain visible.

Detailed evidence: `ACCOUNT_BACKEND_INTEGRATION_20261020.md`,
`CATALOG_RECORD_ISOLATION_20261020.md`, `POST_MERGE_VERIFICATION_20261019.md`
and `MINES_BACKEND_20261020.md` and `FINAL_APPROVED_GAMES_20261020.md`.
