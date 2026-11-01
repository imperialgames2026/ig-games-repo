"""Local visual/requirements integration checks. No sign-in, grants or inventory writes."""
import datetime
import json
import pathlib
import subprocess
import sys

root = pathlib.Path(__file__).resolve().parent.parent
cli = str(pathlib.Path.home()/'.local/bin/unity')
events=[]
def run(*args):
    result=subprocess.run([cli,'command','--project-path',str(root),'--caller','plugin','--skill','unity-cli','--format','json',*args],capture_output=True,text=True,timeout=55)
    if result.returncode: raise RuntimeError(result.stdout+result.stderr)
    payload=json.loads(result.stdout)['data']['result']
    events.append({'command':args[:2],'result':payload})
    print(args[:2],json.dumps(payload)[:900],flush=True)
    if isinstance(payload,dict) and payload.get('success') is False: raise RuntimeError(str(payload))
    return payload

def evaluate(code): return run('script','eval',code)['result']
def frames(): assert run('job','wait','--','--condition','{"member":"UnityEngine.Time.frameCount","op":"changed"}','--timeout','10')['met']
def snapshot(weapon='practice_sword',version=1):
    return 'new Imperial.Butcher.ButcherWorld.EquippedVisualSelection[]{new Imperial.Butcher.ButcherWorld.EquippedVisualSelection{definitionId="'+weapon+'",definitionVersion='+str(version)+',slot="main_hand"},new Imperial.Butcher.ButcherWorld.EquippedVisualSelection{definitionId="travel_coat",definitionVersion=1,slot="body"}}'

assert run('editor','status')['playMode']=='stopped','Do not interrupt a user Play session'
assert not run('console','status')['groundTruth']['compilationFailed']
started=False
try:
    run('editor','set_auto_tick');run('editor.playmode','set_run_in_background');run('editor.playmode','start');started=True
    ready=subprocess.run([cli,'status','--until-ready','--project-path',str(root),'--format','json','--timeout','45'],capture_output=True,text=True,timeout=50)
    if ready.returncode: raise RuntimeError(ready.stdout)
    frames()
    assert evaluate('return UnityEngine.Resources.Load<Imperial.Butcher.ButcherEquipmentCatalog>("EquipmentVisualCatalog")!=null;')
    assert evaluate('return UnityEngine.Object.FindFirstObjectByType<Imperial.Butcher.ButcherWorld>().ApplyEquipmentVisuals('+snapshot()+');')==2
    for appearance in ['knight','scout','spellweaver']:
        assert evaluate('return UnityEngine.Object.FindFirstObjectByType<Imperial.Butcher.ButcherWorld>().ApplyHeroAppearance("'+appearance+'");')
        frames()
        assert evaluate('var markers=UnityEngine.Object.FindObjectsByType<Imperial.Butcher.ButcherEquippedVisual>(UnityEngine.FindObjectsSortMode.None); if(markers.Length!=2) throw new System.Exception("Expected two attachments"); foreach(var marker in markers){var animator=marker.GetComponentInParent<UnityEngine.Animator>(); var bone=animator.GetBoneTransform(marker.Slot=="body"?UnityEngine.HumanBodyBones.Chest:UnityEngine.HumanBodyBones.RightHand); if(marker.transform.parent!=bone) throw new System.Exception("Wrong attachment bone"); if(marker.GetComponentsInChildren<UnityEngine.Collider>().Length!=0) throw new System.Exception("Visual item has physics collider");} return true;')
        evaluate('var w=UnityEngine.Object.FindFirstObjectByType<Imperial.Butcher.ButcherWorld>();w.enabled=false;var hero=UnityEngine.Object.FindFirstObjectByType<UnityEngine.CharacterController>();var camera=UnityEngine.Camera.main;camera.transform.position=hero.transform.position+new UnityEngine.Vector3(2,1.8f,-3);camera.transform.LookAt(hero.transform.position+UnityEngine.Vector3.up);return "Close visual inspection";')
        run('capture','game_view','--','--source','camera','--save_path','Screenshots/Equipment-'+appearance+'.png')
    assert evaluate('return UnityEngine.Object.FindFirstObjectByType<Imperial.Butcher.ButcherWorld>().ApplyEquipmentVisuals('+snapshot('practice_staff')+');')==2
    frames()
    run('capture','game_view','--','--source','camera','--save_path','Screenshots/Equipment-staff.png')
    assert evaluate('return UnityEngine.Object.FindFirstObjectByType<Imperial.Butcher.ButcherWorld>().ApplyEquipmentVisuals('+snapshot('untrusted/path')+');')==1
    assert evaluate('return UnityEngine.Object.FindFirstObjectByType<Imperial.Butcher.ButcherWorld>().ApplyEquipmentVisuals('+snapshot('practice_sword',999)+');')==1
    assert evaluate('return UnityEngine.Object.FindFirstObjectByType<Imperial.Butcher.ButcherWorld>().ApplyEquipmentVisuals(null);')==0
    frames()
    assert evaluate('return UnityEngine.Object.FindObjectsByType<Imperial.Butcher.ButcherEquippedVisual>(UnityEngine.FindObjectsSortMode.None).Length;')==0
    evaluate('var w=UnityEngine.Object.FindFirstObjectByType<Imperial.Butcher.ButcherWorld>();w.SetEquippedSkillNames(new[]{"Spark Rune","Oath Ward"});if(w.EquippedSkillCount!=2) throw new System.Exception("Skill labels missing");w.SetEquippedSkillNames(null);w.enabled=true;return "Skill labels restore/clear verified";')
    # Exercise JsonUtility response parsing and advisory requirements with test data only.
    setup='var m=UnityEngine.Object.FindFirstObjectByType<Imperial.Butcher.ButcherCharacterMenu>();var t=m.GetType();var f=System.Reflection.BindingFlags.NonPublic|System.Reflection.BindingFlags.Instance;'
    def field(name,data):
        return 't.GetField("'+name+'",f).SetValue(m,UnityEngine.JsonUtility.FromJson('+json.dumps(json.dumps(data,separators=(',',':')))+',t.GetField("'+name+'",f).FieldType));'
    inv={'characterId':'fixture-hero','loadoutRevision':1,'starterClaimed':True,'symbols':['ARCANE'],'items':[]}
    build={'level':1,'proficientSkills':[],'skillRanksEntries':[]}
    item={'id':'fixture-spark','definitionId':'spark_rune','definitionVersion':1,'name':'Spark Rune','kind':'skill','state':'available','minimumLevel':1,'requiredSymbols':['ARCANE'],'allowedSlots':['skill_1'],'skillRequirements':[{'skill':'arcana','rank':1}],'grantedAbilityNames':['Spark Burst'],'description':'Unlocks Spark Burst. Requires Arcane and trained Arcana.'}
    reason='var item=UnityEngine.JsonUtility.FromJson('+json.dumps(json.dumps(item,separators=(',',':')))+',t.GetNestedType("InventoryItem",System.Reflection.BindingFlags.NonPublic));return t.GetMethod("EquipUnavailableReason",f).Invoke(m,new object[]{item,"skill_1"});'
    assert 'arcana rank 1' in evaluate(setup+field('inventory',inv)+field('selectedBuild',build)+reason)
    build['proficientSkills']=['arcana']
    assert evaluate(setup+field('selectedBuild',build)+reason) is None
    inv['symbols']=['FIELD']
    assert evaluate(setup+field('inventory',inv)+reason)=='Missing ARCANE symbol'
    inv['symbols']=['ARCANE'];inv['items']=[item]
    evaluate(setup+field('inventory',inv)+'t.GetField("session",f).SetValue(m,"ui-fixture-not-a-token");t.GetField("showEquipment",f).SetValue(m,true);t.GetField("equipmentSlot",f).SetValue(m,2);t.GetField("message",f).SetValue(m,"Equipment details preview · test data");t.GetField("<IsOpen>k__BackingField",f).SetValue(m,true);t.GetField("<SelectedCharacterId>k__BackingField",f).SetValue(m,"fixture-hero");return "Explicit UI fixture; no session or writes";')
    run('capture','game_view','--','--source','screen','--save_path','Screenshots/Skill-Details.png')
    evaluate(setup+'t.GetField("session",f).SetValue(m,"");t.GetField("inventory",f).SetValue(m,null);t.GetField("selectedBuild",f).SetValue(m,null);t.GetField("showEquipment",f).SetValue(m,false);t.GetField("<IsOpen>k__BackingField",f).SetValue(m,false);return "Fixture cleared";')
    console=run('console','status')['groundTruth']
    assert not console['compilationFailed'] and console['consoleErrors']==0
    print('PASS: equipment bones, appearance rebinds, replace/clear, untrusted definitions/versions and requirement hints.',flush=True)
finally:
    if started:
        run('editor.playmode','stop');run('editor.playmode','set_run_in_background','--','--enable','false')
    payload=json.dumps({'passed':sys.exc_info()[0] is None,'events':events},indent=2)
    stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    (root/'Verification').mkdir(exist_ok=True)
    (root/'Verification'/('Equipment-'+stamp+'.json')).write_text(payload)
    (root/'Verification/Equipment-latest.json').write_text(payload)
