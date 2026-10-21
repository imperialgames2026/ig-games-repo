# Practice release readiness follow-up

Reviewed October 21, 2026 (America/New_York). This follows the owner's pasted
readiness review for **https://imperialgaming.llc** and its selected backend,
**imperial-games-staging**, `qonqemhljgxlwpghkxhn`. It does not retarget the
separate **IG network lab tests** project `jvyzpxjqmymafjapprpp`.

The current public release matches current main, and source/CI/public checks
pass. Privileged backend and recovery gates remain blocked by HTTP 401 from
the configured management access. No hosted operation is proposed yet.

Final refresh still finds main and the public release at `6be0f67`. The unchanged
Node verifier passes again. A separate Python urllib metadata request returned
403; that transport-specific failure does not establish a site outage. The final
observations retain both results. All 1,132 frozen source files and all 133
candidate files were rechecked without changes.

## Current source and published release

- Frozen main: `6be0f674c103e789dbfa3fc08e1ed97fd4650940` (PR33 merged after PR32).
  The pasted review's `1a58d9064775297b297bacbc6de6a5beae21cf05` is an earlier release.
- Immutable source tree: `6a750ced18df4cfb0d2f407e2ef54af9439abc2e`.
  PR33's tested head `1997bbc7437e90f3f7744f50292655adfc2d2d1b` has this identical tree.
- The frozen source archive is `/tmp/ig-release-review-6be0f67-source.tar`,
  SHA256 `8041226af517e1b0f0012334adb1c1c2699bf3894ea0c53ce7312d757ed23971`.
  Source-only extraction: `/workspace/ig-release-review-6be0f67`.
- Backend package verification passes for **101 migrations / 30 functions**.
  Source manifest SHA256:
  `861967a8f186f6ae89c9b5a45dd641ee5a3a2819a12781c0a0f7541e1acf85c8`.
- A fresh production build produces `/assets/index-CqfT6O_H.js`, 1,851,762 bytes,
  SHA256 `f6f270818debe3056843e469b9d1f0a57395a03cff89940855ac7604d0b880de`.
  The live JavaScript has the identical bytes and hash. The build explicitly
  used the frozen source's public staging defaults rather than inherited lab settings.
- Published metadata reports this exact main SHA, practice mode, the selected
  staging backend, legacy operations disabled, 101 reviewed migrations and
  23 held games. Its build timestamp is `2026-10-21T03:34:02.952Z`.
  A metadata migration count is not a hosted migration-history readback.

## Verification and remaining gates

| Check | Result |
| --- | --- |
| Fresh offline tests on frozen main | **147 passed**, zero failures or skips. |
| Fresh package and production build | Pass; original manifest/source checksums validated, live JS reproduced byte for byte. |
| Current merge-head CI | All six checks and the Vercel combined status successful. Build, browser UI, payment browser and local-backend jobs passed on exact main. |
| Complete integration | PR33 run passed offline tests, isolated migration replay, transactional SQL tests, real authenticated Edge Functions and public/authenticated browser suites. Its source tree is identical to merged main. These are existing CI results, not a newly executed local full-service suite. |
| Published verifier | Six SPA routes returned 200 with the same app asset: `/`, `/Games`, `/login`, `/ResetPassword`, `/AMOE`, `/PrizeClaims`. |
| Anonymous browser smoke | **12 desktop/mobile checks passed**; no page errors or horizontal overflow. Protected routes redirected to sign-in and absent recovery tokens failed closed. Writes and external telemetry were blocked. |
| Public Auth connectivity | HTTP 200; email signup enabled, email confirmation required. No live signup or email delivery test was performed. |
| Current hosted migration SQL and complete function-source parity | **Blocked: management HTTP 401.** The earlier review's captured SQL and function metadata cannot establish current parity. |
| Auth site URL/redirects, API exposure, Storage configuration/policies and current advisors | **Unverified.** Auth/PostgREST/Storage management reads return 401; earlier RLS/advisor observations remain historical evidence. |
| Backup availability, PITR and recovery window | **Unverified: management HTTP 401.** No backup was created, downloaded or restored. |

Current CI evidence:

- [Exact-main build and real local backend](https://github.com/imperialgames2026/ig-games-repo/actions/runs/39539244834).
- [Exact-main desktop/mobile smoke](https://github.com/imperialgames2026/ig-games-repo/actions/runs/39539244804).
- [PR33 full integration, identical source tree](https://github.com/imperialgames2026/ig-games-repo/actions/runs/39538849889).
- [PR33 package preparation](https://github.com/imperialgames2026/ig-games-repo/actions/runs/39538849776)
  passed; its deployment job was skipped. CI artifact digest metadata is retained
  in the source/CI report; archives were not downloaded or independently rehashed.

## Reviewable artifacts and pending operations

The separately assembled candidate is
`/workspace/ig-practice-release-candidate-6be0f67/`. Its
`practice-candidate-report.json` records every file hash and the exact source.
The candidate was assembled offline; it has not been applied to any project.

The source manifest declares no pending migrations or functions. Current hosted
pending operations are **not established**, because fresh privileged inventory
is unavailable. Do not infer a no-op backend from public metadata, replay
recorded SQL, redeploy for appearance, or reuse an old pending announcement
filename. There is no front-end publication needed to reach the reviewed SHA:
the public release already matches it.

The new [read-only backend checker](../scripts/check-practice-release-backend.mjs)
compares every manifest migration and every function's full source file set,
JWT/status/version metadata and before/after drift observations. It uses the
repository's exact SQL reconstruction comparator. It has no apply/deploy path.
It is distinct from the lab-targeted inspector.

After management access is corrected, run it against the frozen source with a
new output path:

```sh
npm run check:practice:backend -- \
  /workspace/ig-release-review-6be0f67 \
  6be0f674c103e789dbfa3fc08e1ed97fd4650940 \
  /tmp/ig-practice-backend-recheck.json
```

Its 13 offline fixtures pass, including complete source comparisons, drift,
HTTP 401 redaction, output preservation and fixed read-only request scope.
It reserves a new report file before reads and refuses existing outputs.
The preserved lab draft's full offline suite also passes **183 tests** with the
new fixtures included, and lint passes. That draft count is separate from the
147 tests run on frozen published main.

## Access needed to close the review

`SUPABASE_ACCESS_TOKEN` now has a saved binding to `api.supabase.com`; the runtime
variable is present. Binding readiness remains `unknown`. Both Python and
Node's environment-proxy transports reached the management path and received
HTTP 401. This does not establish whether the credential itself or its delivery
is the cause; no secret value was inspected. Retained diagnostics contain no records.

Verify the secure binding contains a valid **Supabase personal account access
token** with access to this project, rather than a browser or service-role key.
Keep its value in secure environment settings. After access works:

1. Read migration history and all deployed function bodies against the frozen
   manifest, then recheck history/function metadata for concurrent changes.
2. Read back Auth origins/redirects, API exposure, Storage policies and backup/PITR
   availability. Record only metadata needed for review; do not access player rows.
3. Refresh main and the public release. If either advanced, establish the new
   baseline and rerun only the checks affected by that change.
4. Produce the exact pending operation packet, including SQL/source hashes,
   JWT flags and explicit Auth edits. If nothing is pending, report a verified
   no-op. Any later hosted changes require separate authorization.

No database, function, Auth, provider, credential or hosting setting was changed.
No accounts, bots, customer imports or hosted player/game actions were created.
The existing lab draft and candidate were preserved; no previous application
changes were reapplied, and nothing was pushed or published.

## Evidence

- [Frozen source, fresh checks and CI](reports/practice-release-20261021-source-ci.json).
- [Published identity, asset and browser smoke](reports/practice-release-20261021-published.json).
- [Public Auth settings](reports/practice-release-20261021-public-auth.json).
- [Blocked Auth/API/Storage/recovery metadata reads](reports/practice-release-20261021-auth-recovery.json).
- [Backend comparison status](reports/practice-release-20261021-backend-parity.json).
- [Candidate file hashes](reports/practice-release-20261021-candidate.json).
- [Final identity refresh and regression checks](reports/practice-release-20261021-final-refresh.json).
