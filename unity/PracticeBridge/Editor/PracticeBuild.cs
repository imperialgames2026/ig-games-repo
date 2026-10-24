using System.IO;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEditor.Build;
using UnityEditor.SceneManagement;
using UnityEngine;
public static class PracticeBuild {
 public static void Build(){
  Directory.CreateDirectory("Assets/Resources");
  var font=Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
  
  // Built-in fonts are referenced by a scene asset to survive stripping.
  var scene=EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
  var go=new GameObject("PracticeBridge");var bridge=go.AddComponent<PracticeBridge>();var visuals=go.AddComponent<CasinoScene>();
  UnityEditor.Events.UnityEventTools.AddPersistentListener(bridge.onPresentationRequested,visuals.Present);
  // Save a serialized font holder, resolved at runtime by CasinoScene.
  var holder=go.AddComponent<PracticeFont>();holder.font=font;holder.crapsCloth=AssetDatabase.LoadAssetAtPath<Texture2D>("Assets/Art/CrapsCloth.png");holder.rouletteCloth=AssetDatabase.LoadAssetAtPath<Texture2D>("Assets/Art/RouletteCloth.png");
  foreach(var type in new[]{PrimitiveType.Cube,PrimitiveType.Sphere,PrimitiveType.Cylinder,PrimitiveType.Capsule}){
   var primitive=GameObject.CreatePrimitive(type);var mesh=primitive.GetComponent<MeshFilter>().sharedMesh;
   switch(type){case PrimitiveType.Cube:holder.cube=mesh;break;case PrimitiveType.Sphere:holder.sphere=mesh;break;case PrimitiveType.Cylinder:holder.cylinder=mesh;break;case PrimitiveType.Capsule:holder.capsule=mesh;break;}
   Object.DestroyImmediate(primitive);
  }
  holder.standardMaterial=new Material(Shader.Find("Standard"));AssetDatabase.CreateAsset(holder.standardMaterial,"Assets/PracticeStandard.mat");
  EditorSceneManager.SaveScene(scene,"Assets/Practice.unity");
  PlayerSettings.companyName="Imperial Gaming LLC";PlayerSettings.productName="Imperial Practice Tables";
  UnityEditor.WebGL.UserBuildSettings.codeOptimization=UnityEditor.WebGL.WasmCodeOptimization.DiskSizeLTO;
  PlayerSettings.WebGL.compressionFormat=WebGLCompressionFormat.Disabled;
  PlayerSettings.WebGL.dataCaching=true;
  PlayerSettings.WebGL.initialMemorySize=128;
  PlayerSettings.WebGL.maximumMemorySize=512;
  PlayerSettings.runInBackground=true;PlayerSettings.colorSpace=ColorSpace.Linear;
  PlayerSettings.SetApiCompatibilityLevel(NamedBuildTarget.WebGL,ApiCompatibilityLevel.NET_Standard);
  var report=BuildPipeline.BuildPlayer(new BuildPlayerOptions{scenes=new[]{"Assets/Practice.unity"},locationPathName="Build/WebGL",target=BuildTarget.WebGL,options=BuildOptions.None});
  if(report.summary.result!=BuildResult.Succeeded)throw new System.Exception("Practice build failed: "+report.summary.result);
  Debug.Log("IMPERIAL_PRACTICE_BUILD_SUCCESS bytes="+report.summary.totalSize);
 }
}
