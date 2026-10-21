# Imperial Games — Supabase migration status

Updated 2026-10-20. The migration is **not complete**.

Staging `qonqemhljgxlwpghkxhn` has 101 recorded migrations and 30 reviewed deployed
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
browser tests, and 21 transactional SQL suites. Hosted staging rollback tests and
public endpoint preflight/auth-denial checks supplement these isolated checks.
No production cutover or real-money readiness is established by this coverage.

The exposed `ign_action` endpoint now uses SECURITY INVOKER; its actor-bound
privileged implementation is in the unexposed `internal` schema with an empty
search path. Hosted rollback tests under the actual authenticated role passed,
and the authenticated SECURITY DEFINER advisor finding is cleared. See
`docs/IGN_FUNCTION_SECURITY_20261020.md`.

All 56 formerly policy-less backend tables now have explicit restrictive client-deny
policies. Obsolete idempotency table privileges and five owned sequence grants
were revoked; service access is preserved. The hosted role-matrix test passed,
and a fresh security advisor read returned no findings. The per-table review is
in `docs/BACKEND_ONLY_RLS_REVIEW_20261020.md`.

Announcement content now uses a dedicated Supabase table with canonical staff
authorization, optimistic edit revisions, inactive drafts, public publication/expiry
filters and archive controls. The active site layout renders the published banner;
normal clients cannot read author identities or write announcements.

AMOE and Prize Claims now use dedicated owner-scoped request tables, with
server KYC/role/exclusion enforcement and immutable client intake. Staff audit
reads use canonical authorization. Requests confer no eligible entries, prize
entitlement or payment; trusted review and provider fulfillment remain separate.
Exact decimal amounts are retained as validated strings, with no binary rounding.

Published builds now emit `/release.json` with their source commit and public
practice configuration. `npm run verify:published -- https://imperialgaming.llc <full-sha>`
checks exact commit, backend target, held-game scope, six SPA routes and the main
application asset. A successful host build alone does not establish these checks.

VIP levels now use a dedicated public catalog seeded from the existing 34-level
specification (Beginner 0 XP through Eternal X 10,000,000,000 XP). Player status
comes from owner-scoped wallet XP, not the stale wallet level field or empty
legacy records. Superadmins can publish validated, atomic threshold edits with
revision conflict handling and a private audit history. Normal admins are read-only.
The legacy VIP operator entry point uses the same new screen. No XP, bonuses or
balances are granted by changing the catalog. See `VIP_CATALOG_20261021.md`.

VIP reward wheels now record one saved spin per reached level (1–34), with stage
boundaries 1–11, 12–24 and 25–34. New and existing eligible Supabase accounts get
level-1 enrollment; higher levels are granted only on trusted XP threshold
crossings, once per level. Catalog edits do not issue spins. The admin dashboard's
Reward Wheels editor controls every section's reward, exact amount, unit, notes
and weight, with a private audit and stale-edit protection. Superadmins can now
publish explicit IGN/IGD/IGT wallet prizes or pause a wheel. Each server-side draw
atomically credits its wallet, writes a transaction and consumes exactly one earned
spin through a unique receipt. Separate spins can win the same prize again;
retries of one spin return the original receipt. Existing incomplete prize pools
remain paused until configured and published. Free bets, game spins, XP
multipliers and external cryptocurrency payouts still need fulfillment rules.
See `VIP_REWARD_WHEELS_20261021.md` and `VIP_WHEEL_REDEMPTION_20261021.md`.

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
