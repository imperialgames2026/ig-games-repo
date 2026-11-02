# Butcher

An Imperial Gaming 3D fantasy video game in memory of Randy Butcher.

## Play the prototype

Open this project with Unity **6000.3.6f1**, let package restoration finish, open `Assets/Butcher/Scenes/Camp.unity`, and press Play.

WASD/arrows move, Shift runs, right mouse orbits, Tab changes camera, E interacts. Touch controls are also provided. Press C or **Characters** to open the character panel; Escape or **Return to the world** closes it.

The camp includes imported trees, a chest, firepit, torches, grass footsteps, three animated appearance previews, and a memorial → gateway → campfire exploration objective. This is an early playable prototype using stylized owned assets.

## Saved characters

The Characters panel connects to **IG Network Lab tests**, project `jvyzpxjqmymafjapprpp`. Check the lab connection, sign in with an existing lab account, then create or select a hero. Main-site accounts may differ from lab accounts. Passwords and access tokens remain in memory for the Play session; signing out clears the client session. Sessions currently require sign-in again after expiration.

Character creation uses four original origins and archetypes with suggested level-one attributes/skills. The server validates the build, derives identity and compatibility symbols, and stores the character. Appearance previews are cosmetic. Exploration remains local; selecting a character does not yet connect combat, progression, inventory, or rewards.

Only a public publishable key is included in the client. No service-role credentials belong in Unity.

## Graphics and assets

URP 17.3.0 provides desktop and mobile starting profiles. Final high-definition visuals and performance still require art direction, lighting, optimization, and target-device testing. The first standalone Linux build succeeded (107,238,046 bytes; zero build errors/warnings). Startup probes passed both headless and with OpenGL initialized. Interactive standalone play and Android packaging remain pending.

Owned package sources are kept in the Unity download cache. The active project contains Footsteps Pack Expanded, DEVTRICKED Forest Survival Starter Pack Lite, POLY STYLE Platformer Starter Pack, PolysplitGames LowPolyMedievalFantasyHeroes, Kevin Iglesias Human Melee Animations, and a Nature Starter Kit 2 ground texture. Do not move or overwrite vendor metadata casually.

`Tools/EditorTasks/PrepareHero.csx` and `BuildAppearanceCatalog.csx` regenerate prepared hero assets through the live editor. `Tools/verify_camp.py` verifies the stopped editor, live frames, lab connectivity, menu presence, humanoid initialization, all appearance swaps, unknown-ID rejection, objective sequence, and current console errors. It stops its own Play session and writes timestamped reports under `Verification`.

## Backend and source checkpoint

The backend and authored Unity source checkpoint are in `ButcherBackend`, branch `feature/imperial-campaign-rpg-mvp`, draft PR #76. The deployed lab character service uses private `ig_campaign_v1.characters`. Poker was not changed. The lab now provides private practice inventory and atomic equip/unequip APIs. NFT eligibility rules also exist as pure code; chain verification, marketplace settlement, minting and gameplay combat integration remain pending.

The repository checkpoint excludes purchased source assets and generated copies of their animation data. The active local project retains them. See the checkpoint's RESTORE instructions before restoring on another machine.

## Equipment and skills

After signing in and selecting your hero, press C again and choose **Equipment and skills**. Claim the one-time **practice starter kit**, choose Weapon, Armor or a Skill slot, then equip an available compatible item. Use Refresh inventory to reload saved state. The kit includes both compatible and incompatible choices so symbol/training restrictions can be tested. Unequip an item before assigning it to another hero. Practice items are non-transferable.

The server validates ownership, slot, level, compatibility symbols and skill/subskill training. Loadouts and assets can be locked for encounters. Conflicting changes require refresh; requests do not silently overwrite a newer loadout. Saved sword/staff attachments and the travel cloak now appear on the animated character. The cloak is a rigid prototype layer over the base outfit. Combat effects remain pending.

## Equipment visuals and verification

`Tools/EditorTasks/PrepareEquipment.csx` prepares the owned sword/staff references and an original travel cloak, then builds a local visual whitelist. `ButcherWorld.ApplyEquipmentVisuals` renders only recognized definition/version/slot combinations. Sign-out, hero changes, and unequip clear the old visual; appearance previews rebind the saved loadout to the new rig. No item grants, stats or ownership are decided by these visuals.

`Tools/verify_equipment.py` starts its own Play session and checks attachment bones, all three appearances, replacement/clear, unknown IDs and versions, colliders, skill labels, and UI prerequisite hints. It uses explicit local fixtures and does not sign in or mutate inventory. Equipment and skill-details screenshots are saved in Assets/Screenshots.

`python3 Tools/build_linux.py` queues and observes a local Linux player build through Unity Pipeline. When available, run the resulting player with `python3 Tools/verify_linux.py` for an opt-in startup probe that checks the scene, humanoid, visual catalog, attachments, HTTPS reachability and rejection of unsigned requests, then exits. This probe never signs in or writes to the lab. Graphical play and saved inventory restoration still need hands-on verification.

## Camp trial

After signing in and selecting your saved hero, close Characters and choose **Camp trial**. The hero resumes an active saved trial when selected. In the arena, WASD/arrows step, F attacks and Space ends the turn. Buttons provide the same actions; Tab switches camera. Refresh recovers server state after a connection interruption. Leave trial abandons it; Return to camp exits a completed trial.

The lab decides positions, range, hits, damage and enemy turns. Repeated requests return saved results, and gear is locked during a trial. This first trial supports weapon attacks and grants no progression or rewards. Skill combat actions are still pending. The five-foot grid uses 1.524 metres per tile in the scene.

`Tools/verify_trial.py` checks presentation with explicit fixtures and no account or lab writes. Run `Tools/EditorTasks/PrepareCombatAnimation.csx` after preparing the hero assets when restoring this checkpoint. Native startup verification also checks the trial controller, attack state and both lab endpoints. Authenticated interactive trial play still needs hands-on verification.
