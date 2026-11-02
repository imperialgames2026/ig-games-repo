using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

namespace Imperial.Butcher
{
    // Visual exploration only. Combat rolls, inventory and rewards belong to the server.
    public sealed class ButcherWorld : MonoBehaviour
    {
        [SerializeField] AudioClip[] grassFootsteps;
        [SerializeField] Texture2D groundTexture;
        [SerializeField] GameObject firepitPrefab, chestPrefab, torchPrefab;
        [SerializeField] GameObject heroVisualPrefab;
        [SerializeField] ButcherAppearanceCatalog appearanceCatalog;
        [SerializeField] string previewVisualId = "knight";
        [SerializeField] GameObject[] treePrefabs;
        [SerializeField] Material skyboxMaterial;
        [Serializable]
        public struct EquippedVisualSelection
        {
            public string definitionId;
            public int definitionVersion;
            public string slot;
        }
        EquippedVisualSelection[] equippedVisuals = Array.Empty<EquippedVisualSelection>();
        readonly List<GameObject> equipmentObjects = new List<GameObject>();
        ButcherEquipmentCatalog equipmentCatalog;
        string[] equippedSkillNames = Array.Empty<string>();
        public int EquippedSkillCount => equippedSkillNames.Length;
        public void SetEquippedSkillNames(string[] names)
        {
            var filtered = new List<string>();
            foreach (var name in names ?? Array.Empty<string>())
                if (!string.IsNullOrWhiteSpace(name) && filtered.Count < 3) filtered.Add(name.Length > 40 ? name.Substring(0,40) : name);
            equippedSkillNames = filtered.ToArray();
        }
        Animator heroAnimator;
        GameObject heroVisual;
        ButcherTrailObjective objective;
        ButcherCharacterMenu characterMenu;
        ButcherCombatController combat;
        CharacterController hero;
        Camera view;
        float yaw = 25f, verticalVelocity;
        bool tactical;
        Vector2 touchMove;
        GUIStyle title, caption;

        void Start()
        {
            Application.targetFrameRate = 60;
            var pipeline = Resources.Load<RenderPipelineAsset>(Application.isMobilePlatform ? "ButcherMobile" : "ButcherDesktop");
            if (pipeline != null) QualitySettings.renderPipeline = pipeline;
            QualitySettings.vSyncCount = Application.isMobilePlatform ? 0 : 1;
            RenderSettings.ambientMode = AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = new Color(.48f, .57f, .67f);
            RenderSettings.ambientEquatorColor = new Color(.26f, .31f, .26f);
            RenderSettings.ambientGroundColor = new Color(.13f, .12f, .10f);
            RenderSettings.fog = true;
            RenderSettings.fogColor = new Color(.39f, .48f, .51f);
            RenderSettings.fogMode = FogMode.ExponentialSquared;
            RenderSettings.fogDensity = .009f;
            if (skyboxMaterial != null) RenderSettings.skybox = skyboxMaterial;

            var sun = new GameObject("Evening sun").AddComponent<Light>();
            sun.type = LightType.Directional;
            sun.color = new Color(1f, .83f, .62f);
            sun.intensity = 1.6f;
            sun.shadows = LightShadows.Soft;
            sun.transform.rotation = Quaternion.Euler(32, -38, 0);
            RenderSettings.sun = sun;

            var grass = Material("Moss", new Color(.17f, .24f, .16f));
            var stone = Material("Weathered stone", new Color(.37f, .39f, .36f));
            var trail = Material("Trail", new Color(.37f, .29f, .20f));
            var bark = Material("Bark", new Color(.22f, .15f, .10f));
            var leaves = Material("Canopy", new Color(.12f, .25f, .17f));
            if (groundTexture != null)
            {
                grass.SetTexture("_BaseMap", groundTexture);
                grass.SetTextureScale("_BaseMap", new Vector2(64, 64));
                grass.color = new Color(.26f, .38f, .20f);
            }
            Shape("Clearing", PrimitiveType.Cube, new Vector3(0, -.5f, 0), new Vector3(240, 1, 240), grass);
            Shape("Old road", PrimitiveType.Cube, new Vector3(0, .01f, 4), new Vector3(5, .04f, 65), trail);
            for (int i = 0; i < 10; i++)
            {
                float z = i * 6 - 25;
                SpawnTree(new Vector3(-12 - i % 3 * 5, 0, z), i, bark, leaves);
                SpawnTree(new Vector3(12 + i % 4 * 4, 0, z + 2), i + 1, bark, leaves);
                SpawnTree(new Vector3(-32 + i * 7, 0, 34), i + 2, bark, leaves);
            }
            for (int i = 0; i < 4; i++)
            {
                float x = i % 2 == 0 ? -5 : 5;
                float z = i < 2 ? 12 : 22;
                Shape("Ruined pillar", PrimitiveType.Cylinder, new Vector3(x, 2, z), new Vector3(1.5f, 2, 1.5f), stone);
                Shape("Pillar cap", PrimitiveType.Cube, new Vector3(x, 4.1f, z), new Vector3(2, .4f, 2), stone);
            }
            Shape("Gateway lintel", PrimitiveType.Cube, new Vector3(0, 4.5f, 22), new Vector3(12, .7f, 2), stone);
            Shape("Memorial plinth", PrimitiveType.Cube, new Vector3(-6, .6f, 3), new Vector3(2, 1.2f, 2), stone);
            PlaceProp(firepitPrefab, new Vector3(5, 0, -3), 2.4f);
            PlaceProp(chestPrefab, new Vector3(-4, 0, -4), 1.5f);
            PlaceProp(torchPrefab, new Vector3(-3.5f, 0, 15), 2);
            PlaceProp(torchPrefab, new Vector3(3.5f, 0, 15), 2);
            var inscription = new GameObject("For Randy Butcher").AddComponent<TextMesh>();
            inscription.transform.position = new Vector3(-6, 2.4f, 3);
            inscription.text = "For Randy Butcher";
            inscription.fontSize = 48;
            inscription.characterSize = .06f;
            inscription.anchor = TextAnchor.MiddleCenter;
            inscription.color = new Color(1, .84f, .46f);

            var player = new GameObject("Hero");
            player.transform.position = new Vector3(0, .1f, -12);
            hero = player.AddComponent<CharacterController>();
            hero.height = 1.8f; hero.radius = .35f; hero.center = new Vector3(0, .9f, 0);
            hero.stepOffset = .3f;
            player.AddComponent<ButcherFootsteps>().Configure(hero, grassFootsteps);
            if (!ApplyHeroAppearance(previewVisualId))
            {
                var body = Shape("Placeholder hero", PrimitiveType.Capsule, Vector3.up * .9f, new Vector3(.65f, .9f, .65f), Material("Hero cloak", new Color(.28f, .12f, .37f)));
                body.transform.SetParent(player.transform, false);
                Destroy(body.GetComponent<Collider>());
            }
            objective = player.AddComponent<ButcherTrailObjective>();
            characterMenu = gameObject.AddComponent<ButcherCharacterMenu>();
            characterMenu.Configure(this);
            combat = gameObject.AddComponent<ButcherCombatController>();
            combat.Configure(this, characterMenu);
            view = new GameObject("Third person camera").AddComponent<Camera>();
            view.tag = "MainCamera";
            view.fieldOfView = 58;
            view.nearClipPlane = .15f; view.farClipPlane = 180;
            view.allowHDR = true; view.allowMSAA = true;
            view.backgroundColor = RenderSettings.fogColor;
            view.clearFlags = skyboxMaterial != null ? CameraClearFlags.Skybox : CameraClearFlags.SolidColor;
            view.gameObject.AddComponent<AudioListener>();
        }

        public bool ApplyHeroAppearance(string visualId)
        {
            var prefab = appearanceCatalog != null ? appearanceCatalog.Resolve(visualId)
                : visualId == "knight" ? heroVisualPrefab : null;
            if (prefab == null || hero == null) return false;
            var replacement = Instantiate(prefab, hero.transform, false);
            if (heroVisual != null) Destroy(heroVisual);
            heroVisual = replacement;
            heroAnimator = replacement.GetComponentInChildren<Animator>();
            if (heroAnimator != null) heroAnimator.applyRootMotion = false;
            // Imported models include decorative weapons; ownership comes from the loadout.
            foreach (var renderer in replacement.GetComponentsInChildren<Renderer>(true))
            {
                string part = renderer.name.ToLowerInvariant();
                if (part.Contains("sword") || part.Contains("staff") || part.Contains("dagger") || part.Contains("scabbard") || part.Contains("shield") || part.Contains("bow") || part.Contains("knife")) renderer.enabled = false;
            }
            RebuildEquipmentVisuals();
            return true;
        }

        public void StartTrialView() { tactical = true; }
        public void NotifyHeroSelected(string id) { if (combat != null) combat.SelectHero(id); }
        public Vector3 HeroPosition => hero != null ? hero.transform.position : Vector3.zero;
        public void PlaceTrialHero(Vector3 position)
        {
            if (hero == null) return;
            hero.enabled = false; hero.transform.position = position; hero.enabled = true;
            verticalVelocity = 0;
            if (heroAnimator != null) heroAnimator.SetFloat("Speed", 0);
        }
        public void MoveTrialHero(Vector3 position)
        {
            if (hero == null) return;
            var destination = Vector3.MoveTowards(hero.transform.position, position, Time.deltaTime * 7);
            var delta = destination - hero.transform.position;
            hero.Move(delta);
            var facing = new Vector3(delta.x, 0, delta.z);
            if (facing.sqrMagnitude > .00001f) hero.transform.rotation = Quaternion.Slerp(hero.transform.rotation, Quaternion.LookRotation(facing), Time.deltaTime * 12);
            if (heroAnimator != null) heroAnimator.SetFloat("Speed", delta.sqrMagnitude > .00001f ? 3 : 0, .1f, Time.deltaTime);
        }
        public void FaceTrialTarget(Vector3 position)
        {
            if (hero == null) return;
            var direction = position - hero.transform.position; direction.y = 0;
            if (direction.sqrMagnitude > .001f) hero.transform.rotation = Quaternion.LookRotation(direction);
        }
        public void PlayTrialAttack()
        {
            if (heroAnimator != null && heroAnimator.HasState(0, Animator.StringToHash("Attack"))) heroAnimator.CrossFadeInFixedTime("Attack", .08f);
        }

        // Presentation only: call with the server-returned equipped items, not pending clicks.
        public int ApplyEquipmentVisuals(EquippedVisualSelection[] selections)
        {
            equippedVisuals = selections == null ? Array.Empty<EquippedVisualSelection>() : (EquippedVisualSelection[])selections.Clone();
            return RebuildEquipmentVisuals();
        }

        int RebuildEquipmentVisuals()
        {
            foreach (var visual in equipmentObjects)
                if (visual != null) { visual.SetActive(false); Destroy(visual); }
            equipmentObjects.Clear();
            if (heroAnimator == null || !heroAnimator.isHuman) return 0;
            if (equipmentCatalog == null) equipmentCatalog = Resources.Load<ButcherEquipmentCatalog>("EquipmentVisualCatalog");
            if (equipmentCatalog == null) return 0;
            var slots = new HashSet<string>();
            foreach (var selection in equippedVisuals)
            {
                if (slots.Contains(selection.slot) || !equipmentCatalog.TryResolve(selection.definitionId, selection.definitionVersion, selection.slot, out var entry)) continue;
                var bone = heroAnimator.GetBoneTransform(entry.bone);
                if (bone == null) continue;
                var visual = Instantiate(entry.prefab, bone, false);
                visual.name = "Equipped " + selection.definitionId;
                visual.transform.localPosition = entry.localPosition;
                visual.transform.localRotation = Quaternion.Euler(entry.localEuler);
                var scale = bone.lossyScale;
                visual.transform.localScale = new Vector3(1 / Mathf.Max(.001f, Mathf.Abs(scale.x)), 1 / Mathf.Max(.001f, Mathf.Abs(scale.y)), 1 / Mathf.Max(.001f, Mathf.Abs(scale.z)));
                visual.AddComponent<ButcherEquippedVisual>().Configure(selection.definitionId, selection.slot);
                equipmentObjects.Add(visual);
                slots.Add(selection.slot);
            }
            return equipmentObjects.Count;
        }

        void Update()
        {
            if (hero == null) return;
            if (characterMenu != null && characterMenu.IsOpen)
            {
                if (heroAnimator != null) heroAnimator.SetFloat("Speed", 0);
                return;
            }
            if (Input.GetKeyDown(KeyCode.Tab)) tactical = !tactical;
            if (combat != null && combat.InTrial) { combat.ReadMovementInput(); return; }
            if (hero.transform.position.y < -15) PlaceTrialHero(new Vector3(0,.1f,-12));
            if (Input.GetMouseButton(1)) yaw += Input.GetAxis("Mouse X") * 3;
            var input = new Vector2(Input.GetAxisRaw("Horizontal"), Input.GetAxisRaw("Vertical")) + touchMove;
            input = Vector2.ClampMagnitude(input, 1);
            var direction = Quaternion.Euler(0, yaw, 0) * new Vector3(input.x, 0, input.y);
            if (direction.sqrMagnitude > .01f)
                hero.transform.rotation = Quaternion.Slerp(hero.transform.rotation, Quaternion.LookRotation(direction), Time.deltaTime * 12);
            verticalVelocity = hero.isGrounded ? -2 : verticalVelocity + Physics.gravity.y * Time.deltaTime;
            float speed = Input.GetKey(KeyCode.LeftShift) ? 5.5f : 2.3f;
            hero.Move((direction * speed + Vector3.up * verticalVelocity) * Time.deltaTime);
            if (heroAnimator != null) heroAnimator.SetFloat("Speed", input.magnitude * speed, .12f, Time.deltaTime);
        }

        void LateUpdate()
        {
            if (hero == null || view == null) return;
            var target = hero.transform.position + Vector3.up * 1.35f;
            var offset = tactical ? new Vector3(0, 18, -10) : Quaternion.Euler(0, yaw, 0) * new Vector3(0, 2.8f, -5.5f);
            if (Physics.SphereCast(target, .2f, offset.normalized, out var hit, offset.magnitude, ~0, QueryTriggerInteraction.Ignore))
                offset = offset.normalized * Mathf.Max(.6f, hit.distance - .1f);
            view.transform.position = Vector3.Lerp(view.transform.position, target + offset, 1 - Mathf.Exp(-10 * Time.deltaTime));
            view.transform.LookAt(target);
        }

        void OnGUI()
        {
            if (characterMenu != null && characterMenu.IsOpen) { touchMove = Vector2.zero; return; }
            float scale = Mathf.Max(.6f, Mathf.Min(Screen.width / 1280f, Screen.height / 720f));
            GUI.matrix = Matrix4x4.TRS(Vector3.zero, Quaternion.identity, Vector3.one * scale);
            float w = Screen.width / scale, h = Screen.height / scale;
            if (title == null)
            {
                title = new GUIStyle(GUI.skin.label) { fontSize = 32, fontStyle = FontStyle.Bold };
                caption = new GUIStyle(GUI.skin.label) { fontSize = 17, wordWrap = true };
            }
            GUI.Box(new Rect(18, 18, 490, 126), "");
            GUI.Label(new Rect(34, 26, 450, 42), "BUTCHER", title);
            GUI.Label(new Rect(34, 72, 450, 62), (combat != null && combat.InTrial ? "Camp Trial · In memory of Randy Butcher\nWASD: step · F: attack · Space: end turn" : "Exploration prototype · In memory of Randy Butcher\nWASD: move · Right mouse: orbit · Shift: run"), caption);
            if (objective != null && (combat == null || !combat.InTrial))
            {
                GUI.Box(new Rect(18, 152, 490, 108), "");
                GUI.Label(new Rect(34, 164, 456, 84), objective.ObjectiveText, caption);
                if (objective.CanInteract && GUI.Button(new Rect(w - 204, 84, 180, 48), "Interact [E]")) objective.Interact();
            }
            if (equippedSkillNames.Length > 0)
            {
                GUI.Box(new Rect(18, 270, 490, 82), "");
                GUI.Label(new Rect(34, 280, 456, 65), "Equipped skills\n" + string.Join(" · ", equippedSkillNames), caption);
            }
            if (GUI.Button(new Rect(w - 204, 24, 180, 48), tactical ? "Third person" : "Tactical overview")) tactical = !tactical;
            touchMove = Vector2.zero;
            if (combat != null && combat.InTrial) return;
            if (GUI.RepeatButton(new Rect(86, h - 174, 64, 64), "↑")) touchMove.y += 1;
            if (GUI.RepeatButton(new Rect(22, h - 108, 64, 64), "←")) touchMove.x -= 1;
            if (GUI.RepeatButton(new Rect(86, h - 108, 64, 64), "↓")) touchMove.y -= 1;
            if (GUI.RepeatButton(new Rect(150, h - 108, 64, 64), "→")) touchMove.x += 1;
            if (GUI.RepeatButton(new Rect(w - 160, h - 100, 60, 56), "↶")) yaw -= 80 * Time.unscaledDeltaTime;
            if (GUI.RepeatButton(new Rect(w - 90, h - 100, 60, 56), "↷")) yaw += 80 * Time.unscaledDeltaTime;
        }

        static Material Material(string name, Color color)
        {
            var shader = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
            var material = new Material(shader) { name = name, color = color };
            return material;
        }

        static GameObject Shape(string name, PrimitiveType type, Vector3 position, Vector3 scale, Material material)
        {
            var shape = GameObject.CreatePrimitive(type);
            shape.name = name; shape.transform.position = position; shape.transform.localScale = scale;
            shape.GetComponent<Renderer>().sharedMaterial = material;
            return shape;
        }

        static void Tree(Vector3 position, Material bark, Material leaves)
        {
            Shape("Tree trunk", PrimitiveType.Cylinder, position + Vector3.up * 3, new Vector3(.8f, 3, .8f), bark);
            Shape("Tree canopy", PrimitiveType.Sphere, position + Vector3.up * 6, new Vector3(5, 5, 5), leaves);
        }

        void SpawnTree(Vector3 position, int index, Material bark, Material leaves)
        {
            if (treePrefabs == null || treePrefabs.Length == 0) { Tree(position, bark, leaves); return; }
            var tree = PlaceProp(treePrefabs[index % treePrefabs.Length], position, 6 + index % 4);
            if (tree != null) tree.transform.rotation = Quaternion.Euler(0, (index * 137) % 360, 0);
        }

        static GameObject PlaceProp(GameObject prefab, Vector3 position, float largestDimension)
        {
            if (prefab == null) return null;
            var prop = Instantiate(prefab, position, Quaternion.identity);
            prop.name = "Camp " + prefab.name;
            var renderers = prop.GetComponentsInChildren<Renderer>();
            if (renderers.Length == 0) return prop;
            var bounds = renderers[0].bounds;
            foreach (var renderer in renderers) bounds.Encapsulate(renderer.bounds);
            float size = Mathf.Max(bounds.size.x, bounds.size.y, bounds.size.z);
            if (size > .001f) prop.transform.localScale *= largestDimension / size;
            bounds = renderers[0].bounds;
            foreach (var renderer in renderers) bounds.Encapsulate(renderer.bounds);
            prop.transform.position += Vector3.up * (position.y - bounds.min.y);
            if (prop.GetComponentInChildren<Collider>() == null)
            {
                var collider = prop.AddComponent<BoxCollider>();
                collider.center = prop.transform.InverseTransformPoint(bounds.center + Vector3.up * (position.y - bounds.min.y));
                var scale = prop.transform.lossyScale;
                collider.size = new Vector3(bounds.size.x / Mathf.Abs(scale.x), bounds.size.y / Mathf.Abs(scale.y), bounds.size.z / Mathf.Abs(scale.z));
            }
            return prop;
        }
    }
}
