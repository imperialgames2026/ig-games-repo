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
IG_LOCAL_BROWSER=1 IG_LOCAL_STORAGE=1 IG_LOCAL_EDGE=1 node scripts/test-local-auth.mjs
```

This starts digest-pinned GoTrue 2.197.0, PostgREST 14.18 and Storage API 1.81.0 on a dedicated Docker
bridge. Only API ports are published, bound to 127.0.0.1; the database is not
published. All HTTP test targets are asserted to be loopback. Browser requests
to other hosts are blocked. Docker internal networks suppress host port
publication in this environment, so this service harness uses a dedicated bridge
rather than `--internal`.

GoTrue and Storage API initialize their real schemas before all 87 application migrations run.
Two disposable users then sign up and log in through HTTP. Real signed JWTs test
canonical signup roles, cross-owner wallet read isolation, denied role writes,
and an owner profile update. Browser coverage signs in, restores a session on
reload, and rejects access to the Superadmin user directory. It uses a local
routing proxy for the standard `/auth/v1` and `/rest/v1` paths. Autoconfirm is
only for these ephemeral local users; email delivery is not tested.

With `IG_LOCAL_STORAGE=1`, real HTTP tests verify owned avatar uploads, intentional
public image reads, MIME and 5 MB limits, denied overwrite/upsert, cross-owner
listing/deletion isolation, and tester/exclusion restrictions. A synthetic image
in the private KYC bucket is readable with the local service token but not through
the public route or player token. Client KYC writes remain denied. Fixtures are
removed and the file backend lives only in temporary container storage. If the
flag is omitted, the faster Auth/REST suite uses Storage schema fixtures.

With `IG_LOCAL_EDGE=1`, unchanged source handlers run through a Node adapter for
`Deno.serve`, with the real locked Supabase SDK and actual local Auth/REST. Support
read requests verify missing/forged/anonymous session rejection, bound ownership,
canonical staff roles and exclusion. Four staging-bound handlers are verified to
fail closed on the local URL; the guards are never patched out. This is handler
integration coverage, **not Edge Runtime or hosted gateway JWT verification**.
The browser also verifies disabled Base44 legacy dispatch throws before any
function HTTP request.

Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium` when using an installed
system Chromium. Omit `IG_LOCAL_BROWSER` to run only the HTTP assertions.

Limits: Edge Runtime/gateway, Realtime, email delivery, image transformation,
S3/provider backends, CDN behavior and production configuration are not emulated. Several deployed
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
