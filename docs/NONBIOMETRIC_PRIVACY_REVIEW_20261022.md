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
  (MIT license selected), in addition to byte/dimension limits, PNG CRC/chunk
  integrity, complete RIFF bounds, animation rejection and terminal file checks.
  The codec receives a 24-megapixel allocation limit and orientation disabled so
  decoded dimensions must match the bounded header. No identity or face analysis
  is performed. ImageScript is a dev dependency for identical local fixtures;
  the Edge import uses the same exact npm version. It has no dependencies.
- Refreshing submission history also refreshes the verified account profile.
- A standalone deletion-only Python client needs no image or model dependencies.
  It uses the existing authorized deletion endpoint and continues after individual
  failures. Cleanup removes predictable unfinalized keys as well as recorded
  evidence; cancelled drafts cannot be purged while upload grants remain valid.

Local evidence (synthetic data only):

- Nine Node tests: grant ordering and cancellation/exclusion, cursor validation,
  metadata authorization, traversal of 153 equal-timestamp submissions, failed
  and repeated cleanup, complete solid-color PNG/JPEG/WebP decoding, malformed
  payload rejection, and backend checksum packaging.
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
