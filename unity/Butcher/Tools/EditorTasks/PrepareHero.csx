if (UnityEditor.EditorApplication.isPlaying) throw new System.Exception("Stop Play mode before preparing assets");
string art = "Assets/Butcher/Art";
System.IO.Directory.CreateDirectory(art + "/Animation");
UnityEditor.AssetDatabase.Refresh();
string models = "Assets/PolysplitGames/LowPolyMedievalFantasyHeroes/";
string animations = "Assets/Kevin Iglesias/Human Animations/Animations/Male/";
string[] sources = { animations + "Idles/HumanM@Idle01.fbx", animations + "Movement/Walk/HumanM@Walk01_Forward.fbx", animations + "Movement/Run/HumanM@Run01_Forward.fbx" };
string[] names = { "Idle", "Walk", "Run" };
var clips = new UnityEngine.AnimationClip[3];
for (int i=0; i<3; i++)
{
    string path=art+"/Animation/"+names[i]+".anim";
    clips[i]=UnityEditor.AssetDatabase.LoadAssetAtPath<UnityEngine.AnimationClip>(path);
    if(clips[i]!=null) continue;
    UnityEngine.AnimationClip original=null;
    foreach(var asset in UnityEditor.AssetDatabase.LoadAllAssetsAtPath(sources[i]))
        if(asset is UnityEngine.AnimationClip c && !c.name.StartsWith("__preview__")) original=c;
    if(original==null) throw new System.Exception("Missing animation: "+sources[i]);
    clips[i]=UnityEngine.Object.Instantiate(original);
    clips[i].name=names[i];
    var settings=UnityEditor.AnimationUtility.GetAnimationClipSettings(clips[i]);
    settings.loopTime=true;
    settings.loopBlend=true;
    UnityEditor.AnimationUtility.SetAnimationClipSettings(clips[i],settings);
    UnityEditor.AssetDatabase.CreateAsset(clips[i],path);
}
string controllerPath=art+"/Animation/HeroLocomotion.controller";
var controller=UnityEditor.AssetDatabase.LoadAssetAtPath<UnityEditor.Animations.AnimatorController>(controllerPath);
if(controller==null)
{
    controller=UnityEditor.Animations.AnimatorController.CreateAnimatorControllerAtPath(controllerPath);
    controller.AddParameter("Speed",UnityEngine.AnimatorControllerParameterType.Float);
    var machine=controller.layers[0].stateMachine;
    var state=machine.AddState("Locomotion");
    machine.defaultState=state;
    var blend=new UnityEditor.Animations.BlendTree { name="Idle Walk Run",blendType=UnityEditor.Animations.BlendTreeType.Simple1D,blendParameter="Speed",useAutomaticThresholds=false };
    UnityEditor.AssetDatabase.AddObjectToAsset(blend,controller);
    blend.AddChild(clips[0],0);
    blend.AddChild(clips[1],2.3f);
    blend.AddChild(clips[2],5.5f);
    state.motion=blend;
}
UnityEngine.Avatar avatar=null;
foreach(var asset in UnityEditor.AssetDatabase.LoadAllAssetsAtPath(models+"BaseCharacters/BaseMale.fbx"))
    if(asset is UnityEngine.Avatar a && a.isHuman && a.isValid) avatar=a;
if(avatar==null) throw new System.Exception("No valid humanoid avatar");
var source=UnityEditor.AssetDatabase.LoadAssetAtPath<UnityEngine.GameObject>(models+"BasicHeroes/prefabs/M_Knight.prefab");
if(source==null) throw new System.Exception("Knight prefab missing");
var root=new UnityEngine.GameObject("Butcher Knight");
try
{
    var visual=(UnityEngine.GameObject)UnityEditor.PrefabUtility.InstantiatePrefab(source);
    visual.transform.SetParent(root.transform,false);
    visual.transform.localPosition=UnityEngine.Vector3.zero;
    var animator=visual.GetComponent<UnityEngine.Animator>();
    if(animator==null) animator=visual.AddComponent<UnityEngine.Animator>();
    animator.avatar=avatar;
    animator.runtimeAnimatorController=controller;
    animator.applyRootMotion=false;
    var renderers=visual.GetComponentsInChildren<UnityEngine.Renderer>();
    if(renderers.Length==0) throw new System.Exception("Knight has no visible renderers");
    var bounds=renderers[0].bounds;
    foreach(var r in renderers) bounds.Encapsulate(r.bounds);
    if(bounds.size.y<.01f) throw new System.Exception("Knight has invalid bounds");
    visual.transform.localScale*=1.8f/bounds.size.y;
    bounds=renderers[0].bounds;
    foreach(var r in renderers) bounds.Encapsulate(r.bounds);
    visual.transform.localPosition-=UnityEngine.Vector3.up*bounds.min.y;
    foreach(var collider in visual.GetComponentsInChildren<UnityEngine.Collider>(true)) UnityEngine.Object.DestroyImmediate(collider);
    var prepared=UnityEditor.PrefabUtility.SaveAsPrefabAsset(root,art+"/HeroKnight.prefab");
    var world=UnityEngine.Object.FindFirstObjectByType<Imperial.Butcher.ButcherWorld>();
    var serialized=new UnityEditor.SerializedObject(world);
    serialized.FindProperty("heroVisualPrefab").objectReferenceValue=prepared;
    string forest="Assets/POLY STYLE - Platformer Starter Pack/Platformer Starter Pack_URP/";
    var trees=serialized.FindProperty("treePrefabs"); trees.arraySize=3;
    for(int i=0;i<3;i++)
    {
        var tree=UnityEditor.AssetDatabase.LoadAssetAtPath<UnityEngine.GameObject>(forest+"Prefabs/Environments/Tree_"+(i+1)+".prefab");
        if(tree==null || tree.GetComponentsInChildren<UnityEngine.Renderer>().Length==0) throw new System.Exception("Tree prefab missing usable renderers");
        trees.GetArrayElementAtIndex(i).objectReferenceValue=tree;
    }
    serialized.FindProperty("skyboxMaterial").objectReferenceValue=UnityEditor.AssetDatabase.LoadAssetAtPath<UnityEngine.Material>(forest+"Art/Materials/Skybox_Mat.mat");
    serialized.ApplyModifiedProperties();
    var scene=UnityEngine.SceneManagement.SceneManager.GetActiveScene();
    UnityEditor.SceneManagement.EditorSceneManager.MarkSceneDirty(scene);
    UnityEditor.SceneManagement.EditorSceneManager.SaveScene(scene);
    UnityEditor.AssetDatabase.SaveAssets();
    return "Saved animated knight, three tree variants, and skybox in Camp";
}
finally { UnityEngine.Object.DestroyImmediate(root); }
