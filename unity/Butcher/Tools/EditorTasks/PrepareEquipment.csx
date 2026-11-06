if(UnityEditor.EditorApplication.isPlaying) throw new System.Exception("Stop Play before preparing equipment");
string folder="Assets/Butcher/Art/Equipment";
System.IO.Directory.CreateDirectory(folder);
UnityEditor.AssetDatabase.Refresh();
string vendor="Assets/PolysplitGames/LowPolyMedievalFantasyHeroes/BasicWeapons/prefabs/";
var prefabs=new UnityEngine.GameObject[3];
string[] names={"TrainingSword","TrainingStaff","TravelCloak"};
for(int index=0;index<3;index++)
{
    var root=new UnityEngine.GameObject(names[index]);
    try
    {
        if(index<2)
        {
            var source=UnityEditor.AssetDatabase.LoadAssetAtPath<UnityEngine.GameObject>(vendor+(index==0?"SwordBasic_A.prefab":"StaffBasic_A.prefab"));
            if(source==null) throw new System.Exception("Missing owned weapon source");
            var mesh=(UnityEngine.GameObject)UnityEditor.PrefabUtility.InstantiatePrefab(source);
            mesh.transform.SetParent(root.transform,false);
            foreach(var renderer in mesh.GetComponentsInChildren<UnityEngine.Renderer>(true))
                if(renderer.name.Contains("Scabbard")) renderer.gameObject.SetActive(false);
            // Native weapon models point along Z and have their grip at the origin.
            mesh.transform.localScale=UnityEngine.Vector3.one*(index==0?.70f:.86f);
            foreach(var collider in mesh.GetComponentsInChildren<UnityEngine.Collider>(true)) UnityEngine.Object.DestroyImmediate(collider);
        }
        else
        {
            // Original simple travel cloak: a double-sided folded silhouette, no cloth simulation.
            string meshPath=folder+"/TravelCloak.asset";
            var mesh=UnityEditor.AssetDatabase.LoadAssetAtPath<UnityEngine.Mesh>(meshPath);
            if(mesh==null)
            {
                mesh=new UnityEngine.Mesh {name="Butcher travel cloak"};
                mesh.vertices=new[]{new UnityEngine.Vector3(-.24f,.18f,-.14f),new UnityEngine.Vector3(0,.23f,-.20f),new UnityEngine.Vector3(.24f,.18f,-.14f),new UnityEngine.Vector3(-.32f,-.70f,-.27f),new UnityEngine.Vector3(0,-.77f,-.36f),new UnityEngine.Vector3(.32f,-.70f,-.27f)};
                mesh.triangles=new[]{0,3,1,1,3,4,1,4,2,2,4,5,1,3,0,4,3,1,2,4,1,5,4,2};
                mesh.RecalculateNormals();mesh.RecalculateBounds();
                UnityEditor.AssetDatabase.CreateAsset(mesh,meshPath);
            }
            string materialPath=folder+"/TravelCloak.mat";
            var material=UnityEditor.AssetDatabase.LoadAssetAtPath<UnityEngine.Material>(materialPath);
            if(material==null)
            {
                material=new UnityEngine.Material(UnityEngine.Shader.Find("Universal Render Pipeline/Lit"));
                material.name="Imperial midnight cloak";material.color=new UnityEngine.Color(.11f,.12f,.24f);
                UnityEditor.AssetDatabase.CreateAsset(material,materialPath);
            }
            root.AddComponent<UnityEngine.MeshFilter>().sharedMesh=mesh;
            root.AddComponent<UnityEngine.MeshRenderer>().sharedMaterial=material;
        }
        prefabs[index]=UnityEditor.PrefabUtility.SaveAsPrefabAsset(root,folder+"/"+names[index]+".prefab");
    }
    finally {UnityEngine.Object.DestroyImmediate(root);}
}
string path="Assets/Butcher/Resources/EquipmentVisualCatalog.asset";
var catalog=UnityEditor.AssetDatabase.LoadAssetAtPath<Imperial.Butcher.ButcherEquipmentCatalog>(path);
if(catalog==null) {catalog=UnityEngine.ScriptableObject.CreateInstance<Imperial.Butcher.ButcherEquipmentCatalog>();UnityEditor.AssetDatabase.CreateAsset(catalog,path);}
var so=new UnityEditor.SerializedObject(catalog);
var entries=so.FindProperty("entries");entries.arraySize=3;
string[] ids={"practice_sword","practice_staff","travel_coat"};
for(int i=0;i<3;i++)
{
    var entry=entries.GetArrayElementAtIndex(i);
    entry.FindPropertyRelative("definitionId").stringValue=ids[i];
    entry.FindPropertyRelative("definitionVersion").intValue=1;
    entry.FindPropertyRelative("slot").stringValue=i<2?"main_hand":"body";
    entry.FindPropertyRelative("prefab").objectReferenceValue=prefabs[i];
    entry.FindPropertyRelative("bone").intValue=(int)(i<2?UnityEngine.HumanBodyBones.RightHand:UnityEngine.HumanBodyBones.Chest);
    entry.FindPropertyRelative("localPosition").vector3Value=UnityEngine.Vector3.zero;
    entry.FindPropertyRelative("localEuler").vector3Value=i==0?new UnityEngine.Vector3(180,0,0):UnityEngine.Vector3.zero;
}
so.ApplyModifiedProperties();UnityEditor.AssetDatabase.SaveAssets();
return "Saved sword, staff and original travel cloak; local visual catalog only.";
