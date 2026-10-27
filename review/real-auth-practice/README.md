# Real Auth practice dependency closure — source review only

No runtime, migrations, user creation, container pulls or listeners were run.
This candidate is NOT a replacement for the approved platform/Auth setup and
is deliberately separate from native SQL/PGlite bootstrap files.

## Ordered closure and boundaries

1. Site owner supplies the pinned, reviewed fresh platform roles and actual
   GoTrue runtime. Real GoTrue v2.197.0 migrations own `auth.users`, identities,
   sessions and helpers. Official commit `4eee58f296d9698a1c2c0ae14d7a0b379c7622d3`
   includes `20220224000811_update_auth_functions.up.sql` (uid/role/email) and
   `20220531120530_add_auth_jwt_function.up.sql` (jwt). Independently inspected
   official raw source: these helpers read request JWT claims; they do not
   validate JWT signatures themselves. PostgREST/Auth must validate actual
   signatures and role switching. Do not create constant-service-role helpers
   or overwrite GoTrue schema. Runtime definition/ACL/signed-token tests remain
   necessary. Earlier concern helpers might be absent is resolved by this source
   evidence; actual startup has not been observed.
2. Run owner `assert-auth-platform.sql` after real migrations. Our app schema
   separately fails closed unless users/identities/sessions and uid/jwt helpers,
   canonical anon/authenticated roles and nonsuperuser+BYPASSRLS service_role
   exist. Existing profiles/user_roles abort rather than being overwritten.
3. `app-schema.sql` creates minimal dedicated-lab public profile/role tables,
   own-read RLS, no end-user mutation grants, and private fixed-player signup
   trigger. Trigger uses only actual new.id/email, ignores editable role claims
   and grants no chips/assets. Schema contains fields required by existing
   `lib/identity.js` plus display/avatar queries. `kyc_status='unverified'`
   is a display fixture, never a financial authorization or KYC success.
4. Replay the explicitly SHA-pinned39 game files in existing order. No background
   cron schedules execute. Original native runner/PGlite bootstrap is excluded.
5. Additional mandatory Poker snapshot dependency: recorded social table SQL.
   PlayerStats adds archive/facts dependencies. Completed-hands DDL is the exact
   prefix of recorded coaching migration **before** unrelated coaching receipt
   ALTER; no fake coaching table is created. Include recorded analytics SQL
   after that prefix. Source hashes/extraction marker are pinned in manifest.
   Archive/facts tables are initially empty; no archival/analytics worker is
   fabricated, so those outcomes are not accepted just because queries succeed.
6. `after-game-schema.sql` models intended service-only public game caller
   privileges in this fresh lab and keeps payment_enabled=false. It rejects
   wallets/transactions/IGN schemas. No end-user game mutation grant or private
   audit access is added. These are explicit **local test-schema permissions**
   for review, not hosted security changes or a production migration.
7. Append separately reviewed, still-unapplied ledger/seat/binding/resolver
   proposals. They remain excluded from active manifest/release. Resolver
   proposed Edge entrypoint remains separate and is not in owner's seven-handler
   gateway allowlist; baseline test stack cannot claim resolver HTTP acceptance.
8. Only AFTER signup trigger installation, create synthetic accounts via actual
   local GoTrue admin HTTP (owner fixture creator); capture returned UUIDs. No
   INSERT into auth.users, fabricated identity/session rows or static passwords.
   Approved local operator separately provisions canonical tester/superadmin/
   exclusion flags. Metadata such as full_name never assigns permissions.

## Offline artifact commands

```bash
python3 -m unittest discover -s review/real-auth-practice -p test_closure.py
python3 review/real-auth-practice/build_bundle.py
```

Builder verifies39game+2additional source hashes, exact archive extraction and
4proposal hashes, then writes `../real-auth-practice-staged-review.sql` as a
single transaction **source artifact only**. It has no database client or
execution path. Do not apply that artifact until provider/resource/runtime,
source-review and isolated schema execution approvals are explicit. Source
changes require manifest refresh and independent review, never silent fallback.

## Actual eight-engine fixture and accounting oracle plan

`engine-fixtures.json` maps eight games to actual existing handler payloads,
actor aliases, stable request IDs and authoritative round/version bindings.
It is a descriptor, not executed user creation or a settlement simulator. Use
actual HTTP-created users/tokens; do not substitute mocked identities. Two-player
Poker/Omaha must use actual turn actor; card/controller and house-clock games
must honor returned phases. Crash/Trenball share native runtime/pool. No Slots,
Originals or Mines routes are added. No actual financial schema is installed.

For each actual HTTP accepted wager, record actor/UUID/game and expected native
posting count/delta from that action's documented semantics, then repeat exact
request and prove ledger unchanged. `accounting-oracle.sql` is an optional
privileged local test-operator query requiring a nonempty actual request trace
and the installed private ledger; it checks matching posted deltas, all live
balances against journal, nonredeemable assets and zero tournament fee records.
It never exposes audit tables to players or returns PASS for absent trace.
Supplied trace is test expectation, not trusted client financial authority.

Still required beyond this oracle: per-game initial grants; escrow+pot matching;
actual controller/house settlement and payouts; failed/unauthorized requests
producing no rows; refund/cancellation/operator policy; independent sessions and
rollback; free registration/repeated seating/consolidation; disconnect/rejoin.
Implicit grants and house ticks use native transaction correlation, so the
request-ID oracle does not falsely label them covered. Structural counter_delta
balance is not fairness/payout-economics proof. Source owner's browser flags
must remain false until observed phase-specific settlement/ledger assertions
pass over the actual approved runtime.

## Unresolved setup/acceptance

No actual GoTrue migration, role defaults, signup trigger, RLS or Edge/REST/JWT
journey has run. Source owner owns pinned images, runtime/import cache acquisition
and platform initialization review; no installed JS version may silently replace
handler imports. Realtime, Storage, KYC, profile editing and application pages
outside the minimal identity/eight-game slice are not included. Full application
compatibility is not claimed. No services/persistent credentials/downloads or
hosted writes are authorized by this document. Publish/deploy remains gated.
