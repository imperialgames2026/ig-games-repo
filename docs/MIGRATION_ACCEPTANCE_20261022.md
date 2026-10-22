# Base44 to Supabase practice migration acceptance

Scope: the 101 recorded migrations and 30 reviewed function packages for the owner-selected `qonqemhljgxlwpghkxhn` backend. Acceptance executes against disposable local services in GitHub Actions, not the hosted project. No customer data is imported. The old hosted project remains untouched.

The exact final candidate SHA, run URLs, results and publication verification are recorded in [PR 38](https://github.com/imperialgames2026/ig-games-repo/pull/38). A failed or still-running required job is not a completed acceptance gate.

## Isolated environment

`practice-release-validation.yml` pins Supabase CLI 2.121.0, Node 22 and Ubuntu 24.04. `prepare-reviewed-backend.mjs --local-dev` checks every SQL and function-source SHA-256 before assembly. Only the recorded SQL inventory is replayed; historical root migrations are not reapplied. PostgreSQL major version is 17. The local Auth site URL is `http://127.0.0.1:4173`, with `/ResetPassword` explicitly allowed and email confirmation required. The connection writer and authenticated suites reject any API URL outside loopback port 54321. These Auth settings are emitted only for `--local-dev`; hosted Auth is not changed.

The configured project ID also names the local Docker container; its matching hosted reference does not make these tests hosted operations. SQL suites verify the local container identity, wrap each fixture/test in BEGIN/ROLLBACK and stop at the first SQL error. CLI teardown runs even after failure.

A second disposable stack in `test-local-auth.mjs` uses UUID-named Docker resources, a temporary database, generated local credentials and digest-pinned GoTrue, PostgREST and Storage images. APIs bind only to loopback, the database has no published port, cron execution is disabled, and only resources created by that run are removed. Its browser blocks non-loopback requests.

## Acceptance matrix

| Area | Required evidence |
| --- | --- |
| 101 migrations / 30 function packages | Unique recorded migration identities; every migration/function file matches the manifest checksum; clean CLI replay plus independent real Auth/Storage replay. |
| Auth callbacks | Real local signup-confirmation session; consumed-link rejection in a new browser context; genuine expiry by aging only a synthetic account's confirmation timestamp; real recovery callback, password change and new-password login. UI contract tests also cover resend cooldown, invalid callbacks, account switching and sign-out cache isolation. |
| Roles and permissions | Canonical roles override editable signup metadata; direct role writes and cross-account wallet reads fail; player/tester cannot enter admin routes; service/staff/exclusion checks pass. |
| Backend-only tables | Actual anon/authenticated roles cannot read or mutate the 56 reviewed tables; restrictive deny policies survive isolated accidental-grant probes; protected sequences stay inaccessible; intended service access is preserved. |
| Privileged functions and wallets | SECURITY INVOKER wrapper/private implementation boundary; direct privileged RPC denial; canonical wallet and admin SQL behavior, invalid inputs, owner binding, retry/idempotency and ledger invariants. |
| Practice games | Authenticated local Edge Runtime multiplayer joins; private Hold'em/Omaha cards; shared Crash/Trenball commitment; Dice and final-game browser proofs/reloads; Originals/Mines transactional SQL; rejected ownership and unchanged financial balances. |
| VIP / rewards | All 34 levels; one grant per earned level; 11/13/10 stage boundaries; separate spins can win the same prize; concurrent/repeated requests create one receipt/credit; superadmin settings and paused publication behavior. |
| Storage / support | Real avatar MIME/size/path/owner enforcement; private synthetic KYC denial; support owner/staff boundaries and persisted profile changes. |
| Public frontend | Locked production build; desktop/mobile route checks; correct practice target, 23 held games, exact published commit and application bundle. |

## Coverage limits

The unchanged `secure-wallet`, `admin-mutations`, `ig-originals-practice` and admin-preview handlers deliberately reject an unapproved local target in the independent Node adapter test. That is evidence of a preserved deployment guard, not a successful financial HTTP operation. Their wallet/admin/Originals database behavior is tested separately in rolled-back SQL. The Node adapter is not Edge Runtime; the CLI integration run supplies real Edge Runtime coverage for supported local practice handlers.

Generated local confirmation links do not establish SendGrid delivery. Hosted SMTP, mobile callback acceptance, provider/custody execution, business reward rules and operational recovery remain separate release gates. Three hosted wheel pools remain paused. No acceptance test enables payments, transfers funds, changes hosted Auth or grants broader hosted permissions.

## Initial candidate finding

Candidate `facc7829d3a0ba0689687cc9b4939ee9f6ca0da0` passed all 101 real Auth/Storage migration replays, 21 transactional SQL suites, 150 offline tests, 32 controlled-API browser tests and 52 public browser tests. Its integration job failed one of 28 authenticated tests because the VIP test still expected text inside the retired weekly-quest card. The test now verifies the actual 34 saved VIP spins in the authoritative reward wheel, plus the explicit unavailable quest state. Two real local Auth callback tests were added to close the confirmation/replay/expiry coverage gap. Final acceptance requires the subsequent complete run linked in PR 38; the initial failed run is not sign-off evidence.
