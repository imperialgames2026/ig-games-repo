# Imperial Campaign RPG — implementation foundation

**Branch:** `feature/imperial-campaign-rpg-mvp`  
**Base:** `main` at `080d8a984fa9012a226129bb42e07411eeb7bf3e`  
**Status:** Product foundation plus pure server-side rules and encounter-action modules. See [the rules contract](./IMPERIAL_CAMPAIGN_RPG_RULES_CONTRACT.md), [data and action boundary](./IMPERIAL_CAMPAIGN_RPG_DATA_BOUNDARY.md), and `supabase/functions/_shared/imperial-campaign/`. No schema deployment, playable route, NFT transaction, or wager flow has been enabled.

## Product target

Add an Imperial Gaming fantasy RPG to the existing Imperial Games client. Players download the existing Android app from the Imperial Gaming site, sign in through the existing Supabase account, create a character, explore a small world, gather materials, and enter short missions. Later releases add party campaigns, competitive trials, NFT loadouts and crafting, a player marketplace, and IGN token wagers.

The game honors Randy Butcher, whose love of D&D inspired it. Any personal details or tribute content must come from Nate’s memories; do not invent them.

## Interaction and camera

- Use a compact 3D environment with a third-person exploration camera.
- Switch to a raised tactical camera for turn-based combat; spectators see the full match overview by default.
- The player performs actions directly. The server rolls required dice and applies the rules. A brief animation and optional result breakdown can show the outcome; no manual dice handling is required.
- Make narration skippable and optional. The AI Game Master acts primarily as director, rules explainer, and narrator; player actions, outcomes, rewards, and match state are resolved by trusted server code.

## First playable slice

1. Sign in with the existing Imperial Gaming account.
2. Create and save one character with an original origin/species, archetype, attributes, skills, and starter equipment.
3. Enter one small free-roam hub. Move, inspect objects, gather a small set of materials, and see skill-gated alchemy recipes.
4. Start one short solo mission with a clear objective, a small tactical encounter, and a completion reward.
5. Resume after disconnect or app backgrounding.
6. Show a spectator-safe overview for a completed or active mission; never expose private player controls or hidden state.

Use non-transferable practice inventory and rewards until the server rules, persistence, and replay are proven. Co-op, NFT mint/trade, and wagering are later gates.

## Candidate rules contract

This is a structured starting point for an original Imperial ruleset, not a final balance decision.

- Store attributes, proficiency, skills, abilities, equipment, and effects as versioned content definitions.
- Candidate ability modifier: `floor((score - 10) / 2)`.
- Candidate check: server rolls a d20, adds the relevant ability modifier and any earned skill/tool proficiency, then compares against a server-selected difficulty target.
- Candidate attack: server rolls a d20 plus the relevant attack modifier against the target’s defense value.
- Advantage/disadvantage: roll two d20s and keep the higher/lower result. Never stack extra d20s for multiple sources of the same state.
- An effect definition must specify prerequisites, compatibility tags, action/resource cost, target and range, check/save formula, success/failure result, damage/healing, duration, stacking, and removal/cure rules.
- Use explicit event records for every accepted action, roll, condition change, resource change, and reward. Pin each mission to a rules/content version.
- Final formulas and progression tables must be reviewed and frozen before online competitive trials.

## Backend and integration boundaries

- Canonical source is `imperialgames2026/ig-games-repo`; the generated `.site-preview` directory is not an edit target.
- The existing `IG Network Lab tests` Supabase project (`jvyzpxjqmymafjapprpp`) is the chosen campaign lab target. It already contains the poker lab, so campaign tables and backend files will use their own `ig_campaign_v1` schema and `imperial-campaign` code directory. Poker tables, functions, and records remain untouched. The separate `imperial-games-staging` project (`qonqemhljgxlwpghkxhn`) remains untouched.
- Reuse Supabase Auth and player profiles. Campaign characters are distinct from account profiles.
- All mutation endpoints derive user identity from the authenticated session. Clients submit action intent; server code loads the character, validates prerequisites, generates random values, resolves effects, writes an ordered event, and returns the public projection.
- Give each public table an explicit RLS policy and each private/server-only table an explicit no-client-access contract. Do not add broad policies to silence the existing advisor findings.
- Use idempotency keys for action submission and sequence IDs for reconnect/replay. Realtime carries state updates; persisted events remain the source for recovery and replay.
- The AI Game Master receives a filtered state snapshot and returns schema-validated narration/choice text. It cannot edit authoritative state or adjudicate math.
- Keep the campaign behind authentication and a reviewed route gate until its backend handler and privacy filters are accepted.

## NFT, crafting, market, and token gates

- A recipe requires a defined alchemy skill tier, exact ingredient IDs/quantities, and a versioned result definition.
- Ingredient consumption and output creation must be atomic/idempotent. Decide whether consumed NFTs are burned or marked consumed by a controlled program.
- Verify NFT ownership on a trusted server path. Snapshot equipped assets when a mission starts.
- Listing an NFT locks it from equip, crafting, consumption, and duplicate listings. Delisting restores use; sale transfers ownership once.
- Add Solana asset and marketplace flows only after simulated inventory transactions are reliable.
- Add wager escrow and IGN token settlement only after completed match replays and outcome reconciliation are reliable.

## Acceptance gates

- Character creation and invalid loadouts are server-validated.
- Duplicate/replayed actions do not duplicate rolls, items, materials, XP, or rewards.
- Every result can be reconstructed from the saved rules version and event sequence.
- Disconnect, app pause, retry, and AI timeout leave the authoritative match intact.
- Spectator payloads contain only intended public state.
- Android layout is touch-friendly at common phone aspect ratios; narration can be skipped and the tactical view remains legible.
- No production feature, marketplace transfer, or wager becomes active by adding client UI alone.

## Current implementation checkpoint

The branch now contains pure server-side d20, weapon damage, and encounter action resolvers. The encounter module validates player ownership, revision, grid movement, attack range, and turn use; it also resolves a basic server-controlled hostile turn. The modules are not called by an Edge Function and have no database persistence or client integration. Idempotency, encounter storage, additional player actions, and the Android route remain to be implemented. The code has not been compiled or tested.
