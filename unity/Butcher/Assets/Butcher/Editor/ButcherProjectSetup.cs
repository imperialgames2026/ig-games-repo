using System.IO;
using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace Imperial.Butcher.Editor
{
    [InitializeOnLoad]
    public static class ButcherProjectSetup
    {
        const string ResourceFolder = "Assets/Butcher/Resources";

        static ButcherProjectSetup()
        {
            EditorApplication.delayCall += EnsureSetup;
        }

        [MenuItem("Butcher/Configure graphics profiles")]
        public static void EnsureSetup()
        {
            if (EditorApplication.isCompiling || EditorApplication.isPlayingOrWillChangePlaymode) return;
            if (AssetDatabase.LoadAssetAtPath<UniversalRenderPipelineAsset>(ResourceFolder + "/ButcherDesktop.asset") != null) return;
            Directory.CreateDirectory(ResourceFolder);
            AssetDatabase.Refresh();
            var renderer = ScriptableObject.CreateInstance<UniversalRendererData>();
            renderer.name = "ButcherRenderer";
            AssetDatabase.CreateAsset(renderer, ResourceFolder + "/ButcherRenderer.asset");
            var desktop = CreateProfile("ButcherDesktop", renderer, 4, 80, 2048);
            CreateProfile("ButcherMobile", renderer, 2, 35, 1024);
            GraphicsSettings.defaultRenderPipeline = desktop;
            QualitySettings.renderPipeline = desktop;
            PlayerSettings.companyName = "Imperial Gaming LLC";
            PlayerSettings.productName = "Butcher";
            PlayerSettings.defaultScreenWidth = 1920;
            PlayerSettings.defaultScreenHeight = 1080;
            PlayerSettings.defaultInterfaceOrientation = UIOrientation.LandscapeLeft;
            PlayerSettings.runInBackground = true;
            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene("Assets/Butcher/Scenes/Camp.unity", true) };
            AssetDatabase.SaveAssets();
            Debug.Log("Butcher desktop and mobile graphics profiles created. Open Camp and press Play.");
        }

        static UniversalRenderPipelineAsset CreateProfile(string name, UniversalRendererData renderer, int samples, float distance, int resolution)
        {
            var asset = UniversalRenderPipelineAsset.Create(renderer);
            asset.name = name;
            asset.supportsHDR = true;
            asset.msaaSampleCount = samples;
            asset.renderScale = 1;
            asset.shadowDistance = distance;
            asset.mainLightShadowmapResolution = resolution;
            AssetDatabase.CreateAsset(asset, ResourceFolder + "/" + name + ".asset");
            return asset;
        }
    }
}
