# Non-biometric privacy review checkpoint

Base: PR50 merge `6e8618c3859fa83445ab4f7cc049ff57f41de301`.
Reviewed open PR49 at `864c9d0a3d23a70e662a076496d364030d252962`;
its post-issuance authorization recheck is preserved in `issueUpload` and the
profile refresh from `69a5e73bcffc89ac958e426970f3a436210033ca` is brought into
`KycSubmission`. No other PR49 changes are integrated. Main and PR49 were
re-fetched before this checkpoint; no newer overlapping owner change was found.
No AGENTS.md or checkout .agents/skills instructions were present in this saved
environment. The existing work branch was clean and is preserved.

Changes:

- Signed upload grants remain immutable and are returned only after a second
  current-authorization RPC. Successful reauthorization extends the existing
  cleanup fence after issuance completes, including slow Storage calls.
- Reviewer queue uses a bounded 25-row UI page, explicit status filtering and a
  `(created_at,id)` descending cursor. Pending submitted/escalated work is the
  default. Service-side reviewer/exclusion authorization is checked using the
  existing RPC before selecting only queue metadata. No schema change is needed.
- Submission now performs full raster decoding with pinned ImageScript 3.3.0
  (MIT license selected) for PNG/WebP and jpeg-js 0.4.4 (BSD-3-Clause) for JPEG, in addition to byte/dimension limits, PNG CRC/chunk
  integrity, complete RIFF bounds, animation rejection and terminal file checks.
  The codecs receive a 24-megapixel allocation limit (JPEG also has a 160 MiB
  allocation budget and tolerant decoding disabled), and orientation is disabled so
  decoded dimensions must match the bounded header. No identity or face analysis
  is performed. ImageScript is a dev dependency for identical local fixtures;
  the Edge imports use the same exact npm versions. Neither has dependencies.
- Refreshing submission history also refreshes the verified account profile.
- A standalone deletion-only Python client needs no image or model dependencies.
  It uses the existing authorized deletion endpoint and continues after individual
  failures. Cleanup removes predictable unfinalized keys as well as recorded
  evidence; cancelled drafts cannot be purged while upload grants remain valid.

Local evidence (synthetic data only):

- Ten Node tests: grant ordering and cancellation/exclusion, cursor validation,
  metadata authorization, traversal of 153 equal-timestamp submissions, failed
  and repeated cleanup, complete solid-color PNG/JPEG/WebP decoding, malformed
  payload rejection (including truncated JPEG entropy with an appended end marker),
  and backend checksum packaging.
- Four Python deletion-client tests, including repeated cycles, partial failure,
  private config permissions, symlink refusal and no model imports/network calls.
- Two intercepted browser tests: customer status refresh/cancellation and reviewer
  pagination/filtering. All external requests are intercepted or blocked.
- Disposable network-isolated PostgreSQL 17 regression loads only the local KYC
  schema with synthetic supporting tables. It exercises cancellation, exclusion,
  upload fences, expiry eligibility, repeated batch cleanup and denied browser RPC
  access. It does not execute comparison actions. This is not full schema replay.
- Website build and diff whitespace validation pass. Backend packaging retains
  all 104 migration checksums; only the proposed function manifest hashes change.

CI isolation: checkpoint commit contains `[skip ci]` because existing broad PR
workflows execute comparison tests and Android-related checks outside this task.
A separate read-only `Non-biometric privacy review` workflow runs on creation of
this review branch or its dedicated `verify/nonbiometric-privacy-20261022-*`
verification ref and checks out its exact source SHA. A verification ref points
to the same commit as the draft PR; it permits a fresh scoped run after a
checkpoint without triggering the excluded broad PR suites. It runs the scoped
checks above and builds the website. Existing workflows and eligibility guards
are unchanged. Skipped broad checks must not be described as full certification.
Remote results and exact source SHA are recorded in the draft PR/task handoff.

Remaining release gates:

- No hosted function/migration deployment, production publish, merge, credential
  changes, Android work or financial enablement was performed.
- Hosted Edge runtime/memory/CPU acceptance of the decoder at maximum dimensions
  and real local Supabase Storage/PostgREST integration are still required under a
  separately authorized non-biometric test plan. Node decoding and isolated SQL
  are not substitutes for those runtime checks.
- The existing server RPC limits deletion batches to ten and excludes already
  purged rows. The new client is independently runnable but is not installed or
  scheduled. Physical deletion still depends on an operator running a client.
- Outstanding signed URLs cannot be revoked by this patch. The existing 121-minute
  fence protects the normal two-hour token window; extreme in-flight Storage
  completion beyond that fence remains a service-integration acceptance gate.
- No comparison tests, face models, real IDs, selfies or customer records were
  accessed. Biometric code paths are unchanged and untested.

References: [Supabase signed upload lifetime](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl),
[ImageScript codec API](https://github.com/matmen/ImageScript),
[GitHub create event](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#create).
The Supabase changelog markdown could not be fetched in this environment (403);
the documented two-hour signed upload contract was verified directly.

The first remote run (39853130979 at 5aa8336) passed all Node/Python tests but
exposed a disposable-Postgres initialization race before SQL execution. The
follow-up waits for TCP inside the network-isolated container, rather than the
temporary initialization Unix socket. Browser/build steps in that first run
were skipped, not passed.

Run 39853337833 passed the complete scoped suite at 540c125. An additional
synthetic corruption probe then found that ImageScript tolerated incomplete JPEG
entropy with an appended EOI. The final follow-up uses jpeg-js with tolerant
decoding disabled and adds the reproduced truncation regression. Earlier green
CI therefore does not certify the final codec change; exact-head CI is linked in
the draft PR.

## Follow-up review corrections (pending deployment)

The original refresh test proved client refresh only. The follow-up adds the
CLI-generated `20261022210709_kyc_profile_lifecycle.sql` (105th proposed packaged
migration) and a real PostgreSQL lifecycle regression. Drafts do not change the
profile. Submission sets `pending_review`; cancelling/expiring unresolved work
restores an independently recorded previous `verified`/`rejected` decision, or
`not_started` when none remains. A cancelled draft cannot erase approval. This
uses existing canonical `kyc_verifications` decisions; it never infers approval
from images or creates a verification decision. Reviewer outcomes retain the
existing RPC mapping. The trigger is service-only/security-invoker. Existing
pending submissions are backfilled; no hosted migration was run.

Queue rollout no longer requires atomic API/UI replacement. Calls without page
fields preserve the legacy array response. The new UI retries an old API's 400
response using the legacy request and prominently reports the 100-row limitation;
filters apply only to that bounded legacy set and pagination stays disabled.
Authorization failures never trigger the fallback. This supersedes the earlier
coordinated-rollout gate. Both mixed-version client behavior and database
lifecycle now have dedicated synthetic regressions.

## Local runtime and durable cleanup follow-up (supersedes earlier gates)

The current proposed package has 106 migrations. Migration
`20261022212136_kyc_retention_reconciliation.sql` retains minimal deletion
identifiers for indefinite hourly reconciliation. An actual Storage stream
started with a valid local signed token completed successfully after token expiry,
cancellation and purge: its object reappeared, proving the old finite fence was
insufficient. The new due queue rechecks purged rows. Real Storage deletion on
the next due sweep removed the late object; another sweep preserved absence,
the first deletion timestamp and exactly one audit event. The test compresses
only its generated local token lifetime to three seconds and advances fixture
schedules; it does not claim a production timing SLA. Scheduling, monitoring and
capacity/backlog acceptance remain operator gates.

`node scripts/test-kyc-core-stack.mjs` reproduces this using digest-pinned Auth,
Storage, PostgREST and Edge Runtime containers, disposable PostgreSQL and generated
local credentials. It verifies ownership and role denial, invalid JWT rejection,
private table/storage denial, actual PNG submission and manual-review profile
state, 131-row tied-timestamp pagination, legacy queue responses, status filtering,
malformed-image rejection and repeated late-upload cleanup. The harness cleans
up its own containers/network/staging files and accepts no hosted target.

The same runtime checks three successive synthetic PNG/JPEG/WebP decodes under
256MB memory and 2-second hard CPU worker limits. The original 24MP JPEG exhausted
memory. The accepted limit is now 4MP (still subject to the existing byte cap);
24MP files reject before decode. Solid 4MP formats and a seeded noisy 4MP JPEG
passed; the noisy JPEG three-decode run took about 1.26 seconds wall time locally.
This is bounded synthetic corpus evidence, not exhaustive decoder fuzzing or
hosted performance certification. Customers are instructed to resize larger
images. Dependencies are bundled offline from the lockfile into the actual Edge
runtime; no face models or biometric actions are loaded or exercised.

A complete Supabase CLI stack failed to unpack its PostgreSQL image with
`failed to register layer: no space left on device` in Docker storage. The default
registry also returned 403. Native npm loading in Edge hit the environment proxy's
UnknownIssuer; offline locked bundling avoided changing TLS/credentials/settings.
The successful core harness uses real Auth/Storage schemas but minimal supporting
profile/role/verification fixtures and only the three KYC migrations, with a local
streaming gateway. Full 106-migration replay and the platform gateway remain
unverified. Reproduce that gate on an adequately provisioned authorized isolated
runner, replay the full packaged migration chain, and repeat the model-free
runtime scenarios through its normal gateway before deployment approval.

Scoped CI now includes the core-stack harness. Broad comparison/Android suites
remain intentionally skipped. No hosted deployment, production publish, merge,
credential change, real customer access or biometric execution occurred.

Final concurrency check: main remained `6e8618c3859fa83445ab4f7cc049ff57f41de301`.
PR49 advanced to `ed6ba6cfcd27bd2abf2a1e355284438238032a86`; its applicable
post-issuance authorization and browser refresh changes are already represented
here. Its deployment inventory/documentation and broader tests were not imported
or used as evidence of this branch's deployment. PR51 remains independent; no
other owner's branch was changed.

Main advanced during final CI to `4676b5656a3f5038957449843f8651e9c15aab0d`
(PR49 merged). The review branch incorporates that main checkpoint; conflicts
preserve the tested shared upload helper (which includes both authorization
checks) and proposed function hashes/status. Main's existing deployed-version
inventory remains recorded, while this branch's changed function is explicitly
pending deployment. No biometric implementation bytes changed in this merge;
main's broader test file is retained but excluded from scoped execution.
The earlier concurrency snapshot is historical, not the final base.

## Full-platform CI acceptance route

After removal of all six task-owned disposable images, the local vfs pull still
failed. Failed layers were automatically released, recovering about 26.2GB free;
no shared volumes, user files or daemon settings were changed. No repeated local
pull is needed: `scripts/test-kyc-platform-stack.mjs` refuses vfs.

The scoped workflow now has an independent `full-platform` job on the existing
Ubuntu-hosted runner, with read-only repository permission and no secrets. It
uses the existing pinned Supabase CLI version 2.121.0, verifies all 106 migration
checksums, disables fixture seeding and serves only the bundled KYC handler with
JWT verification preserved. The actual CLI PostgreSQL migration ledger must
match all 106 versions before synthetic scenarios can run through normal local
Kong/Auth/Storage/PostgREST/Edge services. Full-schema signup triggers create the
profiles/roles; only generated synthetic users receive reviewer fixture roles.
No broad tests, comparison actions, models or hosted APIs are used.

Reproduction on a provisioned copy-on-write Docker runner:
`node scripts/test-kyc-platform-stack.mjs` after installing locked dependencies
and Supabase CLI 2.121.0. `--check` validates packaging offline without Docker.
Local preflight, syntax/lint and workflow YAML checks passed. Runtime acceptance
is determined by the exact-head CI result linked in PR51, not this preflight.
The earlier fixture-only evidence and local capacity report remain historical.

Hosted-runner follow-up: all 106 migration versions replayed successfully after
shortening the disposable project ID to avoid CLI hostname truncation. Normal
Kong also passed authenticated intake, denial checks, 131-row pagination/filtering,
malformed-file rejection and persisted submitted cancellation. Its buffered
upload path rejected the compressed expired token (no object reappeared), unlike
the unbuffered core reproduction. The full-platform test requires expiry-specific
rejection, then uses the original still-valid synthetic grant after advancing
only the fixture database fence to exercise actual post-purge object deletion.
That second case is not represented as an accepted post-expiry stream. The core
job retains the genuine post-expiry streaming regression. Both paths must pass
repeated reconciliation and preserve the first deletion audit/timestamp.

## Pre-rollout operational readiness (2026-10-23)

Fresh concurrency check retained main4676b56 and PR51head980ceb2; no competing
retention changes were present. The standalone client now verifies an explicit
`reconcile-v1` protocol marker and boolean deletion acknowledgement. An old or
rolled-back API fails visibly before cleanup instead of silently claiming that
indefinite reconciliation is healthy. The additive response retains legacy
`result` shapes; migrations still precede Edge, then client/scheduler rollout.
Frontend rollback is compatible; backend rollback must preserve the new retention
routing. Keeping only the migration while reverting Edge is insufficient.

Cycles now report aggregate selected/deleted/failed counts, batch saturation,
due-count lower bound and elapsed time with bounded failure codes. No identifiers,
provider exception messages, secrets or evidence are logged. A read-only health
query reports exact due count/age for an authorized operator; isolated core and
full-platform runs validate its fence/recheck semantics. Saturated failing batches
can still starve later work; this is exposed and documented, not claimed fixed.

Uninstalled systemd oneshot/timer templates provide an unprivileged, hardened
client using an existing protected configuration via LoadCredential. Runs are
completion-relative with a seven-minute process deadline. Static/offline parser
checks use only temporary synthetic paths; no unit, live schedule or credential
was created or activated. Host installation, monitoring destination/ownership,
acceptable backlog/due-age thresholds, and capacity remain operator decisions.
Python regressions cover rollback refusal, malformed queues, strict deletion
acknowledgements, saturation, safe failure logs and non-overlapping retry behavior.
