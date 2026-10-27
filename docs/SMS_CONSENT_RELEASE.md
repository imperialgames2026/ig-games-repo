# Consent-only release candidate

Base main: `080d8a984fa9012a226129bb42e07411eeb7bf3e`. Extracted only the reviewed SMS registration/preferences, persistence proposal, handler and focused tests from integration `87c4b8d17a298c3dd2369387a8a67e3befda92b7`. No poker/game/Android/Realtime/financial changes, policy rewrites, dependency changes, or global deployment-manifest changes.

## Confirmed hosted prerequisite

Read-only inspection of `qonqemhljgxlwpghkxhn` (`imperial-games-staging`, ACTIVE_HEALTHY) found Auth users, profiles and canonical roles, but no `ig_sms_consent` schema, either consent RPC, or `sms-consent` Edge function. Website configuration references this project. Its name is staging; no claim is made that a separate production project was found.

## Exact approval boundary — not executed

The package in `sms-consent-release-package.json` is pending action-time approval before hosted application:

- Create private `ig_sms_consent.events` and `current_state`, with RLS and no direct PUBLIC/anon/authenticated/service_role table access.
- Create two postgres-owned SECURITY DEFINER functions with empty search_path and fully qualified references. Revoke PUBLIC/anon/authenticated EXECUTE and grant EXECUTE only to existing service_role. No new roles, credentials, ADMIN OPTION or Realtime changes.
- Deploy only `sms-consent` with JWT verification enabled. The handler verifies confirmed actual Auth identity and derives the actor server-side. The new endpoint records/revokes consent but cannot send SMS. No Twilio or provider integration.
- Audit records retain the consent target phone, timestamp, affirmative action, disclosure version/hash and method while the account exists. The revised two-layer SQL erases ALL per-user consent rows when an approved hard or soft Auth deletion occurs, in the same transaction; failure rolls back the Auth deletion. There is no invented duration or phone tombstone. No new account-deletion API is exposed.

Additional revised approval scope: private postgres-owned SECURITY DEFINER `guard_event_delete()` and `cleanup_deleted_auth_actor()` trigger helpers (no PUBLIC/client/service EXECUTE); private invoker `guard_auth_restore()`; guarded event DELETE; Auth `consent_auth_soft_delete` and `consent_no_auth_restore` triggers; cascade FKs, existing-soft-deleted cleanup and locked status/mutation checks. The Auth restore trigger rejects clearing `deleted_at` or changing the ID of ANY already soft-deleted Auth row. It does not claim protection against privileged recreation of a hard-deleted UUID after all consent data is erased; that operation is unsupported. Other application FKs may still block whole-account deletion.

## Release order

1. Refresh main, hosted metadata and exact package hashes. Stop on existing/conflicting consent objects; do not overwrite them.
2. After explicit approval, apply ONLY BOTH hash-pinned consent SQL layers atomically using a named migration and verify ownership/ACLs/RLS/empty search_path. Do not invoke the global staging deployment workflow: it can apply unrelated pending KYC changes and Auth configuration.
3. Deploy ONLY the two-file SMS function package, JWT verification true. Verify unauthorized requests fail and SMS provider actions remain disabled. Do not create hosted test users or credentials without separate authorization.
4. Resolve the required CI boundary, then merge ONLY this release diff. Publish the exact frontend commit to the verified existing Cloudflare project and verify its live release commit and registration/policy routes. Keep the UI held until its backend exists.
5. Vercel backup status is not proof of a Cloudflare/live release. Read-only GitHub checks identify Cloudflare Pages project `ig-games-repo`, account `b0f78a0a9473389471cb176bc2c05991`, successful main deployment `b0579956-b049-4ebd-8d93-695a21587e30`. Both its preview and custom-domain release.json returned403, so live served contents/backend environment still require verification. Repository configuration and historical inspected-build evidence identify `imperial-games-staging` as the intended backend; do not invent a separate production target.

## CI scope

Existing PR checks run synthetic KYC metadata/header guards and a mocked comparison-failure worker test; source inspection shows they do not load face models or perform identity matching. The standing prohibition remains actual identity matching and real personal evidence. Ordinary relevant synthetic checks may run without weakening existing gates. No skip-CI flags, denied extra verification branches, credential changes or gate removals are part of this release.

## Failure handling

If the SQL transaction fails, roll it back. If a backend/verification step fails, keep frontend/main unchanged. For active accounts, preserve audit history; do not drop/reset/delete tables to roll back. Approved account deletion intentionally erases that actor’s consent records through the guarded cleanup contract. Restore only a captured compatible frontend artifact if needed, while preserving withdrawal access and leaving SMS disabled. Any change to hosted grants is a separate explicit security action.
