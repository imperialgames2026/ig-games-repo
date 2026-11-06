using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace Imperial.Butcher
{
    // Sends intent only. Health, movement allowance, hits and enemy turns come from the lab.
    public sealed class ButcherCombatController : MonoBehaviour
    {
        ButcherWorld world;
        ButcherCharacterMenu menu;
        string heroId, pendingBody, notice = "Select a saved hero to enter the camp trial.";
        TrialReply snapshot;
        GameObject arena, enemy, wardVisual;
        ButcherTrialFeedback feedback;
        Coroutine sparkRoutine;
        readonly List<Material> materials = new List<Material>();
        readonly Queue<string> recent = new Queue<string>();
        bool loading;
        Vector3 heroTarget, enemyTarget;
        static readonly Vector3 ArenaOrigin = new Vector3(28, .1f, -16);
        const float Tile = 1.524f; // Five feet in metres; range math stays server-side.
        GUIStyle text;
        public bool InTrial => snapshot?.encounter?.state != null;
        public int DisplayedMana => Actor("hero")?.mana ?? 0;
        public bool WardVisible => wardVisual != null && wardVisual.activeSelf;
        public int DisplayedRevision => InTrial ? snapshot.encounter.state.revision : -1;
        public string TrialOutcome => InTrial ? snapshot.encounter.state.outcome : null;
        public bool HeroAtDestination => InTrial && Vector3.Distance(world.HeroPosition, heroTarget) < .08f;
        bool CanAct => InTrial && snapshot.encounter.state.phase == "active" && !loading && !menu.IsBusy && pendingBody == null && menu.IsSignedIn && HeroAtDestination;
        public void Configure(ButcherWorld owner, ButcherCharacterMenu account) { world = owner; menu = account; }

        public void SelectHero(string selectedId)
        {
            StopAllCoroutines(); ClearPresentation(); heroId = selectedId; pendingBody = null; loading = false;
            notice = string.IsNullOrEmpty(heroId) ? "Select a saved hero to enter the camp trial." : "Checking for a saved trial…";
            if (!string.IsNullOrEmpty(heroId)) StartCoroutine(ResumeWhenReady(selectedId));
        }
        IEnumerator ResumeWhenReady(string selectedId)
        {
            loading = true;
            yield return null;
            while (menu.IsBusy) yield return null;
            if (heroId == selectedId) RefreshTrial();
        }
        public void RefreshTrial()
        {
            if (string.IsNullOrEmpty(heroId) || menu.IsBusy || !menu.IsSignedIn) { loading = false; return; }
            Send("{\"action\":\"resume\",\"characterId\":\"" + heroId + "\"}", false);
        }
        void StartTrial()
        {
            if (string.IsNullOrEmpty(heroId) || menu.IsBusy || !menu.IsSignedIn || loading || pendingBody != null) return;
            Send("{\"action\":\"start\",\"characterId\":\"" + heroId + "\",\"requestId\":\"" + Guid.NewGuid() + "\"}", true);
        }
        void Send(string body, bool retryable)
        {
            string selectedId = heroId;
            loading = true;
            if (retryable) pendingBody = body;
            bool sent = menu.RequestTrial(body, raw => {
                if (heroId != selectedId) return;
                ApplyTrialPresentation(raw);
                pendingBody = null; loading = false;
            }, status => {
                if (heroId != selectedId) return;
                loading = false;
                if (status >= 400 && status < 500 && status != 408) pendingBody = null;
                notice = status == 0 || status >= 500 ? "Connection interrupted. Retry the same action or refresh the trial." : menu.StatusMessage;
            });
            if (!sent) loading = false;
        }
        public void SubmitCommand(string intent)
        {
            if (!CanAct) return;
            Send("{\"action\":\"act\",\"encounterId\":\"" + snapshot.encounter.id + "\",\"requestId\":\"" + Guid.NewGuid() + "\",\"expectedRevision\":" + DisplayedRevision + ",\"command\":" + intent + "}", true);
        }
        void Step(int x, int y)
        {
            if (!CanAct) return;
            var hero = Actor("hero");
            int targetX = hero.position.x + x, targetY = hero.position.y + y;
            var reason = StepBlockReason(hero, targetX, targetY);
            if (reason != null) { notice = reason; return; }
            SubmitCommand("{\"type\":\"move\",\"path\":[{\"x\":" + targetX + ",\"y\":" + targetY + "}]}");
        }
        string StepBlockReason(ActorState hero, int x, int y)
        {
            var map = snapshot.encounter.state.map;
            if (hero.movementRemainingFeet < map.tileSizeFeet) return "Movement spent. End your turn.";
            if (x < 0 || y < 0 || x >= map.width || y >= map.height) return "That step leaves the arena.";
            if (Array.IndexOf(map.blockedCells ?? Array.Empty<string>(), x + "," + y) >= 0) return "A wall blocks that step.";
            var hostile = Actor("sentinel");
            if (hostile.hitPoints > 0 && hostile.position.x == x && hostile.position.y == y) return "The sentinel blocks that step.";
            return null;
        }
        int DistanceFeet(ActorState hero, ActorState hostile)
        {
            return (Math.Abs(hero.position.x-hostile.position.x) + Math.Abs(hero.position.y-hostile.position.y)) * snapshot.encounter.state.map.tileSizeFeet;
        }
        bool CanAttack
        {
            get
            {
                var hero = Actor("hero"); var hostile = Actor("sentinel");
                if (!CanAct || hero == null || hostile == null || hero.actionUsed || hero.weapon == null) return false;
                return DistanceFeet(hero, hostile) <= hero.weapon.rangeFeet;
            }
        }
        void AttackTarget()
        {
            if (CanAttack) SubmitCommand("{\"type\":\"attack\",\"targetId\":\"sentinel\"}");
            else notice = "Move into weapon range and use your available action.";
        }
        bool CanUseSkill(string id)
        {
            var hero = Actor("hero"); var hostile = Actor("sentinel");
            if (!CanAct || hero == null || hero.actionUsed || hero.mana < 1 || Array.IndexOf(hero.abilityIds ?? Array.Empty<string>(), id) < 0) return false;
            if (id == "guarding_vow") return hero.wardArmorBonus == 0;
            return DistanceFeet(hero, hostile) <= 30;
        }
        void UseSkill(string id)
        {
            if (!CanUseSkill(id)) { notice = "This skill needs an available action, mana and a valid target."; return; }
            SubmitCommand("{\"type\":\"skill\",\"skillId\":\"" + id + "\",\"targetId\":\"" + (id=="guarding_vow"?"hero":"sentinel") + "\"}");
        }
        public void ReadMovementInput()
        {
            if (!CanAct || menu.IsOpen) return;
            if (Input.GetKeyDown(KeyCode.F)) AttackTarget();
            else if (Input.GetKeyDown(KeyCode.Alpha1)) UseSkill("spark_burst");
            else if (Input.GetKeyDown(KeyCode.Alpha2)) UseSkill("guarding_vow");
            else if (Input.GetKeyDown(KeyCode.Space)) SubmitCommand("{\"type\":\"end_turn\"}");
            else if (Input.GetKeyDown(KeyCode.W) || Input.GetKeyDown(KeyCode.UpArrow)) Step(0, 1);
            else if (Input.GetKeyDown(KeyCode.S) || Input.GetKeyDown(KeyCode.DownArrow)) Step(0, -1);
            else if (Input.GetKeyDown(KeyCode.A) || Input.GetKeyDown(KeyCode.LeftArrow)) Step(-1, 0);
            else if (Input.GetKeyDown(KeyCode.D) || Input.GetKeyDown(KeyCode.RightArrow)) Step(1, 0);
        }
        void Update()
        {
            if (!InTrial) return;
            world.MoveTrialHero(heroTarget);
            if (wardVisual != null) wardVisual.transform.position = world.HeroPosition + Vector3.up * .025f;
            if (enemy != null)
            {
                enemy.transform.position = Vector3.MoveTowards(enemy.transform.position, enemyTarget, Time.deltaTime * 6);
                var facing = world.HeroPosition - enemy.transform.position; facing.y = 0;
                if (facing.sqrMagnitude > .001f) enemy.transform.rotation = Quaternion.LookRotation(facing);
                feedback.Follow(world.HeroPosition, enemy.transform.position, !menu.IsOpen);
            }
        }
        ActorState Actor(string id)
        {
            if (snapshot?.encounter?.state?.combatants != null)
                foreach (var actor in snapshot.encounter.state.combatants) if (actor.id == id) return actor;
            return null;
        }
        static Vector3 Position(GridPosition p) => ArenaOrigin + new Vector3(p.x * Tile, 0, p.y * Tile);

        // Public for presentation verification. It cannot mutate server state or inventory.
        public void ApplyTrialPresentation(string json)
        {
            var reply = JsonUtility.FromJson<TrialReply>(json);
            if (reply == null) throw new FormatException("Missing trial reply");
            if (reply.encounter == null || string.IsNullOrEmpty(reply.encounter.id)) { ClearPresentation(); notice = "Ready for a camp trial."; return; }
            var state = reply.encounter.state;
            if (reply.encounter.characterId != heroId || state?.map == null || state.combatants == null || state.map.width < 1 || state.map.width > 16 || state.map.height < 1 || state.map.height > 16)
                throw new FormatException("Unexpected trial snapshot");
            if (InTrial && reply.encounter.id == snapshot.encounter.id && state.revision <= DisplayedRevision) return;
            bool entering = !InTrial || reply.encounter.id != snapshot.encounter.id;
            ActorState hero = null, hostile = null;
            foreach (var actor in state.combatants) { if (actor.id == "hero") hero = actor; if (actor.id == "sentinel") hostile = actor; }
            foreach (var actor in new[] { hero, hostile })
                if (actor?.position == null || actor.position.x < 0 || actor.position.y < 0 || actor.position.x >= state.map.width || actor.position.y >= state.map.height || actor.hitPoints < 0 || actor.hitPoints > actor.maxHitPoints || actor.maxHitPoints < 1 || actor.mana < 0 || actor.maxMana < actor.mana || (actor.wardArmorBonus != 0 && actor.wardArmorBonus != 2))
                    throw new FormatException("Invalid trial actors");
            if (state.phase != "active" && state.phase != "completed") throw new FormatException("Unexpected trial phase");
            snapshot = reply;
            if (entering) { BuildArena(state.map); recent.Clear(); world.StartTrialView(); }
            heroTarget = Position(hero.position); enemyTarget = Position(hostile.position);
            if (entering) { world.PlaceTrialHero(heroTarget); enemy.transform.position = enemyTarget; }
            enemy.SetActive(hostile.hitPoints > 0);
            feedback.PresentHealth(hero.hitPoints, hero.maxHitPoints, hostile.hitPoints, hostile.maxHitPoints);
            UpdateWardVisual(hero.wardArmorBonus > 0);
            foreach (var evt in reply.events ?? Array.Empty<TrialEvent>())
            {
                if (evt.kind == "skill" && evt.detail?.skillId == "guarding_vow")
                    recent.Enqueue("Guarding Vow: +2 defense until your next turn.");
                else if (evt.kind == "attack" || (evt.kind == "skill" && evt.detail?.skillId == "spark_burst") || (evt.kind == "hostile_turn" && evt.detail?.outcome != "approach" && evt.detail?.attack != null))
                {
                    bool player = evt.kind != "hostile_turn";
                    if (player) { world.FaceTrialTarget(enemyTarget); world.PlayTrialAttack(); }
                    if (evt.kind == "skill")
                    {
                        if (sparkRoutine != null) StopCoroutine(sparkRoutine);
                        sparkRoutine = StartCoroutine(SparkVisual());
                    }
                    var hit = evt.detail?.attack;
                    feedback.PresentAttack(player, hit != null && hit.hit, hit?.damage ?? 0, evt.kind == "skill");
                    recent.Enqueue((player ? "You" : "Sentinel") + (hit != null && hit.hit ? " hit for " + hit.damage + "." : " missed."));
                }
                while (recent.Count > 3) recent.Dequeue();
            }
            notice = state.phase == "completed" ? (state.outcome == "heroes_win" ? "Trial won." : state.outcome == "abandoned" ? "Trial ended." : "Defeated. You can train again.") : "Your turn. Step into range, attack, then end your turn.";
        }
        void UpdateWardVisual(bool active)
        {
            if (!active) { if (wardVisual != null) { wardVisual.SetActive(false); Destroy(wardVisual); } wardVisual=null; return; }
            if (wardVisual != null) return;
            wardVisual = GameObject.CreatePrimitive(PrimitiveType.Cylinder); wardVisual.name="Guarding Vow aura";
            wardVisual.transform.SetParent(arena.transform,false); wardVisual.transform.localScale=new Vector3(1.25f,.018f,1.25f);
            var collider=wardVisual.GetComponent<Collider>(); collider.enabled=false; Destroy(collider);
            wardVisual.GetComponent<Renderer>().sharedMaterial=Mat(new Color(.15f,.65f,.8f));
            wardVisual.transform.position=world.HeroPosition+Vector3.up*.025f;
        }
        IEnumerator SparkVisual()
        {
            var spark=GameObject.CreatePrimitive(PrimitiveType.Sphere); spark.name="Spark Burst visual";
            spark.transform.SetParent(arena.transform,false);spark.transform.localScale=Vector3.one*.22f;
            var collider=spark.GetComponent<Collider>();collider.enabled=false;Destroy(collider);
            spark.GetComponent<Renderer>().sharedMaterial=Mat(new Color(.3f,.55f,1f));
            Vector3 start=world.HeroPosition+Vector3.up*1.25f, end=enemyTarget+Vector3.up;float elapsed=0;
            while(elapsed<.25f && spark!=null) { spark.transform.position=Vector3.Lerp(start,end,elapsed/.25f); elapsed+=Time.deltaTime; yield return null; }
            if(spark!=null) Destroy(spark);
            sparkRoutine=null;
        }
        void BuildArena(MapState map)
        {
            ReleaseArena(); arena = new GameObject("Camp Trial Arena");
            var stone = Mat(new Color(.28f, .31f, .34f)); var light = Mat(new Color(.38f, .42f, .43f)); var wood = Mat(new Color(.48f, .24f, .10f));
            for (int y=0;y<map.height;y++) for (int x=0;x<map.width;x++)
            {
                var position = Position(new GridPosition {x=x,y=y});
                Primitive("Trial tile", PrimitiveType.Cube, position - Vector3.up * .12f, new Vector3(Tile-.025f,.10f,Tile-.025f), (x+y)%2==0?stone:light, arena.transform);
            }
            foreach (var key in map.blockedCells ?? Array.Empty<string>())
            {
                var parts = key.Split(',');
                if (parts.Length==2 && int.TryParse(parts[0],out int x) && int.TryParse(parts[1],out int y))
                    Primitive("Trial obstacle",PrimitiveType.Cube,Position(new GridPosition{x=x,y=y})+Vector3.up*.8f,new Vector3(1.35f,1.6f,1.35f),stone,arena.transform);
            }
            enemy = new GameObject("Camp Sentinel"); enemy.transform.SetParent(arena.transform);
            var motion = new GameObject("Sentinel motion").transform; motion.SetParent(enemy.transform,false);
            Primitive("Sentinel body",PrimitiveType.Cylinder,Vector3.up*.85f,new Vector3(.65f,.6f,.65f),wood,motion,true);
            Primitive("Sentinel head",PrimitiveType.Sphere,Vector3.up*1.65f,Vector3.one*.4f,wood,motion,true);
            Primitive("Sentinel arms",PrimitiveType.Cube,Vector3.up*1.25f,new Vector3(1.2f,.18f,.18f),wood,motion,true);
            feedback = arena.AddComponent<ButcherTrialFeedback>(); feedback.Configure(motion);
        }
        Material Mat(Color color) { var material = new Material(Shader.Find("Universal Render Pipeline/Lit")) { color=color }; materials.Add(material); return material; }
        static void Primitive(string name, PrimitiveType type, Vector3 position, Vector3 scale, Material material, Transform parent, bool local=false)
        {
            var obj=GameObject.CreatePrimitive(type);obj.name=name;obj.transform.SetParent(parent,false);
            if (local) obj.transform.localPosition=position; else obj.transform.position=position;
            obj.transform.localScale=scale;obj.GetComponent<Renderer>().sharedMaterial=material;
        }
        void ReleaseArena()
        {
            if (sparkRoutine != null) { StopCoroutine(sparkRoutine); sparkRoutine=null; }
            if (arena != null) { arena.SetActive(false); Destroy(arena); } arena=null; enemy=null; wardVisual=null;
            feedback=null;
            foreach (var material in materials) if (material != null) Destroy(material); materials.Clear();
        }
        public void ClearPresentation()
        {
            bool returning=InTrial; snapshot=null; ReleaseArena(); recent.Clear();
            if (returning) world.PlaceTrialHero(new Vector3(0,.1f,-12));
        }
        void OnDestroy() { ReleaseArena(); }
        void OnGUI()
        {
            if (menu == null || menu.IsOpen) return;
            float scale=Mathf.Max(.6f,Mathf.Min(Screen.width/1280f,Screen.height/720f));
            GUI.matrix=Matrix4x4.TRS(Vector3.zero,Quaternion.identity,Vector3.one*scale);
            float w=Screen.width/scale,h=Screen.height/scale;
            if (text==null) text=new GUIStyle(GUI.skin.label){fontSize=17,wordWrap=true};
            if (!InTrial)
            {
                GUI.enabled=menu.IsSignedIn&&!string.IsNullOrEmpty(heroId)&&!menu.IsBusy&&!loading&&pendingBody==null;
                if (GUI.Button(new Rect(w-204,140,180,48),"Camp trial")) StartTrial(); GUI.enabled=true;
                if (!string.IsNullOrEmpty(notice)) GUI.Label(new Rect(w-400,196,376,90),notice,text);
                if (pendingBody!=null && !menu.IsBusy && GUI.Button(new Rect(w-204,290,180,44),"Retry trial request")) Send(pendingBody,true);
                return;
            }
            var hero=Actor("hero");var hostile=Actor("sentinel");
            GUI.Box(new Rect(18,152,490,148),"");
            string range = hero.weapon == null ? "No weapon" : "Weapon range: " + hero.weapon.rangeFeet + " ft";
            GUI.Label(new Rect(34,162,456,136),"CAMP TRIAL · Practice\n"+hero.name+": "+hero.hitPoints+" / "+hero.maxHitPoints+" HP · Sentinel: "+hostile.hitPoints+" / "+hostile.maxHitPoints+" HP\nMovement: "+hero.movementRemainingFeet+" ft · "+(hero.actionUsed?"Action used":"Action ready")+"\nMana: "+hero.mana+" / "+hero.maxMana+" · Defense: "+hero.armorClass+(hero.wardArmorBonus>0?" (ward active)":"")+"\nSentinel: "+DistanceFeet(hero,hostile)+" ft away · "+range,text);
            GUI.Box(new Rect(18,360,490,150),"");
            GUI.Label(new Rect(34,370,456,130),notice+"\n"+string.Join("\n",recent.ToArray()),text);
            if (snapshot.encounter.state.phase=="completed")
            {
                if (GUI.Button(new Rect(w/2-110,h-92,220,52),"Return to camp")) {ClearPresentation();menu.RefreshInventory();}
                return;
            }
            if (Array.IndexOf(hero.abilityIds ?? Array.Empty<string>(), "spark_burst") >= 0)
            { GUI.enabled=CanUseSkill("spark_burst"); if(GUI.Button(new Rect(w/2-260,h-148,160,44),"Spark [1] · 1 mana"))UseSkill("spark_burst"); }
            if (Array.IndexOf(hero.abilityIds ?? Array.Empty<string>(), "guarding_vow") >= 0)
            { GUI.enabled=CanUseSkill("guarding_vow"); if(GUI.Button(new Rect(w/2-90,h-148,160,44),"Ward [2] · 1 mana"))UseSkill("guarding_vow"); }
            GUI.enabled=CanAttack;
            if(GUI.Button(new Rect(w/2-260,h-92,160,52),"Attack [F]"))AttackTarget();
            GUI.enabled=CanAct;
            if(GUI.Button(new Rect(w/2-90,h-92,160,52),"End turn [Space]"))SubmitCommand("{\"type\":\"end_turn\"}");
            DrawStepButton(hero, new Rect(86,h-174,64,64), "↑", 0, 1);
            DrawStepButton(hero, new Rect(22,h-108,64,64), "←", -1, 0);
            DrawStepButton(hero, new Rect(86,h-108,64,64), "↓", 0, -1);
            DrawStepButton(hero, new Rect(150,h-108,64,64), "→", 1, 0);
            GUI.enabled=CanAct;
            if(GUI.Button(new Rect(w-184,h-92,160,52),"Leave trial"))SubmitCommand("{\"type\":\"abandon\"}");
            GUI.enabled=!menu.IsBusy;
            if(GUI.Button(new Rect(w-204,140,180,44),"Refresh trial"))RefreshTrial();
            if(pendingBody!=null && GUI.Button(new Rect(w-204,194,180,44),"Retry same action"))Send(pendingBody,true);
            GUI.enabled=true;
        }
        void DrawStepButton(ActorState hero, Rect rect, string label, int dx, int dy)
        {
            GUI.enabled = CanAct && StepBlockReason(hero, hero.position.x + dx, hero.position.y + dy) == null;
            if (GUI.Button(rect, label)) Step(dx, dy);
        }
        [Serializable] public class TrialReply { public TrialEnvelope encounter; public TrialEvent[] events; }
        [Serializable] public class TrialEnvelope { public string id,characterId; public State state; }
        [Serializable] public class State { public string id,phase,outcome; public int revision; public MapState map; public ActorState[] combatants; }
        [Serializable] public class MapState { public int width,height,tileSizeFeet; public string[] blockedCells; }
        [Serializable] public class GridPosition { public int x,y; }
        [Serializable] public class ActorState { public string id,name; public int hitPoints,maxHitPoints,movementRemainingFeet,mana,maxMana,wardArmorBonus,armorClass; public string[] abilityIds; public bool actionUsed; public GridPosition position; public WeaponState weapon; }
        [Serializable] public class WeaponState { public string id; public int rangeFeet; }
        [Serializable] public class TrialEvent { public string kind; public EventDetail detail; }
        [Serializable] public class EventDetail { public Attack attack; public string skillId,outcome; public int manaSpent,wardArmorBonus; }
        [Serializable] public class Attack { public bool hit; public int damage; }
    }
}
