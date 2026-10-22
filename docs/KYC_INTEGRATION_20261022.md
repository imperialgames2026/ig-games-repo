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

Predeployment head `560a0a2672174f37a815fa0b16c9a9dda9c4f313` passed run 39808612547: 154 Node tests, four worker tests, full 104-migration replay, 22 transactional SQL suites, 52 public-browser and 31 authenticated tests. Real local services verified upload integrity, cross-account denial, direct table/RPC/storage denial, worker leases, human approval, unchanged wallets and expired-evidence deletion. Other exact-head build, browser, payment, local-backend and desktop/mobile smoke jobs passed.

Hosted KYC SQL was applied atomically only after all 103 previously recorded migrations matched the canonical SQL hashes. SQL SHA-256: `c0c73ee4a4092b0929f6b1049ebd61e96220a3a48403f1b8a9b1d0a2ebd45b38`. Readback: 104 migrations, private bucket, anonymous/authenticated RPC EXECUTE denied and service-role EXECUTE allowed. `ig-kyc-v1` v1 is active with JWT verification and both source files exactly match the reviewed source. Anonymous HTTP access returned 401. The scoped Mini-Imp worker completed a hosted cycle and its heartbeat was read back. Its systemd user timer runs every minute, is enabled at boot, and user lingering is enabled so logout does not stop it. The verified service exit status is zero. No hosted customer records or evidence were opened for testing. Real user lifecycle acceptance was performed locally, not with fabricated claims of hosted customer testing.

The security advisor has no KYC findings. One informational no-policy finding belongs to the concurrent private wallet-allocation table; its client schema/table privileges are revoked, and KYC does not add access policies to that unrelated table.

The pinned models load and reject synthetic blank images. This does not validate biometric accuracy or liveness. Worker credential expires October 22, 2027; replace it before expiry and revoke its old hash. Monitor the worker heartbeat and timer; physical cleanup waits if Mini-Imp is offline.

New SQL identity: `20261022153018_secure_kyc_intake_review`. Package totals: 104 migrations / 31 functions. The concurrently recorded hosted wallet-allocation migration `20261022154537_imperial_wallet_staging_dual_allocation_slots` is preserved verbatim in the canonical inventory; it is already deployed by another workstream and is not applied again by KYC. The KYC SQL, function and scoped worker registration are deployed. Frontend publication follows the final CI check and merge. Preserve current frontend/function source for rollback; use a reviewed forward SQL fix, never erase live data or migration history.

Concurrent hosted history also includes `20261022154824_lower_staging_treasury_approval_threshold_to_1000`, which changes the allowed threshold constraint to positive values. Its exact recorded statement is inventoried, not re-applied; KYC does not alter treasury policy values or activate financial execution.
