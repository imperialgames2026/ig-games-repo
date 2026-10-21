# Imperial Games tester-site readiness

Review date: 2026-10-20 (America/New_York). Application baseline: latest fetched
`ig-games-repo/main`, commit `c0d1d10`; companion reference commit `0ad8fbb`.
The owner published the environment snapshot and loaded a new draft. The
preserved application/backend changes were verified rather than reapplied.
No application was pushed or deployed by this work, and no hosted bots or
player accounts were provisioned. Further publishing remains paused.

## Result and intended backend

`ig-games-repo` is the sole executable application. It preserves the full React
app and the useful migrated account, game and poker work from `casino-zip`.
The companion repository is no longer needed to build or run it. Its designs
and provenance are preserved in the [consolidation record](REPOSITORY_CONSOLIDATION.md)
and [blueprint review](TEST_SITE_BLUEPRINT_REVIEW.md).

The owner selected **IG network lab tests**, project `jvyzpxjqmymafjapprpp`.
It is different from the older `qonqemhljgxlwpghkxhn` staging project recorded
in historical documents and `.env.production`. A default source build does
not establish that the intended hosted lab works. Use the explicit lab commands
below for that project.

The local application now has a coherent tester-chip interface, usable desktop
and mobile navigation, and updated practice-only policies. Sixteen legacy
financial URLs show practice guidance without mounting purchase, withdrawal,
transfer, claim or staking forms. Financial balances are never relabeled as
practice chips. Preview metadata uses `noindex`; the old analytics loader has
been removed.

## Poker changes

- Restored companion tournament event discovery, free registration and assigned
  table navigation alongside eight-seat Hold'em and six-seat Omaha ring rooms.
- Added completed-hand restart, private-room invites, table stack display,
  loading/reconnect/error states and valid short-stack/raise controls.
- Displayed the authoritative ten-second turn timer and free one-use +30-second
  practice extension. The lab handler rejects paid extension currencies.
- Prepared forward fixes for eight-seat postflop order, all-in blinds,
  between-hand entry, carried stacks and bot payout ordering. Original recorded
  staging SQL and handlers remain unchanged; pending sources have their own
  checksums and are included in the generated lab package.
- Added explicit safe `[AI BOT]` seat labels; human playtest accounts remain
  `player`, while the canonical `tester` role remains read-only.

Players still advance streets and resolve showdowns with explicit seated-player
controls; the host deals the next hand. No unattended dealer loop was added.
Hand archive/analytics ingestion is unfinished and is labeled as a preview;
there is no claim that every completed poker hand is already archived for study.

Hosted bot sessions, load tests, tournament lifecycle/30-table scheduling and
calibrated player scoring have not been claimed as complete. The 23 previously
held game routes remain held. See the blueprint review for those boundaries.

## Verification

| Check | Current evidence |
| --- | --- |
| Consolidation audit | Pass: 301 original frontend files mapped, 22 exact-byte references, all companion function/migration mappings accounted for. |
| Standard offline tests | 170 passed after snapshot restore, no failures or skips, including the new read-only public preflight and existing-project reconciliation planner. |
| Frontend build | Pass. Pages load separately; the initial JS entry fell from about 1,808 KiB to 750 KiB before gzip. |
| Public browser tests | Previous isolated-local phase: 60 passed, desktop and mobile, including 320px navigation, financial URL exclusion, sign-in gates, and interrupted lazy-page recovery. After restore: four-page mobile lab-build smoke passed; external browser requests were blocked and the observed API target was the intended lab. |
| ESLint | Pass against actual active source paths; undefined identifiers/components and hook-order checks verified with a failing probe. |
| Diff whitespace checks | Pass. |
| Original backend packaging | Pass: 97 recorded migrations / 30 functions, original checksum constraints retained. |
| Lab candidate packaging | Pass: 98 migrations / 21 authenticated functions, 9 financial/provider handlers excluded; generated project substitutions and original/generated hashes recorded. |
| Candidate SQL regressions | Previous isolated-local phase: all 18 transactional suites passed, including the pending poker lifecycle regression; fixtures and test mutations rolled back. |
| Authenticated candidate checks | Previous isolated-local phase: 31 passed, no failures or skips. Real poker private cards, free timebank, next hand/reconnect, wrong-variant denial, Originals/Mines proofs and isolation, profile persistence, support, announcements and password recovery. These are not hosted-lab gameplay results. |
| Isolated real services | Previous phase verified real signup/login, canonical roles, cross-account isolation, browser session restoration, Storage restrictions, fresh restart and explicit-local build/development. Live processes are not assumed to survive the published snapshot. |
| Typecheck | Fails with 1,783 diagnostics of inherited JavaScript/component-prop and legacy facade typing debt (baseline: 1,801). Checks were not disabled to conceal it; the new lazy-page module typing was corrected. |
| Hosted lab build | Pass after restore, using the configured public URL/key for `jvyzpxjqmymafjapprpp`; no staging-key fallback. |
| Hosted lab public preflight | Auth settings respond 200; email signup is enabled and requires confirmation. Five profile/poker tables deny anonymous reads; catalog and announcements are missing or unexposed. All 21 expected handlers return 404 NOT_FOUND. No rows or accounts were read/created. |
| Hosted lab privileged inventory | Blocked: no `SUPABASE_ACCESS_TOKEN` is available. The new read-only inspector and 11 fixture tests are ready; no schema history or function deployment is inferred from public probes. |

The current offline result is recorded in `/tmp/ig-resumed-final-offline.log`;
the saved [public preflight report](reports/test-lab-public-readiness.json)
contains the read-only hosted observations. The four-page restored-build smoke
used `/tmp/ig-resumed-lab-smoke.mjs`.

Previous-phase verification logs were `/tmp/ig-final-offline.log` and
`/tmp/ig-final-public-browser.log`; type diagnostics were
in `/tmp/ig-final-typecheck.log`. The final authenticated log was
`/tmp/ig-final-auth-browser.log` (31/31), and the transactional SQL log is
`/tmp/ig-test-lab-final-sql.log` (18/18). Visual checks at 320/390/768/1440 pixels found
no horizontal overflow or page errors. Screenshots were at
`/tmp/ig-home-{narrow,mobile,tablet,desktop}.png`. Generated dependencies,
runtime settings, browser reports and site builds are ignored rather than
committed. No service-role key belongs in a frontend file or browser bundle.

## Reproduce the site

The restored environment already supplies the intended lab's
`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` securely. For a separate
checkout, supply those settings through environment settings or ignored
`.env.lab.local` using `.env.lab.example`; do not copy credentials into source.

```sh
cd /workspace/ig-games-repo
npm ci --cache /workspace/.npm-cache --no-audit --no-fund
npm run audit:consolidation
npm test
npm run lint
npm run build:lab
```

`npm run dev:lab` starts the frontend against the intended hosted lab.
`npm run build:lab` writes `dist-lab/`. `vercel.lab.json` is the corresponding
hosting configuration candidate. None of these build/preparation commands
applies schema changes, deploys functions or publishes a website.

`npm run check:lab:public` repeats the read-only hosted preflight using Auth
settings, zero-row table requests and function OPTIONS requests. Exit status 2
means setup remains unresolved; a successful public preflight would still not
establish authenticated gameplay readiness. Use the
[existing-project reconciliation guide](TEST_LAB_RECONCILIATION.md) for the
separate privileged inventory before proposing any backend changes.

Prepare an independent reviewable backend candidate with:

```sh
npm run prepare:lab -- /tmp/imperial-lab-candidate
```

Its output directory must be empty. Review `test-lab-backend-report.json`,
especially pending sources, explicit project substitutions and exclusions.
The complete migration history is suitable for a fresh isolated replay; it
must not be blindly replayed onto an existing hosted project. Inspect and
reconcile that project's actual history first.

The final prepared candidate is also available in
`/workspace/ig-test-lab-candidate/` with its checksum report. It contains no
project keys or player data. This is a reviewable build artifact, not a claim
that any migration/function has been applied to the hosted lab.

## Isolated local workflow

The managed Docker environment could not unpack the full official Supabase
database image within its disk allowance. The repeatable local helper therefore
uses pinned compact Postgres/pg_cron, real GoTrue Auth, PostgREST, Storage, Kong
and the actual Edge Runtime. Only the gateway is exposed on loopback. Docker
commands are pinned to the managed local socket; existing unrelated containers
are protected by ownership labels.

```sh
cd /workspace/ig-games-repo
npm run test-site:backend
npm run test-site:status
npm run test-site:build
npm run test:database:lab
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:auth
npm run test-site:dev
```

Keep the development command in a persistent terminal. Startup regenerates the
ignored `.env.test.local` and private `/tmp/ig-local-runtime.json`. The helper
forces the local URL and anonymous key for both build and development, even if
hosted lab variables are present in the shell. A snapshot does not retain live
processes; rerun startup when needed. `test-site:stop` discards the disposable
local database, accounts and storage files. It never targets the hosted lab.

This is a candidate schema/service validation environment, not full Supabase
platform parity. Scheduled jobs are disabled. Seven generated local handlers
extend their strict hosted project guards only for the explicit
`IG_LOCAL_PRACTICE=true` and exact internal `http://kong:8000` pair. Source and
local hashes are recorded in `local-function-report.json`; original hosted
candidate files remain unchanged. Those local-only exceptions retain session,
role and account checks and have independent negative tests. Hosted Auth,
redirects, schedules and domain behavior still need verification on the actual
lab after configuration is available.

The environment retains `install_script`, `start_skill` and the working
direct bindings for the confirmed URL and public key. The new draft adds a
secure `SUPABASE_ACCESS_TOKEN` requirement limited to `api.supabase.com` and
updates startup notes; it has not been published. Saving those fields does not
execute them or publish the environment. The setup script
installs locked dependencies, checks Chromium, runs the consolidation audit,
offline tests and lint, then compiles the source frontend. Startup instructions
point to the local backend/development commands above and distinguish them from
the separate hosted-lab build. Local services and the development server need
explicit startup after a snapshot restore; their current health was not
re-established during this hosted-preflight continuation.

## Remaining work before hosted poker sessions

1. Supply a Supabase account access token through the secure
   `SUPABASE_ACCESS_TOKEN` requirement in environment settings, limited to
   `api.supabase.com`. The restored environment has no saved management token;
   the public browser settings are already working. Never paste the token in chat.
2. Run `npm run inspect:lab` to inspect the actual lab schema/history/functions,
   reconcile the retained generated
   candidate, and configure the intended test hostname and confirmation/recovery
   redirects. No hosted readiness can be inferred from the older staging docs.
3. After a separately authorized lab deployment, verify signup/login, two-player private
   cards, reconnect, free timebank and chip conservation on that actual host.
   Deliberate Superadmin assignment and explicit bot provisioning precede any
   bot sessions; no bots are created merely by deployment.
4. Keep full typecheck debt visible before calling the release production-ready.
   The current work targets a private tester-chip site, not paid gaming.
