"""Verify trial presentation against the live editor. Explicit fixtures; no login or lab writes."""
import datetime
import json
import pathlib
import subprocess
import sys

root=pathlib.Path(__file__).resolve().parent.parent
cli=str(pathlib.Path.home()/'.local/bin/unity')
events=[]
def run(*args):
 result=subprocess.run([cli,'command','--project-path',str(root),'--caller','plugin','--skill','unity-cli','--format','json',*args],capture_output=True,text=True,timeout=55)
 if result.returncode: raise RuntimeError(result.stdout+result.stderr)
 payload=json.loads(result.stdout)['data']['result'];events.append({'command':args[:2],'result':payload})
 print(args[:2],json.dumps(payload)[:700],flush=True)
 if isinstance(payload,dict) and payload.get('success') is False: raise RuntimeError(str(payload))
 return payload

def evaluate(code):return run('script','eval',code)['result']
def frames():assert run('job','wait','--','--condition','{"member":"UnityEngine.Time.frameCount","op":"changed"}','--timeout','10')['met']
def csharp_json(value):return json.dumps(json.dumps(value,separators=(',',':')))
def apply(reply,extra='return c.DisplayedRevision;'):
 return evaluate('var c=UnityEngine.Object.FindFirstObjectByType<Imperial.Butcher.ButcherCombatController>();c.ApplyTrialPresentation('+csharp_json(reply)+');'+extra)

hero={'id':'hero','name':'Skill Fixture','armorClass':11,'hitPoints':7,'maxHitPoints':7,'movementRemainingFeet':30,'actionUsed':False,'position':{'x':2,'y':2},'weapon':{'id':'practice_staff','rangeFeet':5},'abilityIds':['spark_burst','guarding_vow'],'mana':3,'maxMana':3,'wardArmorBonus':0}
sentinel={'id':'sentinel','name':'Camp Sentinel','armorClass':11,'hitPoints':10,'maxHitPoints':10,'movementRemainingFeet':20,'actionUsed':False,'position':{'x':5,'y':2}}
state={'id':'fixture-skills','revision':0,'phase':'active','outcome':None,'map':{'width':8,'height':8,'tileSizeFeet':5,'blockedCells':['4,4','4,5']},'combatants':[hero,sentinel]}
reply={'encounter':{'id':'fixture-skills','characterId':'fixture-hero','state':state},'events':[]}
assert run('editor','status')['playMode']=='stopped','Do not interrupt a user Play session'
assert not run('console','status')['groundTruth']['compilationFailed']
started=False
try:
 run('editor','set_auto_tick');run('editor.playmode','set_run_in_background');run('editor.playmode','start');started=True
 ready=subprocess.run([cli,'status','--until-ready','--project-path',str(root),'--format','json','--timeout','45'],capture_output=True,text=True,timeout=50)
 if ready.returncode:raise RuntimeError(ready.stdout)
 frames()
 evaluate('var c=UnityEngine.Object.FindFirstObjectByType<Imperial.Butcher.ButcherCombatController>();if(UnityEngine.Object.FindFirstObjectByType<Imperial.Butcher.ButcherCharacterMenu>().IsSignedIn)throw new System.Exception("Unexpected real session");c.GetType().GetField("heroId",System.Reflection.BindingFlags.NonPublic|System.Reflection.BindingFlags.Instance).SetValue(c,"fixture-hero");return "Skill presentation fixture only";')
 assert apply(reply,'return c.DisplayedMana;')==3
 state['revision']=1;hero.update(mana=2,wardArmorBonus=2,armorClass=13,actionUsed=True)
 reply['events']=[{'kind':'skill','detail':{'skillId':'guarding_vow','manaSpent':1,'wardArmorBonus':2}}]
 assert apply(reply,'return c.WardVisible;')
 frames()
 assert evaluate('return UnityEngine.GameObject.Find("Guarding Vow aura").GetComponentsInChildren<UnityEngine.Collider>().Length;')==0
 assert apply(reply,'var first=System.Linq.Enumerable.First((System.Collections.Generic.Queue<string>)c.GetType().GetField("recent",System.Reflection.BindingFlags.NonPublic|System.Reflection.BindingFlags.Instance).GetValue(c));if(!first.StartsWith("Guarding Vow:"))throw new System.Exception("Ward reported as attack");var q=(System.Collections.ICollection)c.GetType().GetField("recent",System.Reflection.BindingFlags.NonPublic|System.Reflection.BindingFlags.Instance).GetValue(c);return q.Count;')==1
 evaluate('var c=UnityEngine.Object.FindFirstObjectByType<Imperial.Butcher.ButcherCombatController>();c.GetType().GetField("notice",System.Reflection.BindingFlags.NonPublic|System.Reflection.BindingFlags.Instance).SetValue(c,"Skill fixture · no server mutations");return "Fixture labelled";')
 run('capture','game_view','--','--source','screen','--save_path','Screenshots/Skills-Ward.png')
 state['revision']=3;hero.update(wardArmorBonus=0,armorClass=11,actionUsed=False)
 reply['events']=[{'kind':'hostile_turn','detail':{'attack':{'hit':False,'damage':0}}}]
 assert not apply(reply,'return c.WardVisible;')
 assert evaluate('return UnityEngine.Object.FindFirstObjectByType<Imperial.Butcher.ButcherCombatController>().DisplayedMana;')==2
 state['revision']=4;hero.update(mana=1,actionUsed=True);sentinel['hitPoints']=2
 reply['events']=[{'kind':'skill','detail':{'skillId':'spark_burst','manaSpent':1,'attack':{'hit':True,'damage':8}}}]
 assert apply(reply,'return UnityEngine.GameObject.Find("Spark Burst visual")!=null && c.DisplayedMana==1;')
 frames()
 evaluate('var c=UnityEngine.Object.FindFirstObjectByType<Imperial.Butcher.ButcherCombatController>();c.GetType().GetField("notice",System.Reflection.BindingFlags.NonPublic|System.Reflection.BindingFlags.Instance).SetValue(c,"Spark fixture · no server mutations");return "Fixture labelled";')
 run('capture','game_view','--','--source','screen','--save_path','Screenshots/Skills-Spark.png')
 invalid=json.loads(json.dumps(reply));invalid['encounter']['state']['revision']=5;invalid['encounter']['state']['combatants'][0]['mana']=99
 assert evaluate('var c=UnityEngine.Object.FindFirstObjectByType<Imperial.Butcher.ButcherCombatController>();try{c.ApplyTrialPresentation('+csharp_json(invalid)+');return false;}catch(System.FormatException){return c.DisplayedMana==1;}')
 assert apply({'encounter':None,'events':[]},'return !c.InTrial;')
 frames()
 assert evaluate('return UnityEngine.GameObject.Find("Guarding Vow aura")==null && UnityEngine.GameObject.Find("Spark Burst visual")==null;')
 truth=run('console','status')['groundTruth'];assert not truth['compilationFailed'] and truth['consoleErrors']==0
 print('PASS: skill JSON/resources, ward aura/no physics, expiry, duplicate suppression, spark visual, invalid resource rejection and cleanup.',flush=True)
finally:
 if started:run('editor.playmode','stop');run('editor.playmode','set_run_in_background','--','--enable','false')
 report=json.dumps({'passed':sys.exc_info()[0] is None,'authenticated':False,'labWrites':False,'events':events},indent=2)
 stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
 (root/'Verification'/('Skills-'+stamp+'.json')).write_text(report);(root/'Verification/Skills-latest.json').write_text(report)
