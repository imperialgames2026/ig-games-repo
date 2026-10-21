# Run the tester-chip site locally

The main React application can run against a disposable local backend with real
GoTrue authentication, Postgres/RLS, Storage, PostgREST, Kong and Supabase Edge
Runtime. It uses the checksum-verified tester-lab candidate: 97 recorded source
migrations, the pending poker lifecycle migration, and 21 authenticated practice
handlers. It does not connect to or deploy the hosted lab.

## Start and verify

Use the existing main checkout. Install its locked dependencies with `npm ci`.
In this managed environment the npm cache must be writable, for example
`npm ci --cache /workspace/.npm-cache --no-audit --no-fund`.

```sh
node scripts/local-test-site.mjs start
node scripts/local-test-site.mjs status
node scripts/test-database.mjs --test-lab
node scripts/local-test-site.mjs build
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:auth
node scripts/local-test-site.mjs dev
```

Omit `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` on machines with the Playwright-managed
Chromium installation. The browser suite starts/reuses the built-app preview on
port 4173. The development command runs Vite in test mode on loopback port 5173.
Both the development and build commands explicitly supply the local connection
to their child process, so inherited hosted-lab variables cannot override it.

Docker must be available. The helper always selects the managed local Unix
socket, clearing inherited Docker endpoint/context/TLS selectors while retaining
registry configuration. Its first run builds the repository's digest-pinned
Postgres/pg_cron image and pulls the other pinned service images. A read-only
combined CA bundle supplies TLS trust to the build and Edge Runtime. Certificate
and package-signature verification remain enabled.

## Accounts, chips and stopping

Local signup auto-confirms disposable email addresses; email delivery is not
tested. Each player needs a separate account. The canonical `player` role can
play. The canonical `tester` role remains read-only and cannot be used as a
playtest player. Poker rooms issue their own 1,000-chip starting stacks, and the
other practice games retain their separate server-owned practice state.

```sh
node scripts/local-test-site.mjs stop
```

Stopping discards this local lab's accounts, game state and uploaded files. It
removes only containers carrying the helper's ownership label. A subsequent
start replays a fresh candidate. Repeating `start` while the same healthy package
is running reuses it. If the reviewed/pending package or local adapter changes,
the helper requires an explicit stop/start instead of silently serving stale
code. Rebuild the frontend after a fresh start because its local public key
changes.

## Scope and provenance

The oversized full Supabase Postgres image cannot unpack within the managed
environment's vfs storage budget. The compact stack uses the same application
SQL and real services; it is distinct from full hosted Supabase behavior.
Scheduled jobs and Realtime are disabled locally. Table requests still enforce
server turn deadlines. Email delivery, hosted gateway configuration and an
unattended poker watchdog require separate hosted-lab checks.

The generated candidate and local service state live outside the checkout in
`/workspace/.local-test-backend` in this environment. The candidate report records
staging-to-lab source transformations. Seven generated **local-only** handler
copies additionally accept `http://kong:8000` only when
`IG_LOCAL_PRACTICE=true`, matching the existing local practice guard pattern.
`local-function-report.json` records each source/generated checksum and named
patch. Exact source-pattern checks reject unexpected drift. Original staging
files and the hosted-lab candidate remain unchanged; authentication, ownership,
role and exclusion checks remain enforced.

Financial schema remains for migration dependencies and isolation tests. The
local function allowlist omits financial transfers, deposit/withdrawal
preparation, custody/webhooks, staking and external support automation. These
endpoints return 404 locally. There are no funded financial wallets.

The ignored `.env.test.local` contains only the generated local browser
connection. Local service keys are kept outside version control and are never
printed by the helper. Avoid sharing raw Auth logs or runtime JSON files: they
can contain disposable session/service credentials.

The transactional database command explicitly requires the helper-owned local
container. It transforms historical test-fixture project URLs in memory to
match the generated lab schema, runs the 17 recorded regression suites plus the
new poker lifecycle suite, and rolls their fixtures back. Authenticated browser
tests use newly created local players and real server handlers, including
private poker cards, free timebank, next-hand continuity, Originals/Mines proofs,
profiles, support, announcements and recovery. They do not run bot sessions or
connect human testers.

For a hosted candidate and the separate deployment prerequisites, see
[TEST_LAB_BACKEND_CANDIDATE.md](TEST_LAB_BACKEND_CANDIDATE.md). Local readiness is
not evidence that the hosted lab has the candidate schema, functions, public key,
email settings or domain redirects installed.
