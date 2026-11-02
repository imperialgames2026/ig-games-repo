using System;
using System.Collections;
using UnityEngine;
using UnityEngine.Networking;

namespace Imperial.Butcher
{
    // Opt-in startup verification for a built player; never signs in or mutates the lab.
    public sealed class ButcherSmokeProbe : MonoBehaviour
    {
        string reportPath;
        [Serializable] class Result { public bool passed; public string check; }
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        static void Initialize()
        {
            var args = Environment.GetCommandLineArgs();
            if (Array.IndexOf(args, "--butcher-smoke-test") < 0) return;
            var probe = new GameObject("Butcher startup verification").AddComponent<ButcherSmokeProbe>();
            int reportIndex = Array.IndexOf(args, "--butcher-smoke-report");
            if (reportIndex >= 0 && reportIndex + 1 < args.Length) probe.reportPath = args[reportIndex + 1];
        }

        IEnumerator Start()
        {
            for (int i=0;i<5;i++) yield return null;
            var world = UnityEngine.Object.FindFirstObjectByType<ButcherWorld>();
            var animator = UnityEngine.Object.FindFirstObjectByType<Animator>();
            if (world == null || animator == null || !animator.isHuman || !animator.isInitialized)
            { Fail("scene_or_humanoid"); yield break; }
            if (Resources.Load<ButcherEquipmentCatalog>("EquipmentVisualCatalog") == null)
            { Fail("equipment_catalog"); yield break; }
            int count = world.ApplyEquipmentVisuals(new[] {
                new ButcherWorld.EquippedVisualSelection { definitionId="practice_sword", definitionVersion=1, slot="main_hand" },
                new ButcherWorld.EquippedVisualSelection { definitionId="travel_coat", definitionVersion=1, slot="body" }
            });
            if (count != 2) { Fail("equipment_attachments"); yield break; }
            if (UnityEngine.Object.FindFirstObjectByType<ButcherCombatController>() == null || !animator.HasState(0, Animator.StringToHash("Attack")))
            { Fail("trial_controller_or_attack_animation"); yield break; }
            foreach (var function in new[] { "butcher-characters", "butcher-encounters" })
            {
            string endpoint = "https://jvyzpxjqmymafjapprpp.supabase.co/functions/v1/" + function;
            using (var request = new UnityWebRequest(endpoint, "OPTIONS"))
            {
                request.downloadHandler = new DownloadHandlerBuffer();request.timeout=20;
                yield return request.SendWebRequest();
                if (request.responseCode!=204) { Fail("lab_connection_"+request.responseCode); yield break; }
            }
            using (var request = new UnityWebRequest(endpoint, "POST"))
            {
                request.downloadHandler=new DownloadHandlerBuffer();request.timeout=20;
                request.uploadHandler=new UploadHandlerRaw(System.Text.Encoding.UTF8.GetBytes("{}"));
                request.SetRequestHeader("content-type","application/json");
                yield return request.SendWebRequest();
                if (request.responseCode!=401) { Fail("auth_guard_"+request.responseCode); yield break; }
            }
            }
            Debug.Log("BUTCHER_SMOKE_PASS: scene, humanoid, catalog, attachments, lab TLS and unsigned-request rejection");
            WriteResult(true, "scene,humanoid,catalog,attachments,trial_controller,attack_animation,characters_tls,encounters_tls,auth_guards");
            Application.Quit(0);
        }
        void WriteResult(bool passed, string check)
        {
            if (!string.IsNullOrEmpty(reportPath)) System.IO.File.WriteAllText(reportPath, JsonUtility.ToJson(new Result { passed=passed, check=check }));
        }
        void Fail(string check) { WriteResult(false, check); Debug.LogError("BUTCHER_SMOKE_FAIL: "+check); Application.Quit(1); }
    }
}
