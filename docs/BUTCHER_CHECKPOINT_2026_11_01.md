# Butcher checkpoint — November 1, 2026

## Playable client

The active Unity project is `/home/imperialist85/Documents/ChatGPT/Unity Builds/Butcher`, Unity 6000.3.6f1 with URP 17.3.0. It has third person movement, a tactical camera option, distance-triggered grass footsteps, campsite props, three imported tree variants and an exploration objective (memorial → gateway → campfire).

An appearance catalog maps `knight`, `scout`, and `spellweaver` IDs to prepared animated models. Unknown visual IDs are rejected. Visual choice is independent of authoritative combat statistics. The in-game Characters panel can preview these appearances and provides lab sign-in, list/create/select operations. Passwords and access tokens stay in memory for the Play session.

The client source checkpoint is under `unity/Butcher`. Purchased third-party asset files are retained in the active local project and Unity download cache, rather than copied into this repository checkpoint. Restore the named packages and run the supplied editor preparation tasks to rebuild prepared art assets.

## Lab backend

- Target: `IG Network Lab tests`, project `jvyzpxjqmymafjapprpp`.
- Private schema/table: `ig_campaign_v1.characters`.
- Migration: `20261101150932_butcher_campaign_characters_v1.sql`. Created through `supabase migration new`; its filename was aligned to the deployment history version returned by Supabase.
- Endpoint: `/functions/v1/butcher-characters`, deployed version 1, JWT verification enabled.
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
- Unity runtime evidence and results are recorded by `Tools/verify_camp.py` in the active project. The account panel reached the deployed lab endpoint from Unity; frame advancement, humanoid initialization, all three appearance swaps, unknown-ID rejection, objective order and repeat rejection passed with zero current console errors/warnings. The account panel still needs an authenticated user test.

## Remaining user input

The final account test requires the user to sign in to an existing **lab** account inside Unity. Do not paste credentials into chat or store them in source files. The client uses the lab's publishable key, not a service key. Main-site and lab Auth user sets may differ.

Full gameplay networking, detailed character creation, equipment UI, NFT ownership verification, marketplace flows, combat integration and Android packaging remain development work.
