# Imperial Games independent Android release plan

Status: **NOT READY FOR PUBLIC APK RELEASE** (2026-10-17). This is a release gate, not a claim that the app has passed verification.

## Source of truth
- Application integration branch: `integration/casino-zip` in `imperialgames2026/ig-games-repo`. Keep `main` unchanged until checks pass.
- Supabase staging project: `imperial-games-staging` (ref `qonqemhljgxlwpghkxhn`). Do not confuse with the separate older Supabase project.
- `casino-zip` holds an archive; do not deploy the archive as a working application.
- React/Vite web app is **not** automatically an Android APK. Choose a maintained Android wrapper (e.g. Capacitor) or a native Unity shell after web build and security tests are passing.

## Release blocking requirements
- [ ] Migrate all production-needed Base44 operations to authenticated and authorized Supabase handlers. The adapter currently blocks unverified legacy calls by default: do **not** enable `VITE_ENABLE_LEGACY_EDGE_FUNCTIONS` for release.
- [ ] Validate least-privilege RLS, role enforcement, owner/admin/tester restrictions, server-only settlement, idempotency, replay defenses, and audit logs with negative tests; RLS enabled alone does not prove policy correctness.
- [ ] Reconcile balances and player funds in staging under concurrency, retries, error paths and partial failures. Never enable real-value gameplay until legal and security reviews are completed.
- [ ] Integrate Sumsub through server-side applicant/session creation and authenticated webhooks; never store raw ID/selfie imagery in general-purpose app tables or client logs.
- [ ] Separate developer test credits from anything redeemable; document identity, age and geographic eligibility rules, licensing and regulatory counsel approval.
- [ ] Confirm auth, logout, deep links, user-set-once name restrictions, account deletion, accessibility and privacy policy work on Android.
- [ ] Run clean install, lint, typecheck and production build in CI; add integration tests, dependency audit and vulnerability remediation. **A successful compile is not approval to launch.**
- [ ] Select Android application ID and keystore owner, build a signed release APK with reproducible pipeline, preserve signing keys outside GitHub, generate SHA-256 and version metadata. Do not commit signing keys.
- [ ] Test direct-download HTTPS URL, SHA-256 display, Android install flow, device compatibility, rollback and in-app update notice. Never silently sideload an update.
- [ ] Publish only after explicit release approval, penetration testing and any applicable gambling/sweepstakes/payment requirements.

## Distribution architecture
GitHub (source and CI) -> audited React/Unity Android build -> signed versioned APK -> private release staging -> HTTPS website download. Supabase remains server-side; Cloudflare can host public static assets and downloads. A Play Store listing is optional, but direct distribution does not waive laws or Android platform security requirements.

## Immediate priority
Audit every call to `base44.functions.invoke` and legacy `app_records` writes; map each to its real Supabase Edge Function/RPC and security tests. Then run the existing `verify-app-build`, `frontend-integration-audit` and `staging-wallet-security` workflows and inspect results before merging.
