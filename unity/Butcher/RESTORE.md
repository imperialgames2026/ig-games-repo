# Restore the authored Unity checkpoint

The full working project is retained locally as `Unity Builds/Butcher`. This repository contains authored scripts, graphics profiles, scene references, project settings, and preparation/verification tools. It excludes purchased asset payloads and generated animation copies. A checkout alone will therefore use fallback geometry or show missing art references until restored.

1. Open with Unity 6000.3.6f1. Allow package restoration (URP 17.3.0 and Pipeline 0.9.1-exp.1).
2. Restore the owned source packages using their original Unity metadata: Footsteps Pack Expanded; DEVTRICKED Low-Poly Forest Survival Starter Pack Lite (URP); POLY STYLE Platformer Starter Pack (URP); PolysplitGames LowPolyMedievalFantasyHeroes (BaseMale, M_Knight, M_Rogue, M_Mage and materials); Kevin Iglesias Human Melee Animations (male Idle01, Walk01_Forward, Run01_Forward); Nature Starter Kit 2 ground texture. Match the vendor paths named in the preparation tasks.
3. Open `Assets/Butcher/Scenes/Camp.unity`, stopped in Edit mode. Run `Tools/EditorTasks/PrepareHero.csx`, then `BuildAppearanceCatalog.csx` and `PrepareEquipment.csx` through `Tools/editor_task.py --script <absolute task path>`. These create the excluded prepared hero assets and bind the scene's appearance catalog, trees and skybox.
4. Reassign the chest, firepit, torch, ground texture and eight grass single-step audio references on the Camp bootstrap if the package metadata did not resolve them. The full local scene is the reference for those assignments. Save the scene.
5. Run `python3 Tools/verify_camp.py` on the computer hosting the open editor. This requires the authenticated Unity CLI on PATH at `~/.local/bin/unity` and a reachable Pipeline server. It starts/stops its own Play session. Do not run while someone is playing.
6. Use Characters → Check lab connection → Sign in to test a lab account. Do not paste passwords into chat. The publishable client key is intentionally public; service keys must remain server-only.

Generated art IDs will change on a clean restoration; the preparation tasks rebind the scene and catalog. This is a source checkpoint, not a distributable game build. Screenshots and current Play reports are retained in the active local project; a sanitized passing report is included in `Verification` when available.

The equipment checkpoint includes original travel-cloak geometry/material plus authored sword/staff wrapper prefabs that reference the owned package. Third-party weapon mesh payloads are excluded. `PrepareEquipment.csx` regenerates the local visual catalog and references.

Linux builds can be queued with `python3 Tools/build_linux.py` on the editor host. The helper saves the current scene first to avoid Unity waiting on a modal prompt. Run `python3 Tools/verify_linux.py` after a successful build for the opt-in headless startup/HTTPS check. This does not verify graphical play or authenticated inventory.

Camp Trial: run `PrepareCombatAnimation.csx` after the hero/catalog preparation steps to restore the owned one-shot attack clip and its transition. `verify_trial.py` renders explicit local presentation fixtures and performs no authenticated mutations. Its screenshots do not prove a signed-in trial lifecycle.

Combat skills: `verify_skills.py` checks labelled local Spark/Ward presentation fixtures, resource validation and empty-trial resume. It performs no authenticated mutations. Equip the compatible practice skill before starting a new trial; existing trials preserve their frozen loadout. Keys 1/2 use Spark/Ward when available.

Combat readability: `verify_feedback.py` checks the health displays and accepted hit/miss/skill cues, sentinel attack presentation, replay suppression and fresh-arena cleanup. It uses local fixtures without signing in or writing to the lab. Feedback art is original runtime geometry; no additional asset package is required.
