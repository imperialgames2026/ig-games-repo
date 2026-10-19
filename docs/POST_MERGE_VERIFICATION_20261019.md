# Post-merge verification — 2026-10-19

Inspected merged `ig-games-repo` at `35fdde34da6a3af5b76d1cdf5d24410bde0e6be0`
and `casino-zip` at `0ad8fbb` in isolated worktrees. Existing `work` checkouts
were preserved. No AGENTS.md or local engineering skills were present. Reviewed
both blueprints, migration/integration reports, workflows, backend manifest,
archived source inventory, compatibility facade and recovered SQL. Supabase and
Postgres skill guidance and current RLS documentation informed the review.
Notebook links remain unverified design references.

## Completed verification

- Retried only failed jobs in [browser run 39315654163](https://github.com/imperialgames2026/ig-games-repo/actions/runs/39315654163).
  Attempt 2 passed all **22 desktop/mobile checks**, completing at 20:19 UTC.
  [Report artifact](https://github.com/imperialgames2026/ig-games-repo/actions/runs/39315654163/artifacts/12219002904).
- The successful old workflow's extra `npm install --no-save` changed 201 packages,
  removed 36 and added 11 after `npm ci`. It did not test the exact app lockfile.
  Playwright 1.56.1 is now pinned in devDependencies and the lockfile; the second
  install is removed. Browser checks now also run on PRs, and package changes
  trigger main-branch browser checks.
- Local locked install: **632 packages**; Vite build and **71 offline Node tests**
  pass. Both the original and new locked dependency trees passed **22 browser
  checks** using system Chromium. These are public lobby/authentication-gate
  tests, not authenticated multiplayer/game settlement E2E.
- casino-zip merged source: **114 Vitest + 4 Node tests**, typecheck, scaffold
  build and editable original-app build pass. Non-fatal bundle-size and stale
  browser-data warnings remain.
- Backend packaging verifies **84 checksummed migrations / 26 functions**.
  Current game audit: **45 routes, 10 practice-backed, 35 blocked**.
- Disposable Postgres regression reproduces the ownerless app_records leak,
  applies the proposed policy removal, and confirms anonymous denial, two-owner
  isolation and unchanged administrator reads. Proposal is not deployed.
- Structural replay executes 29 historical migrations, then fails at migration
  30 because the plain Postgres image lacks `pg_cron`. This is an environment
  dependency, not proof that later migrations are correct or incorrect. No
  historical migration was rewritten to force a passing result.

## Migration evidence and release gates

The repository's explicit deployment target and connected project metadata agree
on staging **qonqemhljgxlwpghkxhn** (`imperial-games-staging`). At 20:19 UTC it
had **87 migrations and 27 functions**, exceeding the merged manifest. The three
new migrations are `20261019200452_canonical_wallet_admin_authorization`,
`20261019200745_profile_settings_and_avatar_storage` and
`20261019201632_verified_originals_practice_rounds`. Reconcile the concurrent
work before any deployment. Do not overwrite staging with the older manifest.

The older **icwzqdbibhnrtjahfzsx** project's production designation is not proven.
The parent read-only audit found 17 tables/2 functions versus staging's 86/27,
and older-only `wallet_transfers`, `exchange_orders`, `exchange_fee_ledger`.
Staging is not a verified schema superset. Staging-bound wallet/Fireblocks handlers
must not be copied blindly to another target. Fireblocks' JWT exemption is
intentional signed-webhook handling; it does not authorize crediting real funds.

The ZIP has 390 entries, including 61 `base44/functions` sources and 23
`base44/entities` definitions. It is source code, not evidence of migrated user
records, balances or storage objects; no CSV/JSONL/SQL export was present.
Actual source-to-destination counts/checksums, ownership mappings, reconciliation
and customer authentication migration remain unverified.

Read-only inspection confirmed staging `app_records` is empty and retains both
`app_records_owner_read` and `app records read own`. The latter permits ownerless
rows, and permissive policies combine with OR. The proposal removes only that
legacy policy. Classify intended public catalogs before promoting it or importing
ownerless data; replace public visibility with explicit reviewed surfaces.
See [local test instructions](../tests/database/README.md).

Other gates remain: full Supabase clean replay, real authenticated HTTP/browser
multi-account testing with designated test credentials, auth/role/storage parity,
legacy rewards/referrals/admin/billing behavior, custody/payment providers,
real-value settlement, production target/rollout approval, and Android release.
The parent audit found leaked-password protection disabled; no settings were
changed. Server-only RLS tables were not opened to clients. The older api shim
returns 501 and staging has no api shim; blocked legacy dispatch is not completed
feature parity.

No live data, credentials, permissions, functions or schemas were changed. No
real gambling, financial transactions, production cutover or real funds were
used. Source integration, customer data migration and production readiness are
separate gates; this report does not declare the migration complete.

## Follow-up: recovered current sources and closed local validation gaps

This section supersedes the initial 84/26 packaging and local replay/auth blockers
above. Main remains `35fdde3`; the active follow-up is open PR #12 at `d832ce6`.
Its frontend reports 44 actual game routes, 15 practice-backed and 29 blocked;
main still has the older route inventory. No branch was merged or overwritten.

- Read-only Supabase retrieval reconciled **all 87 recorded SQL sources and all
  27 deployed functions (28 files)**. Trailing whitespace is ignored only when
  comparing source retrievals; committed bytes have independent SHA-256 hashes.
  One historical filename normalizes hyphens to underscores; its SQL matches.
- The three added migrations and changed wallet/admin/Originals handlers match
  PR #12 byte-for-byte apart from trailing whitespace. Their sources and exact
  recorded versions are now recovered into this draft's backend manifest.
  `supabase/backend-provenance.json` records retrieval time, branch commit,
  deployment bundle hashes, source hashes and migration provenance.
- Packaging now checks function-file hashes as well as SQL hashes. A regression
  proves that changing a handler causes packaging to fail.
- **All 87 migrations replay successfully** on disposable Postgres 17 with real
  pg_cron. Scheduled jobs are disabled. Actual replayed signup/canonical-role
  policies pass metadata escalation and two-owner/admin/anonymous isolation
  tests for the proposed legacy policy correction; changes are rolled back.
- A second replay uses **real GoTrue Auth migrations**, then all 87 app migrations.
  Two local users sign up/log in through real HTTP. PostgREST with signed JWTs
  verifies canonical player roles, cross-owner wallet-read isolation, denied role
  writes, and persisted owner profile edits. No wallet/game/payment operations run.
- A real browser signs in against those local services, restores its session on
  reload, and cannot enter the Superadmin directory. No staging credentials are
  needed for this coverage. Storage is a schema fixture; Edge Runtime, Realtime,
  email delivery and deployed environment behavior remain separate gates.
- The full Supabase image could not unpack in Docker's vfs storage (`no space
  left on device`); the smaller pinned Postgres/pg_cron/Auth/REST stack succeeds.
  Reproduction commands and limits are in `tests/database/README.md`.
- PR #12's distinct browser failure was diagnosed: saved predictions rendered
  correctly but `aria-pressed` used the default choice after reload. Stacked draft
  [PR #14](https://github.com/imperialgames2026/ig-games-repo/pull/14), commit
  `69645cf`, fixes this and checks all four choice-based games. **11 controlled-API
  browser tests passed locally and exact-commit CI passed** in
  [run 39320236625](https://github.com/imperialgames2026/ig-games-repo/actions/runs/39320236625).
  The PR #12 source branch is unchanged. This is mocked UI coverage, distinct
  from the local real-service sign-in test above.

The remaining external input is a supported Base44 export inventory and confirmed
source environment, detailed in `BASE44_EXPORT_INPUTS.md`. No customer records,
live credentials, live database objects, deployed functions or permissions were
changed in this follow-up. All PRs remain drafts; no merge or live deployment.
