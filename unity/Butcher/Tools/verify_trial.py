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

hero={'id':'hero','name':'Fixture Hero','armorClass':12,'hitPoints':11,'maxHitPoints':11,'movementRemainingFeet':30,'actionUsed':False,'position':{'x':2,'y':2},'weapon':{'id':'practice_sword','rangeFeet':5}}
sentinel={'id':'sentinel','name':'Camp Sentinel','armorClass':11,'hitPoints':10,'maxHitPoints':10,'movementRemainingFeet':20,'actionUsed':False,'position':{'x':5,'y':2},'weapon':{'id':'training_strike','rangeFeet':5}}
state={'id':'fixture-trial','revision':0,'phase':'active','outcome':None,'map':{'width':8,'height':8,'tileSizeFeet':5,'blockedCells':['4,4','4,5']},'combatants':[hero,sentinel]}
reply={'encounter':{'id':'fixture-trial','characterId':'fixture-hero','state':state},'events':[]}
assert run('editor','status')['playMode']=='stopped','Existing Play session belongs to the user'
assert not run('console','status')['groundTruth']['compilationFailed']
started=False
try:
 run('editor','set_auto_tick');run('editor.playmode','set_run_in_background');run('editor.playmode','start');started=True
 ready=subprocess.run([cli,'status','--until-ready','--project-path',str(root),'--format','json','--timeout','45'],capture_output=True,text=True,timeout=50)
 if ready.returncode:raise RuntimeError(ready.stdout)
 frames()
 evaluate('var c=UnityEngine.Object.FindFirstObjectByType<Imperial.Butcher.ButcherCombatController>();if(c==null)throw new System.Exception("Trial controller missing");if(UnityEngine.Object.FindFirstObjectByType<Imperial.Butcher.ButcherCharacterMenu>().IsSignedIn)throw new System.Exception("Unexpected real session");c.GetType().GetField("heroId",System.Reflection.BindingFlags.NonPublic|System.Reflection.BindingFlags.Instance).SetValue(c,"fixture-hero");return "Local presentation fixture only";')
 assert apply(reply)==0
 assert evaluate('return UnityEngine.Object.FindFirstObjectByType<Imperial.Butcher.ButcherCombatController>().InTrial;')
 assert evaluate('return UnityEngine.GameObject.Find("Camp Trial Arena").GetComponentsInChildren<UnityEngine.Renderer>().Length;')==69
 evaluate('UnityEngine.Object.FindFirstObjectByType<Imperial.Butcher.ButcherCombatController>().GetType().GetField("notice",System.Reflection.BindingFlags.NonPublic|System.Reflection.BindingFlags.Instance).SetValue(UnityEngine.Object.FindFirstObjectByType<Imperial.Butcher.ButcherCombatController>(),"Presentation fixture · no server mutations");return "Fixture labelled";')
 frames();run('capture','game_view','--','--source','screen','--save_path','Screenshots/Trial-Arena.png')
 state['revision']=1;hero['position']={'x':4,'y':2};hero['movementRemainingFeet']=20
 assert apply(reply)==1
 assert run('job','wait','--','--condition','{"findType":"Imperial.Butcher.ButcherCombatController","member":"HeroAtDestination","op":"equals","value":true}','--timeout','10')['met']
 assert evaluate('var p=UnityEngine.Object.FindFirstObjectByType<Imperial.Butcher.ButcherWorld>().HeroPosition;return UnityEngine.Vector3.Distance(p,new UnityEngine.Vector3(34.096f,.1f,-12.952f))<.08f;')
 state['revision']=2;hero['actionUsed']=True;sentinel['hitPoints']=5
 reply['events']=[{'kind':'attack','detail':{'attack':{'hit':True,'damage':5}}}]
 assert apply(reply,'var a=UnityEngine.Object.FindFirstObjectByType<UnityEngine.Animator>();a.Update(.15f);return a.GetCurrentAnimatorStateInfo(0).IsName("Attack") || a.GetNextAnimatorStateInfo(0).IsName("Attack");')
 assert apply(reply,'var queue=(System.Collections.ICollection)c.GetType().GetField("recent",System.Reflection.BindingFlags.NonPublic|System.Reflection.BindingFlags.Instance).GetValue(c);return queue.Count;')==1
 state['revision']=1;hero['hitPoints']=1
 assert apply(reply)==2
 state['revision']=3;hero['hitPoints']=11
 invalid=json.loads(json.dumps(reply));invalid['encounter']['state']['combatants'][0]['position']['x']=999
 assert evaluate('var c=UnityEngine.Object.FindFirstObjectByType<Imperial.Butcher.ButcherCombatController>();try{c.ApplyTrialPresentation('+csharp_json(invalid)+');return false;}catch(System.FormatException){return c.DisplayedRevision==2;}')
 state['phase']='completed';state['outcome']='heroes_win';sentinel['hitPoints']=0;reply['events']=[]
 assert apply(reply,'return c.TrialOutcome;')=='heroes_win'
 assert evaluate('return UnityEngine.GameObject.Find("Camp Sentinel")==null;')
 frames();run('capture','game_view','--','--source','screen','--save_path','Screenshots/Trial-Result.png')
 evaluate('UnityEngine.Object.FindFirstObjectByType<Imperial.Butcher.ButcherCombatController>().ClearPresentation();return "Returned to camp";')
 frames()
 assert not evaluate('return UnityEngine.Object.FindFirstObjectByType<Imperial.Butcher.ButcherCombatController>().InTrial;')
 assert evaluate('return UnityEngine.GameObject.Find("Camp Trial Arena")==null;')
 assert evaluate('return UnityEngine.Vector3.Distance(UnityEngine.Object.FindFirstObjectByType<Imperial.Butcher.ButcherWorld>().HeroPosition,new UnityEngine.Vector3(0,.1f,-12))<.3f;')
 truth=run('console','status')['groundTruth'];assert not truth['compilationFailed'] and truth['consoleErrors']==0
 print('PASS: arena, smooth server-position movement, one-shot attack, duplicate/stale rejection, invalid snapshot guard, terminal result and camp return.',flush=True)
finally:
 if started:run('editor.playmode','stop');run('editor.playmode','set_run_in_background','--','--enable','false')
 report=json.dumps({'passed':sys.exc_info()[0] is None,'authenticated':False,'labWrites':False,'events':events},indent=2)
 stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
 (root/'Verification'/('Trial-'+stamp+'.json')).write_text(report);(root/'Verification/Trial-latest.json').write_text(report)
