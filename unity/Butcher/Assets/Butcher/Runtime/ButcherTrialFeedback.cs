using System.Collections.Generic;
using UnityEngine;

namespace Imperial.Butcher
{
    // Accepted results only. This component never submits actions or changes combat state.
    public sealed class ButcherTrialFeedback : MonoBehaviour
    {
        sealed class Cue
        {
            public string text;
            public bool onHero;
            public Color color;
            public float expires;
        }
        readonly List<Cue> cues = new List<Cue>();
        Transform sentinelMotion;
        Vector3 heroPosition, sentinelPosition;
        int heroHp, heroMax, sentinelHp, sentinelMax;
        bool visible;
        float swingRemaining, hitRemaining;
        Renderer[] sentinelRenderers;
        MaterialPropertyBlock flash;
        GUIStyle label, popup;
        const float CueSeconds = 1.6f;
        public int HitCount { get; private set; }
        public int MissCount { get; private set; }
        public int SentinelAttackCount { get; private set; }
        public string LastFeedback { get; private set; }
        public int HeroHealth => heroHp;
        public int SentinelHealth => sentinelHp;
        public bool SentinelSwinging => swingRemaining > 0;
        public bool HealthBarsDrawn { get; private set; }
        public bool HealthBarsOverlap { get; private set; }

        public void Configure(Transform motion)
        {
            sentinelMotion = motion;
            sentinelRenderers = motion.GetComponentsInChildren<Renderer>();
            flash = new MaterialPropertyBlock();
        }
        public void PresentHealth(int hp, int maxHp, int targetHp, int targetMax)
        {
            heroHp = hp; heroMax = maxHp; sentinelHp = targetHp; sentinelMax = targetMax;
        }
        public void Follow(Vector3 hero, Vector3 sentinel, bool show)
        {
            heroPosition = hero; sentinelPosition = sentinel; visible = show;
        }
        public void PresentAttack(bool player, bool hit, int damage, bool spark)
        {
            if (hit) HitCount++; else MissCount++;
            if (!player) { SentinelAttackCount++; swingRemaining = .6f; }
            if (player && hit) hitRemaining = .25f;
            LastFeedback = (spark ? "SPARK " : "") + (hit ? "−" + damage : "MISS");
            if (cues.Count == 8) cues.RemoveAt(0);
            cues.Add(new Cue { text = LastFeedback, onHero = !player,
                color = hit ? (player ? new Color(1,.85f,.35f) : new Color(1,.42f,.35f)) : new Color(.85f,.88f,.94f),
                expires = Time.unscaledTime + CueSeconds });
        }
        void Update()
        {
            cues.RemoveAll(c => c.expires <= Time.unscaledTime);
            swingRemaining = Mathf.Max(0, swingRemaining - Time.unscaledDeltaTime);
            hitRemaining = Mathf.Max(0, hitRemaining - Time.unscaledDeltaTime);
            if (sentinelMotion != null)
                sentinelMotion.localRotation = Quaternion.Euler(Mathf.Sin((1-swingRemaining/.6f)*Mathf.PI) * (swingRemaining>0 ? -32 : 0), 0, 0);
            if (sentinelRenderers == null) return;
            // Property blocks keep hit flashes out of shared materials and the saved scene.
            foreach (var renderer in sentinelRenderers)
            {
                if (renderer == null) continue;
                if (hitRemaining > 0) { flash.SetColor("_BaseColor", new Color(1,.65f,.28f)); renderer.SetPropertyBlock(flash); }
                else renderer.SetPropertyBlock(null);
            }
        }
        void OnGUI()
        {
            HealthBarsDrawn = false;
            if (!visible || Camera.main == null || heroMax < 1 || sentinelMax < 1) return;
            var matrix = GUI.matrix; var color = GUI.color; bool enabled = GUI.enabled;
            GUI.matrix = Matrix4x4.identity; GUI.enabled = true;
            float scale = Mathf.Clamp(Mathf.Min(Screen.width/1280f, Screen.height/720f), .6f, 2);
            if (label == null) label = new GUIStyle(GUI.skin.label) { alignment = TextAnchor.MiddleCenter, fontStyle = FontStyle.Bold };
            if (popup == null) popup = new GUIStyle(label);
            label.fontSize = Mathf.RoundToInt(13*scale); popup.fontSize = Mathf.RoundToInt(20*scale);
            bool heroOnScreen = BarRect(heroPosition, scale, out var heroBar);
            bool sentinelOnScreen = BarRect(sentinelPosition, scale, out var sentinelBar);
            if (heroOnScreen && sentinelOnScreen && BarBounds(heroBar,scale).Overlaps(BarBounds(sentinelBar,scale)))
            {
                heroBar.y = sentinelBar.y - 42*scale;
                if (heroBar.y < 28*scale) { heroBar.y = 28*scale; sentinelBar.y = 70*scale; }
            }
            HealthBarsDrawn = heroOnScreen && sentinelOnScreen;
            HealthBarsOverlap = HealthBarsDrawn && BarBounds(heroBar,scale).Overlaps(BarBounds(sentinelBar,scale));
            if (heroOnScreen) Bar(heroBar, "HERO", heroHp, heroMax, new Color(.25f,.8f,.48f), scale);
            if (sentinelOnScreen) Bar(sentinelBar, "SENTINEL", sentinelHp, sentinelMax, new Color(.88f,.36f,.25f), scale);
            for (int i=0;i<cues.Count;i++)
            {
                var cue = cues[i];
                var point = Camera.main.WorldToScreenPoint((cue.onHero ? heroPosition : sentinelPosition) + Vector3.up*2.6f);
                if (point.z <= 0) continue;
                float age = 1-(cue.expires-Time.unscaledTime)/CueSeconds;
                GUI.color = new Color(cue.color.r,cue.color.g,cue.color.b,Mathf.Clamp01((1-age)*3));
                GUI.Label(new Rect(point.x-90*scale,Screen.height-point.y-age*30*scale-i*22*scale,180*scale,30*scale),cue.text,popup);
            }
            GUI.matrix = matrix; GUI.color = color; GUI.enabled = enabled;
        }
        static Rect BarBounds(Rect bar, float scale) => new Rect(bar.x-25*scale,bar.y-25*scale,bar.width+50*scale,bar.height+29*scale);
        static bool BarRect(Vector3 position, float scale, out Rect rect)
        {
            var point = Camera.main.WorldToScreenPoint(position + Vector3.up*2.15f);
            rect = new Rect(point.x-58*scale, Screen.height-point.y,116*scale,9*scale);
            return point.z > 0 && point.x >= 0 && point.x <= Screen.width && point.y >= 0 && point.y <= Screen.height;
        }
        void Bar(Rect rect, string name, int hp, int max, Color fill, float scale)
        {
            GUI.color = new Color(.035f,.045f,.055f,.95f);
            GUI.DrawTexture(new Rect(rect.x-2*scale,rect.y-2*scale,rect.width+4*scale,rect.height+4*scale),Texture2D.whiteTexture);
            GUI.color = fill;
            GUI.DrawTexture(new Rect(rect.x,rect.y,rect.width*Mathf.Clamp01((float)hp/max),rect.height),Texture2D.whiteTexture);
            GUI.color = Color.white;
            GUI.Label(new Rect(rect.x-25*scale,rect.y-25*scale,rect.width+50*scale,22*scale),name+"  "+hp+" / "+max,label);
        }
    }
}
