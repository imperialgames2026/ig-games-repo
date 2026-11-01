# Restore the authored Unity checkpoint

The full working project is retained locally as `Unity Builds/Butcher`. This repository contains authored scripts, graphics profiles, scene references, project settings, and preparation/verification tools. It excludes purchased asset payloads and generated animation copies. A checkout alone will therefore use fallback geometry or show missing art references until restored.

1. Open with Unity 6000.3.6f1. Allow package restoration (URP 17.3.0 and Pipeline 0.9.1-exp.1).
2. Restore the owned source packages using their original Unity metadata: Footsteps Pack Expanded; DEVTRICKED Low-Poly Forest Survival Starter Pack Lite (URP); POLY STYLE Platformer Starter Pack (URP); PolysplitGames LowPolyMedievalFantasyHeroes (BaseMale, M_Knight, M_Rogue, M_Mage and materials); Kevin Iglesias Human Melee Animations (male Idle01, Walk01_Forward, Run01_Forward); Nature Starter Kit 2 ground texture. Match the vendor paths named in the preparation tasks.
3. Open `Assets/Butcher/Scenes/Camp.unity`, stopped in Edit mode. Run `Tools/EditorTasks/PrepareHero.csx`, then `BuildAppearanceCatalog.csx` through `Tools/editor_task.py --script <absolute task path>`. These create the excluded prepared hero assets and bind the scene's appearance catalog, trees and skybox.
4. Reassign the chest, firepit, torch, ground texture and eight grass single-step audio references on the Camp bootstrap if the package metadata did not resolve them. The full local scene is the reference for those assignments. Save the scene.
5. Run `python3 Tools/verify_camp.py` on the computer hosting the open editor. This requires the authenticated Unity CLI on PATH at `~/.local/bin/unity` and a reachable Pipeline server. It starts/stops its own Play session. Do not run while someone is playing.
6. Use Characters → Check lab connection → Sign in to test a lab account. Do not paste passwords into chat. The publishable client key is intentionally public; service keys must remain server-only.

Generated art IDs will change on a clean restoration; the preparation tasks rebind the scene and catalog. This is a source checkpoint, not a distributable game build. Screenshots and current Play reports are retained in the active local project; a sanitized passing report is included in `Verification` when available.
