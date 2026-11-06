if(UnityEditor.EditorApplication.isPlaying) throw new System.Exception("Stop Play before preparing combat animation");
string path="Assets/Butcher/Art/Animation/Attack.anim";
var clip=UnityEditor.AssetDatabase.LoadAssetAtPath<UnityEngine.AnimationClip>(path);
if(clip==null)
{
 var originals=UnityEditor.AssetDatabase.LoadAllAssetsAtPath("Assets/Kevin Iglesias/Human Animations/Animations/Male/Combat/1H/HumanM@Attack1H01_R.fbx");
 UnityEngine.AnimationClip original=null;
 foreach(var obj in originals)if(obj is UnityEngine.AnimationClip c && !c.name.StartsWith("__preview__"))original=c;
 if(original==null)throw new System.Exception("Owned attack animation path must be resolved");
 clip=UnityEngine.Object.Instantiate(original);clip.name="Attack";
 var settings=UnityEditor.AnimationUtility.GetAnimationClipSettings(clip);settings.loopTime=false;UnityEditor.AnimationUtility.SetAnimationClipSettings(clip,settings);
 UnityEditor.AssetDatabase.CreateAsset(clip,path);
}
var controller=UnityEditor.AssetDatabase.LoadAssetAtPath<UnityEditor.Animations.AnimatorController>("Assets/Butcher/Art/Animation/HeroLocomotion.controller");
if(controller==null)throw new System.Exception("PrepareHero must run first");
var machine=controller.layers[0].stateMachine;
UnityEditor.Animations.AnimatorState attack=null;
foreach(var child in machine.states)if(child.state.name=="Attack")attack=child.state;
if(attack==null)
{
 attack=machine.AddState("Attack");
 var transition=attack.AddTransition(machine.defaultState);transition.hasExitTime=true;transition.exitTime=.9f;transition.hasFixedDuration=true;transition.duration=.12f;
}
attack.motion=clip;attack.speed=1.3f;
UnityEditor.AssetDatabase.SaveAssets();
return "Prepared one-shot attack returning to locomotion";
