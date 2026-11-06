using System;
using System.Collections;
using System.Collections.Generic;
using System.Text;
using UnityEngine;
using UnityEngine.Networking;

namespace Imperial.Butcher
{
    public sealed class ButcherCharacterMenu : MonoBehaviour
    {
        // Publishable client key only. Service credentials never belong in Unity.
        const string Api = "https://jvyzpxjqmymafjapprpp.supabase.co";
        const string Publishable = "sb_publishable_9uFdh-OL4yAWtPPKNSZLPA_aVM5daBS";
        static readonly string[] Archetypes = { "vanguard", "spellweaver", "oathkeeper", "wildscout" };
        static readonly string[] Origins = { "ridgeborn", "tideborn", "emberkin", "stonebound" };
        static readonly string[] AbilityLabels = { "Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma" };
        static readonly int[][] StarterScores = {
            new[] { 15, 14, 13, 12, 10, 8 }, new[] { 8, 12, 13, 15, 10, 14 },
            new[] { 15, 10, 13, 8, 12, 14 }, new[] { 10, 15, 13, 12, 14, 8 }
        };
        // Matches the lab's level-one archetype proficiency lists.
        static readonly string[][] SkillOptions = {
            new[] { "athletics", "perception", "insight", "survival" },
            new[] { "arcana", "lore", "insight", "perception" },
            new[] { "athletics", "medicine", "insight", "persuasion" },
            new[] { "stealth", "survival", "acrobatics", "foraging", "perception" }
        };
        int[] draftScores = (int[])StarterScores[0].Clone();
        int selectedAbility = -1;
        readonly List<string> draftSkills = new List<string> { SkillOptions[0][0], SkillOptions[0][1] };
        ButcherWorld world;
        string email = "", password = "", session = "", heroName = "New Hero";
        string message = "Preview an appearance, or sign in to the Butcher lab to save a hero.";
        string pendingPayload, pendingRequestId;
        CharacterEntry[] characters = Array.Empty<CharacterEntry>();
        int archetype, origin;
        bool busy;
        Vector2 scroll;
        GUISkin menuSkin;
        InventoryReply inventory;
        CharacterData selectedBuild;
        bool showEquipment;
        int equipmentSlot;
        static readonly string[] EquipmentSlots = { "main_hand", "body", "skill_1", "skill_2", "skill_3" };
        static readonly string[] EquipmentLabels = { "Weapon", "Armor", "Skill 1", "Skill 2", "Skill 3" };
        public bool IsBusy => busy;
        public bool IsSignedIn => !string.IsNullOrEmpty(session);
        public string StatusMessage => message;
        public bool IsOpen { get; private set; }
        public string SelectedCharacterId { get; private set; }
        public bool ProbeCompleted { get; private set; }
        public bool ServiceReachable { get; private set; }

        public void Configure(ButcherWorld owner) { world = owner; }
        void Update()
        {
            if (Input.GetKeyDown(KeyCode.Escape)) IsOpen = false;
            else if (!IsOpen && Input.GetKeyDown(KeyCode.C)) IsOpen = true;
        }

        void OnGUI()
        {
            float scale = Mathf.Max(.6f, Mathf.Min(Screen.width / 1280f, Screen.height / 720f));
            GUI.matrix = Matrix4x4.TRS(Vector3.zero, Quaternion.identity, Vector3.one * scale);
            float width = Screen.width / scale, height = Screen.height / scale;
            if (GUI.Button(new Rect(width - 394, 24, 180, 48), "Characters [C]")) IsOpen = !IsOpen;
            if (!IsOpen) return;
            var previousSkin = GUI.skin;
            if (menuSkin == null)
            {
                menuSkin = Instantiate(GUI.skin);
                menuSkin.label.fontSize = 18; menuSkin.label.wordWrap = true;
                menuSkin.button.fontSize = 18; menuSkin.textField.fontSize = 18;
            }
            GUI.skin = menuSkin;
            float panelHeight = Mathf.Min(640, height - 100);
            var panel = new Rect((width - 580) / 2, 85, 580, panelHeight);
            var previousColor = GUI.color;
            GUI.color = new Color(.075f, .085f, .10f, 1);
            GUI.DrawTexture(panel, Texture2D.whiteTexture);
            GUI.color = previousColor;
            GUILayout.BeginArea(panel, GUI.skin.box);
            scroll = GUILayout.BeginScrollView(scroll);
            GUILayout.Label("BUTCHER · Characters · Lab");
            GUILayout.Label(message, GUILayout.MinHeight(45));
            GUI.enabled = !busy;
            GUILayout.BeginHorizontal();
            if (GUILayout.Button("Knight preview", GUILayout.Height(36))) world.ApplyHeroAppearance("knight");
            if (GUILayout.Button("Scout preview", GUILayout.Height(36))) world.ApplyHeroAppearance("scout");
            if (GUILayout.Button("Caster preview", GUILayout.Height(36))) world.ApplyHeroAppearance("spellweaver");
            GUILayout.EndHorizontal();
            if (string.IsNullOrEmpty(session))
            {
                GUILayout.Space(15);
                if (GUILayout.Button("Check lab connection", GUILayout.Height(34))) CheckConnection();
                GUILayout.Label("Lab account email"); email = GUILayout.TextField(email, 254, GUILayout.Height(30));
                GUILayout.Label("Password"); password = GUILayout.PasswordField(password, '*', 256, GUILayout.Height(30));
                if (GUILayout.Button("Sign in", GUILayout.Height(38))) SignIn();
                GUILayout.Label("Credentials and session stay in memory for this play session. Use your existing lab account.");
            }
            else if (showEquipment)
            {
                DrawEquipment();
            }
            else
            {
                if (!string.IsNullOrEmpty(SelectedCharacterId) && GUILayout.Button("Equipment and skills", GUILayout.Height(38)))
                { showEquipment = true; RefreshInventory(); }
                GUILayout.BeginHorizontal();
                if (GUILayout.Button("Refresh heroes", GUILayout.Height(32))) RefreshCharacters();
                if (GUILayout.Button("Sign out", GUILayout.Height(32))) SignOut();
                GUILayout.EndHorizontal();
                foreach (var character in characters)
                {
                    if (character?.characterData == null) continue;
                    if (GUILayout.Button(character.name + " · " + character.characterData.archetypeId + (SelectedCharacterId == character.id ? " · Selected" : ""), GUILayout.Height(36))) Select(character);
                }
                DrawSelectedHero();
                GUILayout.Space(15);
                GUILayout.Label("Create a level-one hero");
                heroName = GUILayout.TextField(heroName, 32, GUILayout.Height(30));
                GUILayout.Label("Origin: " + Origins[origin]);
                if (GUILayout.Button("Change origin", GUILayout.Height(30))) origin = (origin + 1) % Origins.Length;
                GUILayout.Label("Archetype: " + Archetypes[archetype]);
                if (GUILayout.Button("Change archetype", GUILayout.Height(30)))
                {
                    archetype = (archetype + 1) % Archetypes.Length;
                    ResetBuildChoices();
                }
                DrawBuildChoices();
                GUI.enabled = !busy && draftSkills.Count == 2;
                if (GUILayout.Button("Save new hero", GUILayout.Height(38))) CreateCharacter();
            }
            GUI.enabled = true;
            if (GUILayout.Button("Return to the world", GUILayout.Height(34))) IsOpen = false;
            GUILayout.EndScrollView();
            GUILayout.EndArea();
            GUI.skin = previousSkin;
        }

        void ResetBuildChoices()
        {
            draftScores = (int[])StarterScores[archetype].Clone();
            selectedAbility = -1;
            draftSkills.Clear();
            draftSkills.Add(SkillOptions[archetype][0]);
            draftSkills.Add(SkillOptions[archetype][1]);
        }

        void DrawBuildChoices()
        {
            GUILayout.Label("Ability scores · Select two abilities to swap their scores.");
            for (int i = 0; i < AbilityLabels.Length; i++)
            {
                string label = AbilityLabels[i] + "  " + draftScores[i];
                if (i == selectedAbility) label += " · Selected";
                if (!GUILayout.Button(label, GUILayout.Height(30))) continue;
                if (selectedAbility < 0) selectedAbility = i;
                else
                {
                    (draftScores[i], draftScores[selectedAbility]) = (draftScores[selectedAbility], draftScores[i]);
                    selectedAbility = -1;
                }
            }
            GUILayout.Label("Skill proficiencies · Choose two (" + draftSkills.Count + "/2)");
            foreach (string skill in SkillOptions[archetype])
            {
                bool chosen = draftSkills.Contains(skill);
                GUI.enabled = !busy && (chosen || draftSkills.Count < 2);
                bool selected = GUILayout.Toggle(chosen, char.ToUpperInvariant(skill[0]) + skill.Substring(1), GUILayout.Height(28));
                if (selected && !chosen) draftSkills.Add(skill);
                if (!selected && chosen) draftSkills.Remove(skill);
            }
            GUI.enabled = !busy;
            if (GUILayout.Button("Restore archetype defaults", GUILayout.Height(30))) ResetBuildChoices();
        }

        void DrawSelectedHero()
        {
            if (selectedBuild == null) return;
            GUILayout.Space(12);
            GUILayout.Label("Selected hero · Level " + selectedBuild.level);
            GUILayout.Label(selectedBuild.originId + " · " + selectedBuild.archetypeId);
            var scores = selectedBuild.abilityScores;
            if (scores != null && scores.strength > 0)
            {
                GUILayout.Label(AbilitySummary("STR", scores.strength) + "   " +
                    AbilitySummary("DEX", scores.dexterity) + "   " + AbilitySummary("CON", scores.constitution));
                GUILayout.Label(AbilitySummary("INT", scores.intelligence) + "   " +
                    AbilitySummary("WIS", scores.wisdom) + "   " + AbilitySummary("CHA", scores.charisma));
            }
            var skills = selectedBuild.proficientSkills;
            if (skills != null && skills.Length > 0) GUILayout.Label("Proficiencies · " + string.Join(", ", skills));
        }

        static string AbilitySummary(string label, int score)
        {
            int modifier = Mathf.FloorToInt((score - 10) / 2f);
            return label + " " + score + " (" + (modifier >= 0 ? "+" : "") + modifier + ")";
        }

        public void CheckConnection() { if (!busy) StartCoroutine(Probe()); }

        IEnumerator Probe()
        {
            busy = true; ProbeCompleted = false; ServiceReachable = false;
            using (var request = new UnityWebRequest(Api + "/functions/v1/butcher-characters", "OPTIONS"))
            {
                request.downloadHandler = new DownloadHandlerBuffer();
                request.timeout = 20;
                yield return request.SendWebRequest();
                ServiceReachable = request.responseCode == 204;
                ProbeCompleted = true; busy = false;
                message = ServiceReachable ? "The Butcher lab is reachable. Sign in to load your heroes." : "The lab could not be reached. Check your connection and try again.";
            }
        }

        void SignIn()
        {
            if (string.IsNullOrWhiteSpace(email) || string.IsNullOrEmpty(password)) { message = "Enter your lab account email and password."; return; }
            string body = JsonUtility.ToJson(new LoginRequest { email = email.Trim(), password = password });
            password = "";
            StartCoroutine(Post("/auth/v1/token?grant_type=password", body, false, raw => {
                var reply = JsonUtility.FromJson<TokenReply>(raw);
                if (reply == null || string.IsNullOrEmpty(reply.access_token)) { message = "Sign-in did not return a session."; return; }
                session = reply.access_token;
                message = "Signed in to the Butcher lab.";
                RefreshCharacters();
            }));
        }

        void SignOut()
        {
            session = ""; password = ""; characters = Array.Empty<CharacterEntry>();
            world.ApplyEquipmentVisuals(null); world.SetEquippedSkillNames(null); world.NotifyHeroSelected(null); selectedBuild = null;
            SelectedCharacterId = null; inventory = null; showEquipment = false; pendingPayload = null; pendingRequestId = null;
            message = "Signed out. The current appearance remains a local preview.";
        }

        void RefreshCharacters()
        {
            StartCoroutine(Post("/functions/v1/butcher-characters", "{\"action\":\"list\"}", true, raw => {
                var reply = JsonUtility.FromJson<CharacterReply>(raw);
                characters = reply?.characters ?? Array.Empty<CharacterEntry>();
                message = characters.Length == 0 ? "No saved heroes yet. Create your first hero below." : "Choose one of your saved heroes.";
            }));
        }

        void Select(CharacterEntry character)
        {
            if (character?.characterData == null || !world.ApplyHeroAppearance(character.characterData.visualId))
            { message = "This hero's appearance is not available in this client yet."; return; }
            world.ApplyEquipmentVisuals(null); world.SetEquippedSkillNames(null);
            selectedBuild = character.characterData;
            SelectedCharacterId = character.id;
            world.NotifyHeroSelected(character.id);
            inventory = null; showEquipment = false;
            RefreshInventory();
            message = "Selected " + character.name + ".";
            IsOpen = false;
        }

        void CreateCharacter()
        {
            if (draftSkills.Count != 2) return;
            var data = new CharacterBuild {
                name = heroName.Trim(), originId = Origins[origin], archetypeId = Archetypes[archetype],
                abilityScores = new AbilityScores {
                    strength = draftScores[0], dexterity = draftScores[1], constitution = draftScores[2],
                    intelligence = draftScores[3], wisdom = draftScores[4], charisma = draftScores[5]
                },
                proficientSkills = draftSkills.ToArray()
            };
            string payload = JsonUtility.ToJson(data);
            if (payload != pendingPayload) { pendingPayload = payload; pendingRequestId = Guid.NewGuid().ToString(); }
            var request = new CreateRequest { requestId = pendingRequestId, character = data };
            StartCoroutine(Post("/functions/v1/butcher-characters", JsonUtility.ToJson(request), true, raw => {
                var reply = JsonUtility.FromJson<CharacterReply>(raw);
                if (reply?.character == null) { message = "No hero was returned. You can retry safely."; return; }
                pendingPayload = null; pendingRequestId = null;
                var updated = new CharacterEntry[characters.Length + 1];
                Array.Copy(characters, updated, characters.Length);
                updated[characters.Length] = reply.character;
                characters = updated;
                Select(reply.character);
            }));
        }

        void DrawEquipment()
        {
            if (GUILayout.Button("Back to heroes", GUILayout.Height(32))) { showEquipment = false; return; }
            GUILayout.Label("Equipment and skills · Practice");
            GUILayout.Label("Practice gear saves with your hero. Weapons and the travel cloak appear on your character; combat effects are still being built.");
            if (GUILayout.Button("Refresh inventory", GUILayout.Height(32))) RefreshInventory();
            if (inventory == null) { GUILayout.Label("Load a hero's inventory to begin."); return; }
            GUILayout.Label("Compatibility symbols: " + string.Join(" · ", inventory.symbols ?? Array.Empty<string>()));
            if (inventory.locked) GUILayout.Label("Your loadout is locked for an active encounter.");
            if (!inventory.starterClaimed && GUILayout.Button("Claim practice starter kit", GUILayout.Height(36))) InventoryAction("claim_starter");
            equipmentSlot = GUILayout.SelectionGrid(equipmentSlot, EquipmentLabels, 3, GUILayout.Height(64));
            string slot = EquipmentSlots[equipmentSlot];
            GUILayout.Label("Slot: " + EquipmentLabels[equipmentSlot]);
            InventoryItem equipped = null;
            foreach (var item in inventory.items ?? Array.Empty<InventoryItem>())
                if (item.equippedCharacterId == SelectedCharacterId && item.slot == slot) equipped = item;
            GUILayout.Label(equipped == null ? "Currently empty" : "Equipped: " + equipped.name);
            if (equipped != null && GUILayout.Button("Unequip", GUILayout.Height(32))) InventoryAction("unequip");
            GUILayout.Space(10);
            foreach (var item in inventory.items ?? Array.Empty<InventoryItem>())
            {
                if (Array.IndexOf(item.allowedSlots ?? Array.Empty<string>(), slot) < 0) continue;
                GUILayout.BeginVertical(GUI.skin.box);
                GUILayout.Label(item.name + " · " + item.state);
                if (!string.IsNullOrEmpty(item.description)) GUILayout.Label(item.description);
                string symbols = item.requiredSymbols == null || item.requiredSymbols.Length == 0 ? "Any symbols" : string.Join(" + ", item.requiredSymbols);
                GUILayout.Label(symbols + " · Level " + item.minimumLevel);
                foreach (var requirement in item.skillRequirements ?? Array.Empty<SkillRank>())
                    GUILayout.Label("Requires " + requirement.skill.Replace('.', ' ').Replace('_', ' ') + " rank " + requirement.rank);
                if (item.grantedAbilityNames != null && item.grantedAbilityNames.Length > 0)
                    GUILayout.Label("Unlocks: " + string.Join(", ", item.grantedAbilityNames));
                string reason = EquipUnavailableReason(item, slot);
                bool wasEnabled = GUI.enabled;
                GUI.enabled = wasEnabled && reason == null;
                if (GUILayout.Button("Equip " + item.name, GUILayout.Height(32))) InventoryAction("equip", item.id);
                GUI.enabled = wasEnabled;
                if (reason != null) GUILayout.Label(reason);
                GUILayout.EndVertical();
            }
        }

        // UI hints only; the database validates every actual mutation again.
        string EquipUnavailableReason(InventoryItem item, string slot)
        {
            if (inventory.locked) return "Loadout locked for an encounter";
            if (item.state == "equipped") return item.equippedCharacterId == SelectedCharacterId ? "Equipped on this hero" : "Equipped on another hero";
            if (item.state != "available") return "Item is " + item.state;
            if (selectedBuild == null) return "Select your hero to check requirements";
            if (selectedBuild.level < item.minimumLevel) return "Requires level " + item.minimumLevel;
            foreach (var symbol in item.requiredSymbols ?? Array.Empty<string>())
                if (Array.IndexOf(inventory.symbols ?? Array.Empty<string>(), symbol) < 0) return "Missing " + symbol + " symbol";
            foreach (var requirement in item.skillRequirements ?? Array.Empty<SkillRank>())
            {
                int rank = Array.IndexOf(selectedBuild.proficientSkills ?? Array.Empty<string>(), requirement.skill) >= 0 ? 1 : 0;
                foreach (var trained in selectedBuild.skillRanksEntries ?? Array.Empty<SkillRank>())
                    if (trained.skill == requirement.skill) rank = Math.Max(rank, trained.rank);
                if (rank < requirement.rank) return "Requires " + requirement.skill.Replace('.', ' ') + " rank " + requirement.rank;
            }
            if (item.kind == "skill")
                foreach (var other in inventory.items)
                    if (other.equippedCharacterId == SelectedCharacterId && other.slot != slot && other.definitionId == item.definitionId) return "This skill is already equipped";
            return null;
        }

        public void RefreshInventory() { if (!string.IsNullOrEmpty(SelectedCharacterId)) InventoryAction("inventory"); }
        void InventoryAction(string action, string itemId = null)
        {
            if (busy || string.IsNullOrEmpty(SelectedCharacterId)) return;
            string heroId = SelectedCharacterId;
            string body;
            if (action == "inventory" || action == "claim_starter")
                body = JsonUtility.ToJson(new InventoryReadRequest { action = action, characterId = heroId });
            else if (action == "equip")
                body = JsonUtility.ToJson(new EquipRequest { characterId = heroId, expectedRevision = inventory.loadoutRevision, slot = EquipmentSlots[equipmentSlot], itemId = itemId });
            else
                body = JsonUtility.ToJson(new UnequipRequest { characterId = heroId, expectedRevision = inventory.loadoutRevision, slot = EquipmentSlots[equipmentSlot] });
            StartCoroutine(Post("/functions/v1/butcher-characters", body, true, raw => {
                if (heroId != SelectedCharacterId) return;
                var reply = JsonUtility.FromJson<InventoryReply>(raw);
                if (reply == null || reply.characterId != heroId || reply.items == null) { message = "Inventory response was unexpected. Refresh and try again."; return; }
                inventory = reply;
                var visuals = new System.Collections.Generic.List<ButcherWorld.EquippedVisualSelection>();
                var skillNames = new System.Collections.Generic.List<string>();
                foreach (var item in reply.items)
                    if (item.state == "equipped" && item.equippedCharacterId == heroId)
                    {
                        visuals.Add(new ButcherWorld.EquippedVisualSelection { definitionId = item.definitionId, definitionVersion = item.definitionVersion, slot = item.slot });
                        if (item.kind == "skill") skillNames.Add(item.name);
                    }
                world.ApplyEquipmentVisuals(visuals.ToArray());
                world.SetEquippedSkillNames(skillNames.ToArray());
                message = action == "inventory" ? "Inventory loaded from the server." : "Equipment saved on the server.";
            }));
        }

        public bool RequestTrial(string body, Action<string> success, Action<long> failure)
        {
            if (busy) return false;
            if (!IsSignedIn) { failure?.Invoke(401); return false; }
            StartCoroutine(Post("/functions/v1/butcher-encounters", body, true, success, failure));
            return true;
        }

        IEnumerator Post(string path, string body, bool authenticated, Action<string> success, Action<long> failure = null)
        {
            if (authenticated && string.IsNullOrEmpty(session)) { message = "Sign in first."; failure?.Invoke(401); yield break; }
            busy = true;
            using (var request = new UnityWebRequest(Api + path, "POST"))
            {
                request.uploadHandler = new UploadHandlerRaw(Encoding.UTF8.GetBytes(body));
                request.downloadHandler = new DownloadHandlerBuffer();
                request.timeout = 20;
                request.SetRequestHeader("content-type", "application/json");
                request.SetRequestHeader("apikey", Publishable);
                if (authenticated) request.SetRequestHeader("authorization", "Bearer " + session);
                yield return request.SendWebRequest();
                busy = false;
                if (request.result != UnityWebRequest.Result.Success)
                {
                    if (authenticated && request.responseCode == 401) { SignOut(); message = "Your session ended. Sign in again."; }
                    else if (!authenticated && request.responseCode >= 400 && request.responseCode < 500) message = "Sign-in failed. Check your lab credentials and account requirements.";
                    else if (path.Contains("butcher-encounters"))
                    {
                        message = "Trial request did not complete. Retry or refresh.";
                        try { var error = JsonUtility.FromJson<ErrorReply>(request.downloadHandler.text); if (!string.IsNullOrEmpty(error?.error)) message = error.error; }
                        catch { /* A proxy response may not be JSON. Keep the retry path available. */ }
                    }
                    else if (path.Contains("butcher-characters") && body.Contains("expectedRevision") && request.responseCode == 409)
                        message = "Your inventory changed or an item is locked. Refresh inventory before trying again.";
                    else if (request.responseCode == 422) message = "This hero needs the matching symbols, level and skill training. Duplicate skills cannot be stacked.";
                    else if (request.responseCode == 404) message = "That hero or item is no longer available. Refresh your list.";
                    else if (request.responseCode == 409) message = "Creation request conflicts, or the ten-hero limit was reached.";
                    else message = "The request did not complete. Check your connection and try again.";
                    failure?.Invoke(request.responseCode);
                    yield break;
                }
                try { success(request.downloadHandler.text); }
                catch { message = "The server returned an unexpected response. Please retry."; failure?.Invoke(0); }
            }
        }

        [Serializable] class ErrorReply { public string error; }
        [Serializable] class InventoryReadRequest { public string action, characterId; }
        [Serializable] class EquipRequest { public string action = "equip", characterId, itemId, slot; public long expectedRevision; }
        [Serializable] class UnequipRequest { public string action = "unequip", characterId, slot; public long expectedRevision; }
        [Serializable] class InventoryReply { public string characterId; public long loadoutRevision; public bool starterClaimed, locked; public string[] symbols; public InventoryItem[] items; }
        [Serializable] class InventoryItem { public string id, definitionId, name, kind, state, source, equippedCharacterId, slot, description; public int minimumLevel, definitionVersion; public string[] allowedSlots, requiredSymbols, grantedAbilityNames; public SkillRank[] skillRequirements; }
        [Serializable] class LoginRequest { public string email, password; }
        [Serializable] class TokenReply { public string access_token; }
        [Serializable] class AbilityScores { public int strength, dexterity, constitution, intelligence, wisdom, charisma; }
        [Serializable] class CharacterBuild { public string name, originId, archetypeId; public AbilityScores abilityScores; public string[] proficientSkills; }
        [Serializable] class CreateRequest { public string action = "create", requestId; public CharacterBuild character; }
        [Serializable] class CharacterReply { public CharacterEntry[] characters; public CharacterEntry character; }
        [Serializable] class CharacterEntry { public string id, name; public CharacterData characterData; }
        [Serializable] class SkillRank { public string skill; public int rank; }
        [Serializable] class CharacterData { public string originId, archetypeId, visualId; public int level; public AbilityScores abilityScores; public string[] proficientSkills; public SkillRank[] skillRanksEntries; }
    }
}
