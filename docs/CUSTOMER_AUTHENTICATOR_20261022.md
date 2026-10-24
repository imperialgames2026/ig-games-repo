# Customer authenticator two-step verification

Reconciled with current main and release candidate `8e16f8ed5cd8c47b89cb404480756a43b5161b18` for the owner-selected backend `qonqemhljgxlwpghkxhn`. Older project `icwzqdbibhnrtjahfzsx` is excluded.

Customers can opt in from Profile Settings using a standard TOTP authenticator. Supabase generates factor secrets and validates codes. Imperial Games supplies enrollment, sign-in challenge, backup-factor and removal screens. No Twilio SMS or phone-MFA paid add-on is needed. Existing users are not forced to enroll.

An enrolled password-only session cannot resolve the app identity or access private data. A new restrictive policy checks the current actor's verified factors for every reviewed public RLS table and `storage.objects`. Actor-bound IGN and VIP-wheel definer entry points enforce the same rule. All 31 customer/operator session Edge Functions validate the exact bearer token through Auth before checking its assurance level. The signed Fireblocks machine webhook is unchanged. Existing ownership, canonical roles, exclusion and practice-mode restrictions still apply.

Each Edge bundle contains a generated copy of `lib/serverMfa.js` so its reviewed deployment remains self-contained. Regenerate with `node scripts/sync-mfa-guards.mjs`; update manifest hashes deliberately afterward. Tests check every copy and verify each handler rejects enrolled AAL1 sessions before database calls. Future public tables and session handlers must include the same boundary.

## Account recovery

Users can enroll a separate backup authenticator and use it to remove a lost primary factor. Removing a factor requires a fresh verified code. The last factor's removal explicitly warns that two-step verification will be disabled. Password reset is not an MFA bypass. No automated support override, custom recovery token, or recovery-code implementation is introduced. If every factor is lost, owner-approved identity recovery and audited factor removal remain an operational process to define before public launch; do not promise automatic recovery.

## Deployment order

1. Pass offline tests, browser contracts, isolated full SQL replay, transactional MFA authorization tests, and real local Auth/Edge/browser MFA acceptance.
2. Recheck hosted SQL/function drift and recovery readiness. Confirm TOTP enrollment and verification are enabled for the selected Auth project.
3. Apply only `customer_authenticator_mfa` SQL and the 31 changed functions. Preserve JWT verification settings. The frontend must not be published ahead of these backend checks. Do not run a broad apply workflow that also changes Auth redirect URLs.
4. Read back SQL identity/checksum, restrictive policies and source hashes. Run advisors. Record deployed identities and versions in the manifest before merging the frontend release.
5. Verify the published exact SHA and the account flow. No hosted accounts, real customer files, billing changes, provider messages or financial operations are needed for isolated acceptance.

The still-unapplied MFA migration was regenerated with the CLI as `20261024011225_customer_authenticator_mfa.sql` so its restrictive policies also cover the newer KYC and slot tables during a clean replay. This branch packages 113 migrations and 32 functions. PR68 backend changes remain a dependency; hosted MFA has not been deployed. Deployment status must not be inferred from package assembly or frontend build success.

## Supabase storage budget

Owner stated willingness to spend $100/month on Supabase for storage including KYC. Use $100/month as the conservative planning ceiling until total versus incremental spend is clarified. No billing changes were made. The selected project’s Imperial Gaming LLC organization is already on Pro (confirmed through the connected organization API).

On October 22, 2026, published Pro pricing starts at $25/month, including 100 GB file storage, with additional file storage at $0.0213/GB-month. Compute, egress, other projects and add-ons also affect the bill; this is not a fixed $100 hard cap. Source: https://supabase.com/pricing . TOTP MFA is free to use: https://supabase.com/docs/guides/auth/auth-mfa/totp .

Read-only inspection confirms `kyc-documents` is private, has no configured file-size/MIME limits, and has no client storage policies. The separate `ig-kyc-evidence` integration and retention release are documented in `MAIN_PUBLISH_ACCEPTANCE_20261024.md`; this older bucket is not used as its public upload target. No public KYC access or customer-data import is authorized by the budget alone.

## October 24 reconciliation

Preserves current Unity prototype, profile actions, all KYC privacy protections and the held-slot guard. KYC machine-worker authentication remains separate; customer KYC uses the same generated session guard. All 211 offline application/MFA tests passed locally before the migration was resequenced. Hosted Auth settings and lost-all-factors recovery remain release gates; do not infer activation from this draft.

## Current release reconciliation

The dependency is tested PR68 head `8e16f8ed5cd8c47b89cb404480756a43b5161b18` on main `608cc1e214fab880a5fe9c187380ce4725dca214`. Preserve the recorded roulette identity `20261024024944` and its checksum, the exact 20 approved active catalog entries, 23 held routes, and KYC retention protections. The pending MFA migration identity and bytes are unchanged; roulette adds no new RLS table after it. The aggregate test list includes both MFA and current Unity suites. This draft does not activate MFA, hosted policies, recovery operations or device releases; hosted Auth/callback verification, audited lost-all-factors recovery, and device acceptance remain separate gates.
