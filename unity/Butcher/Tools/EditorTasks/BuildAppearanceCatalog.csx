if(UnityEditor.EditorApplication.isPlaying) throw new System.Exception("Stop Play mode before saving appearance assets");
string root="Assets/Butcher/Art/";
var controller=UnityEditor.AssetDatabase.LoadAssetAtPath<UnityEditor.Animations.AnimatorController>(root+"Animation/HeroLocomotion.controller");
UnityEngine.Avatar avatar=null;
foreach(var asset in UnityEditor.AssetDatabase.LoadAllAssetsAtPath("Assets/PolysplitGames/LowPolyMedievalFantasyHeroes/BaseCharacters/BaseMale.fbx"))
    if(asset is UnityEngine.Avatar a && a.isValid && a.isHuman) avatar=a;
if(avatar==null || controller==null) throw new System.Exception("PrepareHero must run first");
string[] ids={"knight","scout","spellweaver"};
string[] models={"M_Knight","M_Rogue","M_Mage"};
var prefabs=new UnityEngine.GameObject[3];
for(int i=0;i<3;i++)
{
    var source=UnityEditor.AssetDatabase.LoadAssetAtPath<UnityEngine.GameObject>("Assets/PolysplitGames/LowPolyMedievalFantasyHeroes/BasicHeroes/prefabs/"+models[i]+".prefab");
    if(source==null) throw new System.Exception("Missing model "+models[i]);
    var wrapper=new UnityEngine.GameObject("Butcher "+ids[i]);
    try
    {
        var visual=(UnityEngine.GameObject)UnityEditor.PrefabUtility.InstantiatePrefab(source);
        visual.transform.SetParent(wrapper.transform,false);
        visual.transform.localPosition=UnityEngine.Vector3.zero;
        var animator=visual.GetComponent<UnityEngine.Animator>();
        if(animator==null) animator=visual.AddComponent<UnityEngine.Animator>();
        animator.avatar=avatar;
        animator.runtimeAnimatorController=controller;
        animator.applyRootMotion=false;
        var renderers=visual.GetComponentsInChildren<UnityEngine.Renderer>();
        if(renderers.Length==0) throw new System.Exception("No visible mesh for "+models[i]);
        var bounds=renderers[0].bounds;
        foreach(var renderer in renderers) bounds.Encapsulate(renderer.bounds);
        visual.transform.localScale*=1.8f/bounds.size.y;
        bounds=renderers[0].bounds;
        foreach(var renderer in renderers) bounds.Encapsulate(renderer.bounds);
        visual.transform.localPosition-=UnityEngine.Vector3.up*bounds.min.y;
        foreach(var collider in visual.GetComponentsInChildren<UnityEngine.Collider>(true)) UnityEngine.Object.DestroyImmediate(collider);
        prefabs[i]=UnityEditor.PrefabUtility.SaveAsPrefabAsset(wrapper,root+"Hero-"+ids[i]+".prefab");
    }
    finally { UnityEngine.Object.DestroyImmediate(wrapper); }
}
string catalogPath=root+"AppearanceCatalog.asset";
var catalog=UnityEditor.AssetDatabase.LoadAssetAtPath<Imperial.Butcher.ButcherAppearanceCatalog>(catalogPath);
if(catalog==null)
{
    catalog=UnityEngine.ScriptableObject.CreateInstance<Imperial.Butcher.ButcherAppearanceCatalog>();
    UnityEditor.AssetDatabase.CreateAsset(catalog,catalogPath);
}
var so=new UnityEditor.SerializedObject(catalog);
var entries=so.FindProperty("entries"); entries.arraySize=3;
for(int i=0;i<3;i++)
{
    entries.GetArrayElementAtIndex(i).FindPropertyRelative("visualId").stringValue=ids[i];
    entries.GetArrayElementAtIndex(i).FindPropertyRelative("prefab").objectReferenceValue=prefabs[i];
}
so.ApplyModifiedProperties();
var world=UnityEngine.Object.FindFirstObjectByType<Imperial.Butcher.ButcherWorld>();
var settings=new UnityEditor.SerializedObject(world);
settings.FindProperty("appearanceCatalog").objectReferenceValue=catalog;
settings.FindProperty("previewVisualId").stringValue="knight";
settings.ApplyModifiedProperties();
UnityEditor.SceneManagement.EditorSceneManager.MarkSceneDirty(UnityEngine.SceneManagement.SceneManager.GetActiveScene());
UnityEditor.SceneManagement.EditorSceneManager.SaveScene(UnityEngine.SceneManagement.SceneManager.GetActiveScene());
UnityEditor.AssetDatabase.SaveAssets();
return "Saved knight, scout and spellweaver appearance catalog. Saved-player loading remains separate.";
