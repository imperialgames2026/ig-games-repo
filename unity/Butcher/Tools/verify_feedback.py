"""Check accepted combat feedback in Unity with local fixtures; no sign-in or lab writes."""
import datetime
import json
import pathlib
import subprocess
import sys

root = pathlib.Path(__file__).resolve().parent.parent
cli = str(pathlib.Path.home()/'.local/bin/unity')
events = []
def run(*args):
 result = subprocess.run([cli,'command','--project-path',str(root),'--caller','plugin','--skill','unity-cli','--format','json',*args],capture_output=True,text=True,timeout=55)
 if result.returncode: raise RuntimeError(result.stdout+result.stderr)
 payload = json.loads(result.stdout)['data']['result']; events.append({'command':args[:2],'result':payload})
 print(args[:2],json.dumps(payload)[:700],flush=True)
 if isinstance(payload,dict) and payload.get('success') is False: raise RuntimeError(str(payload))
 return payload
def evaluate(code): return run('script','eval',code)['result']
def frames(): assert run('job','wait','--','--condition','{"member":"UnityEngine.Time.frameCount","op":"changed"}','--timeout','10')['met']
def apply(reply,check):
 payload = json.dumps(json.dumps(reply,separators=(',',':')))
 return evaluate('var c=UnityEngine.Object.FindFirstObjectByType<Imperial.Butcher.ButcherCombatController>();c.ApplyTrialPresentation('+payload+');var f=UnityEngine.Object.FindFirstObjectByType<Imperial.Butcher.ButcherTrialFeedback>();'+check)

hero = {'id':'hero','name':'Feedback Fixture','armorClass':11,'hitPoints':7,'maxHitPoints':7,'movementRemainingFeet':30,'actionUsed':False,'position':{'x':2,'y':2},'weapon':{'id':'practice_staff','rangeFeet':5},'abilityIds':['spark_burst','guarding_vow'],'mana':3,'maxMana':3,'wardArmorBonus':0}
sentinel = {'id':'sentinel','name':'Camp Sentinel','armorClass':11,'hitPoints':10,'maxHitPoints':10,'position':{'x':5,'y':2}}
state = {'id':'fixture-feedback','revision':0,'phase':'active','outcome':None,'map':{'width':8,'height':8,'tileSizeFeet':5,'blockedCells':['4,4','4,5']},'combatants':[hero,sentinel]}
reply = {'encounter':{'id':'fixture-feedback','characterId':'fixture-hero','state':state},'events':[]}
assert run('editor','status')['playMode']=='stopped','Do not interrupt a user Play session'
assert not run('console','status')['groundTruth']['compilationFailed']
started = False
try:
 run('editor','set_auto_tick'); run('editor.playmode','set_run_in_background'); run('editor.playmode','start'); started=True
 ready = subprocess.run([cli,'status','--until-ready','--project-path',str(root),'--format','json','--timeout','45'],capture_output=True,text=True,timeout=50)
 if ready.returncode: raise RuntimeError(ready.stdout)
 frames()
 evaluate('var c=UnityEngine.Object.FindFirstObjectByType<Imperial.Butcher.ButcherCombatController>();if(UnityEngine.Object.FindFirstObjectByType<Imperial.Butcher.ButcherCharacterMenu>().IsSignedIn)throw new System.Exception("Unexpected real session");c.GetType().GetField("heroId",System.Reflection.BindingFlags.NonPublic|System.Reflection.BindingFlags.Instance).SetValue(c,"fixture-hero");return "Local feedback fixtures only";')
 assert apply(reply,'return f.HeroHealth==7 && f.SentinelHealth==10 && f.HitCount==0 && f.MissCount==0;')
 state['revision']=1; sentinel['hitPoints']=6
 reply['events']=[{'kind':'attack','detail':{'attack':{'hit':True,'damage':4}}}]
 assert apply(reply,'return f.HitCount==1 && f.LastFeedback=="−4" && f.SentinelHealth==6;')
 assert apply(reply,'return f.HitCount==1;')  # Receipt replay must not repeat effects.
 state['revision']=3; sentinel['position']={'x':3,'y':2}
 reply['events']=[{'kind':'hostile_turn','detail':{'outcome':'approach','attack':None}}]
 assert apply(reply,'return f.SentinelAttackCount==0 && f.MissCount==0;')
 state['revision']=5; hero['hitPoints']=5
 reply['events']=[{'kind':'hostile_turn','detail':{'outcome':'attack_hit','attack':{'hit':True,'damage':2}}}]
 assert apply(reply,'return f.HeroHealth==5 && f.HitCount==2 && f.SentinelAttackCount==1 && f.SentinelSwinging;')
 state['revision']=7
 reply['events']=[{'kind':'hostile_turn','detail':{'outcome':'attack_missed','attack':{'hit':False,'damage':0}}}]
 assert apply(reply,'return f.HeroHealth==5 && f.HitCount==2 && f.MissCount==1 && f.SentinelAttackCount==2 && f.LastFeedback=="MISS";')
 state['revision']=8; hero['mana']=2; sentinel['hitPoints']=3
 reply['events']=[{'kind':'skill','detail':{'skillId':'spark_burst','attack':{'hit':True,'damage':3}}}]
 assert apply(reply,'return f.HitCount==3 && f.SentinelHealth==3 && f.LastFeedback=="SPARK −3";')
 state['revision']=9; hero.update(mana=1,wardArmorBonus=2,armorClass=13)
 reply['events']=[{'kind':'skill','detail':{'skillId':'guarding_vow','attack':None}}]
 assert apply(reply,'return f.HitCount==3 && f.MissCount==1 && f.SentinelAttackCount==2;')
 evaluate('var c=UnityEngine.Object.FindFirstObjectByType<Imperial.Butcher.ButcherCombatController>();c.GetType().GetField("notice",System.Reflection.BindingFlags.NonPublic|System.Reflection.BindingFlags.Instance).SetValue(c,"Feedback fixture · no server mutations");return "Fixture labelled";')
 frames(); run('capture','game_view','--','--source','screen','--save_path','Screenshots/Trial-Feedback.png')
 assert evaluate('var f=UnityEngine.Object.FindFirstObjectByType<Imperial.Butcher.ButcherTrialFeedback>();return f.HealthBarsDrawn && !f.HealthBarsOverlap;')
 # Stale replies cannot overwrite health or replay impacts.
 state['revision']=8; hero['hitPoints']=1
 assert apply(reply,'return f.HeroHealth==5 && f.HitCount==3;')
 state['revision']=10; hero['hitPoints']=5; state.update(phase='completed',outcome='heroes_win'); sentinel['hitPoints']=0;reply['events']=[]
 assert apply(reply,'return f.SentinelHealth==0;')
 assert apply({'encounter':None,'events':[]},'return !c.InTrial;')
 frames()
 assert evaluate('return UnityEngine.Object.FindFirstObjectByType<Imperial.Butcher.ButcherTrialFeedback>()==null && UnityEngine.GameObject.Find("Spark Burst visual")==null;')
 # A fresh arena must have fresh feedback counters, even after terminal cleanup.
 state.update(revision=0,phase='active',outcome=None); sentinel['hitPoints']=10
 assert apply(reply,'return f.HitCount==0 && f.MissCount==0 && f.SentinelAttackCount==0 && f.HeroHealth==5;')
 assert apply({'encounter':None,'events':[]},'return !c.InTrial;')
 frames()
 truth=run('console','status')['groundTruth'];assert not truth['compilationFailed'] and truth['consoleErrors']==0
 print('PASS: accepted HP, hit/miss/skill feedback, enemy approach vs attack, replay/stale suppression, cleanup and fresh-arena isolation.',flush=True)
finally:
 if started: run('editor.playmode','stop'); run('editor.playmode','set_run_in_background','--','--enable','false')
 report=json.dumps({'passed':sys.exc_info()[0] is None,'authenticated':False,'labWrites':False,'events':events},indent=2)
 stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
 (root/'Verification'/('Feedback-'+stamp+'.json')).write_text(report);(root/'Verification/Feedback-latest.json').write_text(report)
