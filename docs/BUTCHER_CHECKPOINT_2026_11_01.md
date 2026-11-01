# Butcher checkpoint — November 1, 2026

## Playable client

The active Unity project is `/home/imperialist85/Documents/ChatGPT/Unity Builds/Butcher`, Unity 6000.3.6f1 with URP 17.3.0. It has third person movement, a tactical camera option, distance-triggered grass footsteps, campsite props, three imported tree variants and an exploration objective (memorial → gateway → campfire).

An appearance catalog maps `knight`, `scout`, and `spellweaver` IDs to prepared animated models. Unknown visual IDs are rejected. Visual choice is independent of authoritative combat statistics. The in-game Characters panel can preview these appearances and provides lab sign-in, list/create/select operations. Passwords and access tokens stay in memory for the Play session.

The client source checkpoint is under `unity/Butcher`. Purchased third-party asset files are retained in the active local project and Unity download cache, rather than copied into this repository checkpoint. Restore the named packages and run the supplied editor preparation tasks to rebuild prepared art assets.

## Lab backend

- Target: `IG Network Lab tests`, project `jvyzpxjqmymafjapprpp`.
- Private schema/table: `ig_campaign_v1.characters`.
- Migration: `20261101150932_butcher_campaign_characters_v1.sql`. Created through `supabase migration new`; its filename was aligned to the deployment history version returned by Supabase.
- Endpoint: `/functions/v1/butcher-characters`, deployed version 3, JWT verification enabled.
- Only its trusted service client can execute the character RPCs. Public/anonymous/authenticated direct table access and RPC execution are revoked.
- Character creation derives user identity from verified Auth, validates the starting score array and skill choices, derives appearance/family symbols on the server, limits accounts to ten heroes, and handles retries with stable request IDs.

Poker tables and `lab-poker` were not changed. No production/staging game project, wallet balance, crypto key, wager, or NFT transfer was changed.

## Item and skill structure

`loadout.ts` separates versioned item definitions from inventory instances and equipment slots. It checks account ownership, chain verification state, family symbols, level, skill/subskill rank, content version, slot compatibility, listing state, and active encounter locks. Practice items are non-transferable. These are pure eligibility rules; inventory transactions, chain ownership verification, minting, consumable burns, marketplace settlement, and item equip APIs are still pending.

An NFT references a known item/skill definition. It never supplies executable game code or an authoritative bonus. Active matches must use a versioned loadout snapshot.

## Verification

- Campaign rules/handler/loadout checks: `npm run test:campaign`.
- Migration and backend packaging checks: `node --test tests/migrationVersions.test.mjs tests/backendPackaging.test.mjs`.
- Database transactional verification: `supabase/tests/butcher_characters.sql`; inserted data rolls back. Verified stable retries, one row per request, conflicting-payload rejection, ownership isolation, and denied client privileges.
- HTTP: unsigned POST rejected with 401; OPTIONS succeeded with 204.
- Security advisor: no new campaign findings. Existing lab notices remain, including intentional internal-table no-policy notices and leaked-password protection being disabled.
- Unity runtime evidence and results are recorded by `Tools/verify_camp.py` in the active project. The account panel reached the deployed lab endpoint from Unity; frame advancement, humanoid initialization, all three appearance swaps, unknown-ID rejection, objective order and repeat rejection passed with zero current console errors/warnings. The user subsequently signed in, created/selected a hero, and a fresh server list returned that same selected hero.

## Remaining user input

The character create/list/select test passed with the user signed in. The next authenticated test is the inventory flow: select the saved hero, open Equipment and skills, claim the practice kit, equip an allowed item, refresh, then restart Play and confirm it remains equipped. This requires the user to sign in to the **lab** account inside Unity. Do not paste credentials into chat or store them in source files. The client uses the lab's publishable key, not a service key. Main-site and lab Auth user sets may differ.

Full gameplay networking, detailed character creation, equipment UI, NFT ownership verification, marketplace flows, combat integration and Android packaging remain development work.

## Inventory checkpoint — November 1, 2026

Migration `20261101162708_butcher_inventory_v1.sql` adds a private versioned item catalog, practice instances, one-time starter claims, loadout revision and encounter locks. The CLI-generated filename was aligned with the version recorded in the lab migration history. The character endpoint is deployed as version 2 and now supports authenticated inventory, starter claim, equip and unequip actions with strict field validation.

The database serializes mutations per account and locks the hero row. Slots, ownership, state, compatibility symbols, level, skill/subskill ranks and duplicate skills are checked inside the transaction. Replacement releases the prior item atomically. Stale revisions require refresh. Starter claims are repeat-safe. Practice items have no monetary value and cannot be transferred; SQL currently accepts only practice inventory sources.

The Unity Characters panel exposes Equipment and skills after selecting a saved hero. It can claim the practice kit, inspect compatibility symbols, equip a weapon or coat, use three skill slots and unequip items. Inventory loads from the server when the hero is selected. Visible gear attachments and combat effects are still pending.

Validation: 21 campaign/handler/loadout tests and 2 packaging/migration tests passed. `supabase/tests/butcher_inventory.sql` passed transactional checks for claim idempotency, ownership isolation, stale revision rejection, atomic replacement, symbols, ranks, duplicate skills, encounter locks, asset locks, unequip, slot rejection, listed-item rejection, level checks and subskill thresholds. Test writes rolled back. The deployed endpoint returned OPTIONS 204 and unsigned POST 401. Advisors reported no new campaign security findings; pre-existing lab notices remain. The inventory screen's rendering fixture is explicitly unauthenticated and performs no server writes; it is not evidence of a completed authenticated inventory journey.

## Visible equipment and detailed prerequisites

The client now attaches the catalogued sword/staff to the humanoid hand and an original travel cloak to the chest. An appearance change rebinds equipment, and an accepted inventory reply updates the visuals. Clearing selection/signing out removes them. Unknown definition IDs or versions do not resolve to arbitrary assets. The cloak is a rigid prototype over the base outfit; cloth simulation, complete armor replacement, attack poses and combat effects remain pending.

The character endpoint version 3 adds public descriptions, named unlocks and array-form skill prerequisites/ranks for Unity JSON parsing. Original database values are retained. Client requirement hints explain missing levels, symbols, training, duplicate skills and item states; the transaction remains authoritative. Skill labels appear in the world HUD for the equipped skills returned by the server.

The new `verify_equipment.py` exercises local presentation fixtures only, including bone parenting, all appearance rebinds, replacement/clear and unknown IDs/versions. No authenticated inventory test is claimed by those fixtures. The campaign test suite now has 23 checks, plus 2 migration/packaging checks. Full signed-in inventory save/restart verification remains outstanding.
