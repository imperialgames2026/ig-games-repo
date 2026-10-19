# Isolated migration checks

Run `node scripts/test-local-database.mjs app-records` with Docker available.
The harness starts its own digest-pinned Postgres 17 container, with no network,
no published port, no host mount and a temporary data directory. It accepts no
remote connection string. Cleanup removes only the container it created.

The regression reproduces the deployed permissive-policy OR behavior, then
executes `supabase/proposals/app-records-owner-read.sql`. It verifies anonymous
denial, two owners' isolation, and preservation of administrator reads. All
fixture data is rolled back. Auth UID and administrator helpers are minimal
fixtures: this does **not** validate real JWTs, canonical-role queries, or HTTP.

The proposed SQL is deliberately outside the deployment manifest. Promotion
requires classifying ownerless Base44 entities and defining explicit public
catalog access where needed. The currently empty staging table cannot establish
that all future ownerless imports should be public. Do not import records with
missing ownership into the current permissive policy.

`node scripts/test-local-database.mjs replay` also checks checksums and executes
historical migrations in version order against minimal Auth/Storage contracts.
This is a structural diagnostic, not a full Supabase environment. It currently
executes the first 29 migrations, then fails at
`20261017134057_poker_turn_timeout_watchdog.sql` because plain Postgres lacks
`pg_cron`. The error is not suppressed and this mode is not a passing CI gate.
Full clean-install verification needs Supabase's extensions and real Auth/Storage
schemas; do not infer deployability from packaging or these fixtures.
