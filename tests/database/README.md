# Isolated migration checks

No script accepts a hosted connection URL or live credentials. Docker resources
are uniquely named and cleaned up; databases use temporary storage. Scheduled
jobs are registered during replay but `cron.launch_active_jobs=off` prevents
execution. No game, transfer, wallet-adjustment or payment operations are tested.

## Fast policy reproduction

`node scripts/test-local-database.mjs app-records` reproduces permissive-policy OR
behavior and tests the undeployed policy correction using minimal fixtures.

## Complete recorded SQL replay

```sh
docker build -t ig-local-postgres-cron -f tests/database/Dockerfile tests/database
node scripts/test-local-database.mjs replay-cron
```

The Dockerfile pins Postgres by digest and pg_cron 1.6.7 by archive checksum. Its
runtime image contains only Postgres and the extension. The harness checks all
87 migration checksums and executes them in recorded version order. A transaction
then tests signup metadata escalation, the existing ownerless-record exposure,
and the proposed correction using the actual replayed canonical-role helpers.
Two owners, a canonical administrator, and anonymous access are checked. Fixtures
and the policy correction are rolled back.

`bootstrap.sql` supplies representative Auth/Storage API contracts, not running
services. `replay` without the `-cron` suffix deliberately uses plain Postgres;
it stops at migration 30 because that image lacks pg_cron.

## Real Auth, REST, and browser checks

```sh
npm ci
npx playwright install --with-deps chromium
IG_LOCAL_BROWSER=1 node scripts/test-local-auth.mjs
```

This starts digest-pinned GoTrue 2.197.0 and PostgREST 14.18 on a dedicated Docker
bridge. Only API ports are published, bound to 127.0.0.1; the database is not
published. All HTTP test targets are asserted to be loopback. Browser requests
to other hosts are blocked. Docker internal networks suppress host port
publication in this environment, so this service harness uses a dedicated bridge
rather than `--internal`.

GoTrue initializes its real Auth schema before all 87 application migrations run.
Two disposable users then sign up and log in through HTTP. Real signed JWTs test
canonical signup roles, cross-owner wallet read isolation, denied role writes,
and an owner profile update. Browser coverage signs in, restores a session on
reload, and rejects access to the Superadmin user directory. It uses a local
routing proxy for the standard `/auth/v1` and `/rest/v1` paths. Autoconfirm is
only for these ephemeral local users; email delivery is not tested.

Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium` when using an installed
system Chromium. Omit `IG_LOCAL_BROWSER` to run only the HTTP assertions.

Limits: Storage still uses schema fixtures; no Storage API, Edge Runtime,
Realtime, email delivery or production configuration is emulated. Several deployed
handlers deliberately require the staging URL and should not be modified to
bypass that protection merely for local testing. These tests do not establish
staging multi-account browser gameplay or full platform parity.

The full Supabase CLI path was attempted with CLI 2.121.0 and
`SUPABASE_HOME=/workspace/.supabase-tools`. The CLI works with this writable home,
but its Postgres 17.11.0.004 image failed to register a Docker layer with
`no space left on device` under the environment's vfs Docker storage. Its retry
was stopped. The smaller Postgres/pg_cron approach above completed successfully.
In this cloud environment, Alpine's in-container TLS download also failed. The
same pg_cron archive and signed Alpine packages were downloaded through the host
and installed offline, without disabling TLS or package signature verification.
CI builds the committed multi-stage Dockerfile directly.

## Policy proposal

`supabase/proposals/app-records-owner-read.sql` remains outside the deployment
manifest. The real replay confirms its result, but promotion still requires
classifying ownerless imports and defining any intended public catalogs
explicitly. No live policy was changed.
