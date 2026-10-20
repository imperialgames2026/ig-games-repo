# Verified catalog and record isolation — 2026-10-20

Staging `qonqemhljgxlwpghkxhn` now has **90 recorded migrations and 29 functions**.
The added recorded migration is
`20261020215129_verified_practice_catalog_and_record_isolation.sql`. Its SHA-256
matches the CLI-created implementation. The full backend readback file includes
the new recorded migration; no function version or JWT setting changed here.

The original approved catalog admitted only Dice. It now admits exactly the
15 distinct games already backed by reviewed practice handlers, through explicit
backend/route pairs. The 16th approved page is a Blackjack alias. Constraints
still prohibit paid wagers, nonpractice games and browser catalog writes. This
does not enable any of the remaining 28 blocked game pages.

The public library now links all seven verified single-player games as well as
the existing eight multiplayer games. Signed-in catalog reads use the dedicated
Supabase table. Game cards prefer the validated catalog route, fixing Crash's
old slug mapping to the blocked Rocket page. External URLs, mismatched game/route
pairs and nonpractice records cannot supply a validated catalog route.

Read-only inventory found the staging `app_records` table empty. The older policy
allowed ownerless rows to every signed-in user. That policy now uses the same
owner/canonical-admin boundary as the later policy. Existing owner/admin reads
remain available. Public game content comes from the explicit catalog, rather
than inferring public access from absent ownership. No imported records were
deleted or reassigned.

The live rollback suite passed ownerless/other-owner denial, both owners' reads,
canonical administrator reads, anonymous denial, the 15-game catalog, rejection
of mismatched backend/route pairs and browser-write denial. Fixtures rolled back.
The isolated full Supabase runner includes this as its 13th SQL suite. The earlier
legacy wallet/admin tests now supply canonical roles and current JWT claims,
matching the newer authorization implementation rather than weakening it.

Full Base44 migration, historical customer import, production cutover and actual
financial provider execution remain unfinished. The real customer export and
source inventory are still needed; see `BASE44_EXPORT_INPUTS.md`.
