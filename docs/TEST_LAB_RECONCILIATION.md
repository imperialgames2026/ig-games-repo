# Inspect the existing lab before proposing deployment

The confirmed lab `jvyzpxjqmymafjapprpp` already exposes some application tables,
while public probes cannot reach the candidate game/support functions or the
newer game catalog and announcements. This is evidence of partial setup, not
permission to replay a fresh schema onto it.

[`scripts/inspect-test-lab-management.mjs`](../scripts/inspect-test-lab-management.mjs)
compares that existing project with the retained
`/workspace/ig-test-lab-candidate`. It reads files and remote metadata only. It has
no apply, repair, deploy, delete or project-switch option, and does not regenerate
the candidate or change the historical staging scripts.

## Required access and command

The inspector requires a valid `SUPABASE_ACCESS_TOKEN` supplied securely through
environment settings with Management API access to `api.supabase.com`. Public
browser keys cannot provide this access. Do not paste credentials into chat or
command arguments. A missing token prevents all requests.

Once that access is available:

```sh
cd /workspace/ig-games-repo
npm run inspect:lab -- \
  --candidate=/workspace/ig-test-lab-candidate \
  --output=/tmp/ig-lab-reconciliation.json
```

The output must be a new local file outside the source and candidate directories.
The npm alias enables Node's environment proxy support for the managed runtime.
Omitting `--output` prints the same safe report. The inspector never contacts an
arbitrary project. Requests are limited to project/Auth/function metadata GETs,
function-source GETs, and four fixed SELECT queries through
`POST /database/query` with `read_only: true`.

## What the plan establishes

Before any request, it verifies original and pending manifests, every recorded
source checksum, generated SQL/function bytes, explicit project substitutions,
the exact tester-function allowlist, exclusions and JWT-only lab configuration.
The retained artifact is checked without being recreated.

The remote comparison then:

- Inventories migration history and public relation/routine names. Empty or
  absent history alongside existing objects requires reconciliation; it cannot
  become a fresh-project replay plan.
- Compares recorded migration SQL with the generated lab bytes, including the
  lab-specific avatar URL constraint. Unknown versions, changed or unavailable
  SQL, duplicates and gaps block a rollout proposal. It never repairs history.
- Checks hosted handler source bytes and JWT settings against the generated
  candidate. A metadata GET before and after each source download detects
  concurrent changes. Unknown/excluded handlers, changed bytes, missing source
  proof and configuration drift require reconciliation.
- Reports missing candidate migrations/handlers for human review. Missing
  entries alone do not establish that applying them is safe.
- Summarizes Auth URL origins and approved booleans only. Raw Auth settings,
  SMTP/provider credentials, access tokens, migration SQL, handler bodies and
  remote error text are never written to the report.

Public object names are inventory evidence; the inspector does not claim full
column, policy or routine-definition parity. Unknown structures or conflicting
history need a reviewed forward migration or another explicit reconciliation
decision before a separate deployment proposal.

Exit status `2` means reconciliation or a required read remains unresolved.
Status `0` means the read-only comparison completed without those blockers; it
does not mean the site is deployed or ready for player sessions. Status `1`
means configuration, candidate validation or command usage failed. Every report
states that no remote mutations occurred and that it authorizes no application.

Fixture tests run without credentials or network:

```sh
node --test --test-isolation=none tests/testLabManagementPlan.test.mjs
```

The existing [backend candidate guide](TEST_LAB_BACKEND_CANDIDATE.md) describes the
98-migration/21-handler artifact. The new inspector supplies the missing
existing-project comparison; it does not execute that artifact.
