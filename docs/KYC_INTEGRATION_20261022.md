# Private KYC intake and human review

Target: `qonqemhljgxlwpghkxhn` only. Base: main `998878f3332a483cb5a42028f1bf0362fdcb363d`. No customer data import; legacy KYC bucket and other projects untouched. Backend must be deployed before publishing this frontend.

Customer `/KYCVerification`: authenticated consent, minimum identity fields, private ID front/back and selfie uploads, submission history, reviewer feedback and cancellation. Optional facial-comparison consent is independent of manual review. Files are immutable, bounded to 8 MiB / 24 MP, checked by actual image headers and hashed server-side. Signed uploads permit creation only. A cancelled/expired draft's deterministic keys are included in cleanup even if submission was never finalized.

Admin `/AdminKYC`: separate private review queue alongside existing read-only compliance data; audited 60-second evidence links, scalar advisory comparison, required independent authenticity/selfie/age/liveness checks, reason, customer-facing message, optimistic revision checks and no self-approval. Decisions update canonical identity status; they never transfer funds or change wallet balances. Existing country, exclusion, financial and native release gates remain intact.

New bucket `ig-kyc-evidence` is private and has no client policies. All three new tables deny direct anonymous/authenticated access. The public RPC is SECURITY INVOKER, executable only by the service role. The Edge function validates the exact user JWT, rejects anonymous sign-ins, requires AAL2 when a verified factor exists, reads current canonical role/exclusion state and accepts only enumerated fields/actions. Worker credentials grant comparison and expiration cleanup only; no service key goes to Mini-Imp or browsers.

Retention defaults to 30 days from submission creation. Expired evidence is immediately unavailable to reviewers and queued for deletion. The worker deletes Storage objects through the Storage API and then scrubs identity name/date of birth and comparison results; minimal decision/audit metadata remains. Cleanup also waits for the last two-hour signed upload token to expire, preventing recreation after cancellation. If the worker is offline, physical deletion waits; monitor its heartbeat. This is an operational default, not a legal retention determination.

## Boundary of this implementation

Face similarity is not calibrated identity probability, liveness, document authenticity or legal eligibility. Model matching is optional advisory processing for a human, with no threshold that approves or rejects customers. No biometric embeddings/landmarks are stored. There are no verified document reference images in the current source; references must be checked with the issuing authority. External approved-document export remains disabled because no destination has been selected. These are visible limitations, not passed production-verification claims.

The existing MFA PR40 is independent and is not silently deployed by this change. This KYC handler already honors verified-factor AAL2, but it does not enroll factors or change hosted Auth configuration.

## Release evidence

Pending isolated SQL, real local Auth/Storage/Edge/browser checks, model-loading verification and exact-head CI. Do not claim hosted rollout or completed biometric/liveness validation from unit tests alone. Hosted synthetic verification, if used, must use disposable synthetic accounts and non-identity images; never inspect real customer evidence to test a release.

New SQL identity: `20261022153018_secure_kyc_intake_review`. Package totals: 104 migrations / 31 functions. The concurrently recorded hosted wallet-allocation migration `20261022154537_imperial_wallet_staging_dual_allocation_slots` is preserved verbatim in the canonical inventory; it is already deployed by another workstream and is not applied again by KYC. Pending hosted operations: that SQL, `ig-kyc-v1`, a scoped worker-hash registration and the frontend release. Preserve current frontend/function source for rollback; use a reviewed forward SQL fix, never erase live data or migration history.

Concurrent hosted history also includes `20261022154824_lower_staging_treasury_approval_threshold_to_1000`, which changes the allowed threshold constraint to positive values. Its exact recorded statement is inventoried, not re-applied; KYC does not alter treasury policy values or activate financial execution.
