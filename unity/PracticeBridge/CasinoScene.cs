using System;
using System.Collections;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using UnityEngine;

// Procedural practice presentation. No RNG, network, wager or wallet code lives here.
public sealed class CasinoScene : MonoBehaviour {
 static readonly int[] Pockets={0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26};
 static readonly HashSet<int> Reds=new HashSet<int>{1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36};
 readonly Dictionary<string,Material> mats=new Dictionary<string,Material>();
 Transform roulette,craps,wheel,ball; readonly Transform[] dice=new Transform[2];
 Camera view; Font font; string game="roulette", activeRound=""; bool reduced,paused; Coroutine motion;float lastAspect;string cameraMode="table";
 [DllImport("__Internal")] static extern void ImperialPracticeEvent(string json);
 void Notify(string type,string id="") {
#if UNITY_WEBGL && !UNITY_EDITOR
  ImperialPracticeEvent("{\"type\":\""+type+"\",\"roundId\":\""+id+"\",\"version\":1}");
#endif
 }
 void Start(){
  Application.targetFrameRate=30; QualitySettings.vSyncCount=0; QualitySettings.antiAliasing=2;
  font=GetComponent<PracticeFont>().font;
  view=new GameObject("TableCamera").AddComponent<Camera>();view.clearFlags=CameraClearFlags.SolidColor;view.backgroundColor=new Color(.025f,.04f,.06f);view.fieldOfView=42;
  view.nearClipPlane=.1f; view.farClipPlane=60;
  RenderSettings.ambientMode=UnityEngine.Rendering.AmbientMode.Flat;RenderSettings.ambientLight=new Color(.3f,.33f,.35f);
  var key=new GameObject("Warm softbox").AddComponent<Light>();key.type=LightType.Directional;key.color=new Color(1,.88f,.7f);key.intensity=1.3f;key.transform.rotation=Quaternion.Euler(48,-35,0);
  var fill=new GameObject("Cool fill").AddComponent<Light>();fill.type=LightType.Directional;fill.color=new Color(.65f,.8f,1);fill.intensity=.55f;fill.transform.rotation=Quaternion.Euler(35,130,0);
  BuildRoulette();BuildCraps();SetGame("roulette");Notify("ready");
 }
 Material Mat(string color,float metallic=0,float smooth=.35f){
  string k=color+metallic+smooth;if(mats.ContainsKey(k))return mats[k];
  var m=new Material(GetComponent<PracticeFont>().standardMaterial);ColorUtility.TryParseHtmlString(color,out Color c);m.color=c;m.SetFloat("_Metallic",metallic);m.SetFloat("_Glossiness",smooth);mats[k]=m;return m;
 }
 Transform Group(string name,Transform parent=null){var o=new GameObject(name).transform;o.SetParent(parent,false);return o;}
 Transform Shape(string name,PrimitiveType type,Transform parent,Vector3 pos,Vector3 scale,Material mat){
  var o=new GameObject(name);var resources=GetComponent<PracticeFont>();var filter=o.AddComponent<MeshFilter>();filter.sharedMesh=type==PrimitiveType.Cube?resources.cube:type==PrimitiveType.Sphere?resources.sphere:type==PrimitiveType.Cylinder?resources.cylinder:resources.capsule;o.AddComponent<MeshRenderer>();o.transform.SetParent(parent,false);o.transform.localPosition=pos;o.transform.localScale=scale;o.GetComponent<Renderer>().sharedMaterial=mat;return o.transform;
 }
 void Box(string name,Transform p,Vector3 pos,Vector3 size,string color){Shape(name,PrimitiveType.Cube,p,pos,size,Mat(color));}
 void Label(string text,Transform p,Vector3 pos,float size,Color color,float rotation=0){
  var t=new GameObject("Mark "+text).AddComponent<TextMesh>();t.transform.SetParent(p,false);t.transform.localPosition=pos;t.transform.localRotation=Quaternion.Euler(90,rotation,0);t.text=text;t.font=font;t.fontSize=64;t.characterSize=size*.28f;t.anchor=TextAnchor.MiddleCenter;t.alignment=TextAlignment.Center;t.color=color;
  if(font)t.GetComponent<Renderer>().sharedMaterial=font.material;
 }
 // Annular mesh, measured clockwise from the far side (+Z). Used for rails and pockets.
 Transform Ring(string name,Transform p,float inside,float outside,float y,float start,float sweep,Material material,int segments=64){
  var vertices=new List<Vector3>();var triangles=new List<int>();
  for(int i=0;i<=segments;i++){float a=(start+sweep*i/segments)*Mathf.Deg2Rad;vertices.Add(new Vector3(Mathf.Sin(a)*inside,y,Mathf.Cos(a)*inside));vertices.Add(new Vector3(Mathf.Sin(a)*outside,y,Mathf.Cos(a)*outside));if(i<segments){int j=i*2;triangles.AddRange(new[]{j,j+1,j+2,j+1,j+3,j+2});}}
  var mesh=new Mesh();mesh.SetVertices(vertices);mesh.SetTriangles(triangles,0);mesh.RecalculateNormals();
  var obj=Group(name,p);obj.gameObject.AddComponent<MeshFilter>().sharedMesh=mesh;obj.gameObject.AddComponent<MeshRenderer>().sharedMaterial=material;return obj;
 }
 void Chip(Transform p,Vector3 pos,string color,int height=1){for(int i=0;i<height;i++){Shape("Chip",PrimitiveType.Cylinder,p,pos+Vector3.up*i*.035f,new Vector3(.25f,.018f,.25f),Mat(color));Ring("Chip rim",p,.093f,.12f,pos.y+i*.035f+.02f,0,360,Mat("#ece5cb"),24).localPosition=new Vector3(pos.x,0,pos.z);}}
 void Table(Transform p,float length,float width){
  Box("Walnut base",p,new Vector3(0,-.4f,0),new Vector3(length,.65f,width),"#362016");
  Box("Felt bed",p,new Vector3(0,-.055f,0),new Vector3(length-.3f,.12f,width-.3f),"#07583e");
  foreach(float z in new[]{-width/2,width/2}){
   Shape("Padded leather rail",PrimitiveType.Capsule,p,new Vector3(0,.07f,z),new Vector3(.3f,length/2,.3f),Mat("#191c1b",0,.5f)).localRotation=Quaternion.Euler(0,0,90);
   Box("Brass inlay",p,new Vector3(0,-.08f,z*.94f),new Vector3(length-.2f,.035f,.035f),"#b59a5c");
  }
  foreach(float x in new[]{-length/2,length/2})Shape("End rail",PrimitiveType.Capsule,p,new Vector3(x,.07f,0),new Vector3(.3f,width/2,.3f),Mat("#191c1b",0,.5f)).localRotation=Quaternion.Euler(90,0,0);
 }
 void BuildRoulette(){
  roulette=Group("Single zero roulette");Table(roulette,10,5.3f);
  var assembly=Group("Wheel assembly",roulette);assembly.localPosition=new Vector3(-2.5f,.05f,0);
  Shape("Polished walnut bowl",PrimitiveType.Cylinder,assembly,Vector3.zero,new Vector3(4.2f,.17f,4.2f),Mat("#613b20",0,.7f));
  Ring("Outer brass lip",assembly,1.96f,2.1f,.18f,0,360,Mat("#c8a65e",.7f,.7f));
  Ring("Ball track",assembly,1.72f,1.96f,.19f,0,360,Mat("#382416",0,.75f));
  wheel=Group("Outcome wheel",assembly);
  for(int i=0;i<37;i++){
   float a=i*360f/37;int n=Pockets[i];
   Ring("Pocket "+n,wheel,1.15f,1.72f,.205f,a,360f/37,Mat(n==0?"#008b52":Reds.Contains(n)?"#a32630":"#111820"),3);
   Ring("Separator",wheel,1.15f,1.72f,.213f,a,.45f,Mat("#c8a65e",.7f),1);
   float angle=(a+180f/37)*Mathf.Deg2Rad;
   Label(n.ToString(),wheel,new Vector3(Mathf.Sin(angle)*1.54f,.224f,Mathf.Cos(angle)*1.54f),.052f,Color.white,-a-180f/37);
  }
  Shape("Sloped wooden cone",PrimitiveType.Cylinder,wheel,new Vector3(0,.27f,0),new Vector3(2.2f,.12f,2.2f),Mat("#754c2b",0,.7f));
  Ring("Inner brass rim",wheel,1.05f,1.13f,.4f,0,360,Mat("#d5b569",.7f));
  Shape("Spindle",PrimitiveType.Cylinder,wheel,new Vector3(0,.55f,0),new Vector3(.22f,.28f,.22f),Mat("#c9a85f",.75f,.8f));
  Box("Spindle arms",wheel,new Vector3(0,.72f,0),new Vector3(1.05f,.07f,.07f),"#c9a85f");
  Box("Spindle cross",wheel,new Vector3(0,.72f,0),new Vector3(.07f,.07f,1.05f),"#c9a85f");
  ball=Shape("Ivory ball",PrimitiveType.Sphere,assembly,new Vector3(0,.28f,1.8f),Vector3.one*.12f,Mat("#fff7df",0,.85f));
  Cloth(roulette,GetComponent<PracticeFont>().rouletteCloth,new Vector3(2.1f,.02f,0),4.7f,3.4f);
  Chip(roulette,new Vector3(3.4f,.03f,1.9f),"#be233b",6);Chip(roulette,new Vector3(3,.03f,1.9f),"#284aa0",4);Chip(roulette,new Vector3(2.6f,.03f,1.9f),"#d9bd7c",8);
 }
 void BuildCraps(){
  craps=Group("Craps table");Table(craps,10,4.6f);
  Cloth(craps,GetComponent<PracticeFont>().crapsCloth,new Vector3(0,.02f,0),9.6f,4.25f);
  Chip(craps,new Vector3(-3.8f,.04f,1.8f),"#ae2732",5);Chip(craps,new Vector3(3.8f,.04f,1.8f),"#ae2732",5);
  // Top, bottom, right, left, front and back: opposite faces sum to seven.
  int[] values={1,6,2,5,3,4};Vector3[] normals={Vector3.up,Vector3.down,Vector3.right,Vector3.left,Vector3.forward,Vector3.back};
  for(int d=0;d<2;d++){
   dice[d]=Group("Die "+(d+1),craps);RoundedDie(dice[d]);
   for(int f=0;f<6;f++){
    var normal=normals[f];var tangent=Mathf.Abs(normal.x)>.5f?Vector3.forward:Vector3.right;var bitangent=Vector3.Cross(normal,tangent);
    foreach(var uv in PipPattern(values[f]))Shape("Inset pip",PrimitiveType.Sphere,dice[d],normal*.259f+tangent*uv.x*.14f+bitangent*uv.y*.14f,Vector3.one*.064f,Mat("#172026"));
   }
   dice[d].localPosition=new Vector3(d==0?-.6f:.6f,.3f,0);
  }
 }
 void Cloth(Transform parent,Texture2D texture,Vector3 position,float width,float depth){
  var obj=Group("Woven betting cloth",parent);obj.localPosition=position;
  var mesh=new Mesh();mesh.vertices=new[]{new Vector3(-width/2,0,-depth/2),new Vector3(width/2,0,-depth/2),new Vector3(-width/2,0,depth/2),new Vector3(width/2,0,depth/2)};
  mesh.uv=new[]{new Vector2(0,0),new Vector2(1,0),new Vector2(0,1),new Vector2(1,1)};mesh.triangles=new[]{0,2,1,1,2,3};mesh.RecalculateNormals();
  obj.gameObject.AddComponent<MeshFilter>().sharedMesh=mesh;var material=new Material(GetComponent<PracticeFont>().standardMaterial);material.color=Color.white;material.mainTexture=texture;material.SetFloat("_Glossiness",.05f);obj.gameObject.AddComponent<MeshRenderer>().sharedMaterial=material;
 }
 void RoundedDie(Transform parent){
  var vertices=new List<Vector3>();var triangles=new List<int>();
  Vector3[] normals={Vector3.up,Vector3.down,Vector3.right,Vector3.left,Vector3.forward,Vector3.back};
  foreach(var n in normals){var u=Mathf.Abs(n.x)>.5f?Vector3.forward:Vector3.right;var v=Vector3.Cross(n,u);int first=vertices.Count;
   for(int y=0;y<=6;y++)for(int x=0;x<=6;x++){
    var p=n*.26f+u*((x/6f-.5f)*.52f)+v*((y/6f-.5f)*.52f);var core=new Vector3(Mathf.Clamp(p.x,-.22f,.22f),Mathf.Clamp(p.y,-.22f,.22f),Mathf.Clamp(p.z,-.22f,.22f));vertices.Add(core+(p-core).normalized*.04f);
    if(x<6&&y<6){int a=first+y*7+x;triangles.AddRange(new[]{a,a+1,a+7,a+1,a+8,a+7});}
   }
  }
  var mesh=new Mesh();mesh.SetVertices(vertices);mesh.SetTriangles(triangles,0);mesh.RecalculateNormals();var obj=Group("Rounded ivory die",parent);obj.gameObject.AddComponent<MeshFilter>().sharedMesh=mesh;obj.gameObject.AddComponent<MeshRenderer>().sharedMaterial=Mat("#f0e8da",0,.65f);
 }
 IEnumerable<Vector2> PipPattern(int n){
  if(n%2==1)yield return Vector2.zero;
  if(n>=2){yield return new Vector2(-1,-1);yield return new Vector2(1,1);}
  if(n>=4){yield return new Vector2(-1,1);yield return new Vector2(1,-1);}
  if(n==6){yield return new Vector2(-1,0);yield return new Vector2(1,0);}
 }
 public void SetGame(string value){if(value!="roulette"&&value!="craps")return;game=value;roulette.gameObject.SetActive(value=="roulette");craps.gameObject.SetActive(value=="craps");CameraView(cameraMode);}
 public void CameraView(string value){if(!view)return;cameraMode=value;float aspect=Mathf.Max(.5f,view.aspect);bool overhead=value=="overhead";float distance=Mathf.Max(10.7f/(2*Mathf.Tan(21*Mathf.Deg2Rad)*aspect),(overhead?6f:4.7f)/(2*Mathf.Tan(21*Mathf.Deg2Rad)))+2.6f;view.transform.position=new Vector3(0,1,overhead?-.001f:-.85f).normalized*distance;view.transform.LookAt(Vector3.zero);}
 public void SetReducedMotion(string value){reduced=value=="true";}
 public void Present(string json){var o=JsonUtility.FromJson<PracticeBridge.Outcome>(json);if(motion!=null)StopCoroutine(motion);activeRound=o.roundId;SetGame(o.game);motion=StartCoroutine(Animate(o));}
 Quaternion DieRotation(int face){switch(face){case 2:return Quaternion.Euler(0,0,90);case 3:return Quaternion.Euler(-90,0,0);case 4:return Quaternion.Euler(90,0,0);case 5:return Quaternion.Euler(0,0,-90);case 6:return Quaternion.Euler(180,0,0);default:return Quaternion.identity;}}
 IEnumerator Animate(PracticeBridge.Outcome o){
  float elapsed=0,duration=reduced?.01f:2.6f;float from=wheel.localEulerAngles.y;
  int pocket=o.game=="roulette"?Array.IndexOf(Pockets,o.values[0]):0;
  float target=-(pocket+.5f)*360f/37;float delta=Mathf.DeltaAngle(from,target)+1800;
  while(elapsed<duration){if(paused){yield return null;continue;}float t=Mathf.Clamp01(elapsed/duration),e=1-Mathf.Pow(1-t,3);
   if(o.game=="roulette"){
    wheel.localRotation=Quaternion.Euler(0,from+delta*e,0);float a=((1-e)*2520)*Mathf.Deg2Rad;float radius=Mathf.Lerp(1.82f,1.32f,Mathf.SmoothStep(0,1,Mathf.Clamp01((t-.65f)/.35f)));ball.localPosition=new Vector3(Mathf.Sin(a)*radius,.29f+Mathf.Sin(t*Mathf.PI)*.045f,Mathf.Cos(a)*radius);
   }else for(int i=0;i<2;i++){
    dice[i].localPosition=new Vector3(Mathf.Lerp(-3.6f,i==0?-.65f:.65f,e),.3f+Mathf.Abs(Mathf.Sin(t*Mathf.PI*5))*(1-t)*1.4f,Mathf.Lerp(-1.1f,.05f+i*.4f,e));
    dice[i].localRotation=DieRotation(o.values[i])*Quaternion.Euler((1-e)*1080,(1-e)*720,(1-e)*360);
   }
   elapsed+=Time.unscaledDeltaTime;yield return null;
  }
  if(o.game=="roulette"){wheel.localRotation=Quaternion.Euler(0,target,0);ball.localPosition=new Vector3(0,.29f,1.32f);}else for(int i=0;i<2;i++){dice[i].localRotation=DieRotation(o.values[i]);dice[i].localPosition=new Vector3(i==0?-.65f:.65f,.3f,.05f+i*.4f);}
  Notify("complete",o.roundId);motion=null;
 }
 void Update(){if(view&&Mathf.Abs(view.aspect-lastAspect)>.01f){lastAspect=view.aspect;CameraView(cameraMode);}}
 public void SetPaused(string value){paused=value=="true";Time.timeScale=paused?0:1;Application.targetFrameRate=value=="true"?5:30;}
}
