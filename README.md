# Imperial Games

One React/Vite application with Supabase Auth, server-authoritative practice
games, player pages and operator tools. The current release target uses **tester
chips only**: no real-world currency, deposits, withdrawals or redeemable prizes.

## Develop

Use Node.js 22 (CI) or the validated Node 24 environment. Run all application
commands from this repository's root:

```sh
npm ci --no-audit --no-fund
npm run dev
```

Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` through
`.env.local` or the host's environment for the intended test backend. Use only a
public browser key; service-role credentials stay on the server. Authentication
and multiplayer gameplay need the backend, not just a successful frontend build.

```sh
node scripts/audit-repository-consolidation.mjs
npm test
npm run build
```

`npm run test:e2e` checks the public desktop/mobile UI. Authenticated database and
browser test procedures are in [practice validation](docs/PRACTICE_RELEASE_VALIDATION.md).
Use the checksum-verified reviewed backend packaging workflow rather than
replaying historical migrations blindly. Builds and tests do not deploy the site.

See the [completed website frontend pass](docs/WEBSITE_FRONTEND_COMPLETION_20261021.md)
for the latest design, navigation, account/support and browser validation work.
See [test-site readiness](docs/TEST_SITE_READINESS.md) for earlier results and
the isolated backend startup procedure.

The separate [published practice release review](docs/PRACTICE_RELEASE_READINESS_20261021.md)
records current-main/CI/live-site evidence for `imperialgaming.llc` and its staging
backend. It does not change the owner-selected lab configuration below.

## Owner-selected lab

The hosted test target is **IG network lab tests**
(`jvyzpxjqmymafjapprpp`), a separate Supabase project from the older staging
configuration. Copy `.env.lab.example` to ignored `.env.lab.local` and provide
that project's public publishable key, or use environment settings.

```sh
npm run dev:lab
npm run build:lab
npm run prepare:lab -- /tmp/imperial-lab-candidate
```

The lab build writes `dist-lab/` and rejects missing, privileged and wrong-project
legacy keys. `vercel.lab.json` is a separate lab hosting candidate; it has not
been deployed. The historical default build and staging deployment workflow
remain distinct. [Lab backend packaging](docs/TEST_LAB_BACKEND_CANDIDATE.md)
documents checksums, pending poker fixes and excluded financial handlers.

On the `test` branch, `vercel.json` also selects `build:lab` and `dist-lab`.
Hosted `test` builds pin the lab's public browser settings from
`config/test-lab-public.json`, even when the hosting dashboard inherits older
production settings. No account or service-role credentials are included.
See [test-branch delivery](docs/TEST_BRANCH_DELIVERY.md).

Check the existing hosted setup with read-only commands:

```sh
npm run check:lab:public
# Requires SUPABASE_ACCESS_TOKEN through secure environment settings:
npm run inspect:lab -- --candidate=/workspace/ig-test-lab-candidate --output=/tmp/ig-lab-reconciliation.json
```

The [saved public report](docs/reports/test-lab-public-readiness.json) finds all
21 candidate functions missing. Its table checks also require reconciliation
of the existing application setup.
The [management inspection guide](docs/TEST_LAB_RECONCILIATION.md) explains how to
compare existing history and function sources before proposing changes. These
checks do not apply migrations, deploy functions or publish the site.

## Repositories

This checkout is the sole working application. Companion `casino-zip` designs,
poker specifications and historical audits are available in the
[reference library](docs/reference/casino-zip/README.md), with a
[complete source mapping](docs/REPOSITORY_CONSOLIDATION.md). A sibling repository
is not required to build or run the app. Existing archives preserve the original
frontend without activating its legacy SDK or client-side balance writes.

Start design review with the [blueprint review](docs/TEST_SITE_BLUEPRINT_REVIEW.md)
and the [application blueprint](docs/application-blueprint/README.md). Older
integration reports record what was observed at their dates; they are not current
release results. Publishing and pushing to GitHub are separate release actions.
