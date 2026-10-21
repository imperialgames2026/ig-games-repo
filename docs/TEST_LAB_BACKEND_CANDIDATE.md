# Backend candidate for IG network lab tests

The owner-confirmed lab project is **IG network lab tests**:

- Project reference: `jvyzpxjqmymafjapprpp`
- API URL: `https://jvyzpxjqmymafjapprpp.supabase.co`
- Canonical application constants: [`config/test-lab.js`](../config/test-lab.js)

This is a different project from the historical staging backend
`qonqemhljgxlwpghkxhn`. Its hosted database, Auth settings, functions and deployment
history have not been established by preparing files locally.

## Prepare a reviewable package

From the main repository root:

```sh
node scripts/prepare-test-lab-backend.mjs /tmp/imperial-test-lab-backend
node --test tests/testLabBackendPackaging.test.mjs
```

The output directory must be empty and outside the source checkout. The script
does not connect to Supabase, upload code, apply SQL, create users or run bots.
It refuses any target other than the confirmed lab reference.

The package contains:

1. The full checksum-verified reviewed migration history, needed to reproduce the
   schema dependencies on a fresh isolated database.
2. The explicit pending poker lifecycle migration and three pending poker handler
   copies listed with hashes in
   [`supabase/test-lab-poker-candidates.json`](../supabase/test-lab-poker-candidates.json).
3. An allowlist of 21 authenticated practice-game, poker, support and role-gated
   operator functions. Financial/provider handlers are excluded.
4. `supabase/config.toml` pinned to the confirmed lab, with JWT verification for
   every included function.
5. `test-lab-backend-report.json`, containing original source and generated file
   hashes, pending-source status, exclusions and limitations.

Every original reviewed migration and function is verified against
`supabase/backend-manifest.json` before filtering, including functions excluded
from the lab package. Original staging files, checksum manifests and deployment
scripts remain unchanged.

## Explicit generated transformation

Only generated files substitute the exact historical staging project reference
with `jvyzpxjqmymafjapprpp`. The report records the number of substitutions and the
SHA-256 before and after for each file. This changes strict project guards in
practice handlers and the avatar URL ownership check in the profile-storage
migration. It does not weaken authorization, remove role checks or make the old
staging deployment script accept the lab.

The pending poker overlay remains distinct from recorded deployed source. Its
forward SQL and handler copies address eight-seat ordering, short/all-in blinds,
between-hand entry, chip-preserving lifecycle behavior, join variant checks,
practice-only time extensions, bot odd-chip allocation, visible bot labels and
browser event-service session/CORS handling. These are candidates
until isolated SQL and authenticated gameplay checks complete.

## Tester-chip boundaries

The package excludes `admin-mutations`, `secure-wallet`,
`crypto-deposit-preview-v1`, `ig-payment-requests`, `ign-staking-v1`, both
Fireblocks handlers, the unused legacy Crash queue handler and the optional
external AI/email support supervisor. The included operator dashboard is
read-only; tournament prize schedules do not activate payouts.

The complete schema still contains historical financial tables and routines
because later reviewed migrations depend on them. This package does not remove
that schema or claim a fully minimized backend. Existing disabled provider and
paid-play gates must remain disabled. No real-value funding, provider credentials
or customer records are included.

## Frontend configuration and remaining release work

Copy [`.env.lab.example`](../.env.lab.example) to the ignored `.env.lab.local` and
provide the lab project's own public publishable key, or set the equivalent host
environment variables. The example key is intentionally blank. Use the explicit
lab build command documented in [test-site readiness](TEST_SITE_READINESS.md).
Service-role credentials never belong in the frontend.

Before applying anything to the hosted lab, inspect its actual migration history
and configuration, reconcile existing state against the candidate, review the
generated checksum report and complete an isolated fresh-schema replay. The
full history is not a blind update script for an existing hosted project. Auth
redirects, allowed site domains, test accounts and deliberate Superadmin
assignment also require verified target configuration. No publication is
performed by these preparation commands.
