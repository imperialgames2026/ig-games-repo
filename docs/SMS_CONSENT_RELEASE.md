# Consent-only release candidate

Base main: `080d8a984fa9012a226129bb42e07411eeb7bf3e`. Extracted only the reviewed SMS registration/preferences, persistence proposal, handler and focused tests from integration `87c4b8d17a298c3dd2369387a8a67e3befda92b7`. No poker/game/Android/Realtime/financial changes, policy rewrites, dependency changes, or global deployment-manifest changes.

## Confirmed hosted prerequisite

Read-only inspection of `qonqemhljgxlwpghkxhn` (`imperial-games-staging`, ACTIVE_HEALTHY) found Auth users, profiles and canonical roles, but no `ig_sms_consent` schema, either consent RPC, or `sms-consent` Edge function. Website configuration references this project. Its name is staging; no claim is made that a separate production project was found.

## Exact approval boundary — not executed

The package in `sms-consent-release-package.json` is pending action-time approval before hosted application:

- Create private `ig_sms_consent.events` and `current_state`, with RLS and no direct PUBLIC/anon/authenticated/service_role table access.
- Create two postgres-owned SECURITY DEFINER functions with empty search_path and fully qualified references. Revoke PUBLIC/anon/authenticated EXECUTE and grant EXECUTE only to existing service_role. No new roles, credentials, ADMIN OPTION or Realtime changes.
- Deploy only `sms-consent` with JWT verification enabled. The handler verifies confirmed actual Auth identity and derives the actor server-side. The new endpoint records/revokes consent but cannot send SMS. No Twilio or provider integration.
- Audit records retain the consent target phone, timestamp, affirmative action, disclosure version/hash and method. These are persistent private personal-data records. The immutable audit/FK design blocks hard deletion of an Auth account with consent records until a separate reviewed retention/deletion process exists. This effect must be accepted or resolved before adoption; this source candidate invents no retention duration.

## Release order

1. Refresh main, hosted metadata and exact package hashes. Stop on existing/conflicting consent objects; do not overwrite them.
2. After explicit approval, apply ONLY the hash-pinned consent SQL atomically using a named migration and verify ownership/ACLs/RLS/empty search_path. Do not invoke the global staging deployment workflow: it can apply unrelated pending KYC changes and Auth configuration.
3. Deploy ONLY the two-file SMS function package, JWT verification true. Verify unauthorized requests fail and SMS provider actions remain disabled. Do not create hosted test users or credentials without separate authorization.
4. Resolve the required CI boundary, then merge ONLY this release diff. Publish the exact frontend commit to the verified existing Cloudflare project and verify its live release commit and registration/policy routes. Keep the UI held until its backend exists.
5. Vercel backup status is not proof of a Cloudflare/live release. No Cloudflare Pages project/deployment mapping was available from the repository or existing local CLI/session credentials during preparation. No credentials or settings were changed to obtain access.

## CI boundary

Current `.github/workflows/practice-release-validation.yml` runs `npm test` and `services/kyc-worker/test_worker.py` on every PR to main; those include facial-comparison tests outside this task's permission. No PR is opened that would trigger them. Existing gates are not weakened or bypassed, and no skip-CI or denied verification-branch workaround is used. Source branch publication and explicit non-biometric exact-head local checks remain allowed; main merge must wait for a permitted gate path.

## Failure handling

If the SQL transaction fails, roll it back. If a backend/verification step fails, keep frontend/main unchanged. Once actual consent records exist, retain their audit history; do not drop/reset/delete tables to roll back. Restore only a captured compatible frontend artifact if needed, while preserving withdrawal access and leaving SMS disabled. Any change to hosted grants is a separate explicit security action.
