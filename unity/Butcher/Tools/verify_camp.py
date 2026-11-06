"""Integration checks against the open Butcher editor; leaves Play mode stopped."""
import json
import pathlib
import subprocess
import datetime
import sys

root = pathlib.Path(__file__).resolve().parent.parent
cli = str(pathlib.Path.home() / '.local/bin/unity')
report = []

def run(*args):
    result = subprocess.run([cli, 'command', '--project-path', str(root), '--caller', 'plugin', '--skill', 'unity-cli', '--format', 'json', *args], capture_output=True, text=True, timeout=55)
    if result.returncode:
        raise RuntimeError(result.stdout + result.stderr)
    payload = json.loads(result.stdout)['data']['result']
    report.append({'command': args[:2], 'result': payload})
    print(args[:2], json.dumps(payload)[:1600], flush=True)
    if isinstance(payload, dict) and payload.get('success') is False:
        raise RuntimeError(str(payload))
    return payload

def evaluate(code):
    return run('script', 'eval', code)['result']

status = run('editor', 'status')
if status['playMode'] != 'stopped':
    raise RuntimeError('Existing Play session belongs to the user; stop verification')
if run('console', 'status')['groundTruth']['compilationFailed']:
    raise RuntimeError('Fix compilation errors before starting Play verification')
started = False
try:
    run('editor', 'set_auto_tick')
    run('editor.playmode', 'set_run_in_background')
    run('editor.playmode', 'start')
    started = True
    ready = subprocess.run([cli, 'status', '--until-ready', '--project-path', str(root), '--format', 'json', '--timeout', '45'], capture_output=True, text=True, timeout=50)
    if ready.returncode:
        raise RuntimeError(ready.stdout)
    frames = run('job', 'wait', '--', '--condition', '{"member":"UnityEngine.Time.frameCount","op":"changed"}', '--timeout', '10')
    assert frames['met'] and frames['framesObserved'] > 0
    evaluate('var m=UnityEngine.Object.FindFirstObjectByType<Imperial.Butcher.ButcherCharacterMenu>(); if(m==null) throw new System.Exception("Character menu missing"); m.CheckConnection(); return "Checking lab from Unity";')
    probe = run('job', 'wait', '--', '--condition', '{"findType":"Imperial.Butcher.ButcherCharacterMenu","member":"ProbeCompleted","op":"equals","value":true}', '--timeout', '25')
    assert probe['met']
    assert evaluate('return UnityEngine.Object.FindFirstObjectByType<Imperial.Butcher.ButcherCharacterMenu>().ServiceReachable;') is True
    saved_hero = json.dumps({"level": 1, "originId": "ridgeborn", "archetypeId": "spellweaver",
                             "abilityScores": {"strength": 9, "intelligence": 15}, "proficientSkills": ["arcana", "lore"]})
    assert evaluate('''
        var menu = typeof(Imperial.Butcher.ButcherCharacterMenu);
        var dataType = menu.GetNestedType("CharacterData", System.Reflection.BindingFlags.NonPublic);
        var saved = UnityEngine.JsonUtility.FromJson(''' + json.dumps(saved_hero) + ''', dataType);
        var scores = dataType.GetField("abilityScores").GetValue(saved);
        var scoreType = scores.GetType();
        var summary = menu.GetMethod("AbilitySummary", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static);
        return (string)dataType.GetField("originId").GetValue(saved) == "ridgeborn"
            && (int)scoreType.GetField("intelligence").GetValue(scores) == 15
            && (string)summary.Invoke(null, new object[] { "STR", scoreType.GetField("strength").GetValue(scores) }) == "STR 9 (-1)";
    ''') is True
    evaluate('var m=UnityEngine.Object.FindFirstObjectByType<Imperial.Butcher.ButcherCharacterMenu>(); typeof(Imperial.Butcher.ButcherCharacterMenu).GetField("<IsOpen>k__BackingField",System.Reflection.BindingFlags.NonPublic|System.Reflection.BindingFlags.Instance).SetValue(m,true); return "Character menu open";')
    run('capture', 'game_view', '--', '--source', 'screen', '--save_path', 'Screenshots/Character-Menu.png')
    # Presentation fixture only: no real session, no inventory mutations or API calls.
    evaluate('var m=UnityEngine.Object.FindFirstObjectByType<Imperial.Butcher.ButcherCharacterMenu>(); var t=m.GetType(); var f=System.Reflection.BindingFlags.NonPublic|System.Reflection.BindingFlags.Instance; if(!string.IsNullOrEmpty((string)t.GetField("session",f).GetValue(m))) throw new System.Exception("Unexpected real session during fixture"); t.GetField("session",f).SetValue(m,"ui-fixture-not-a-token"); t.GetField("showEquipment",f).SetValue(m,true); t.GetField("<SelectedCharacterId>k__BackingField",f).SetValue(m,"fixture-hero"); var replyType=t.GetNestedType("InventoryReply",System.Reflection.BindingFlags.NonPublic); var fixture="{\\"characterId\\":\\"fixture-hero\\",\\"loadoutRevision\\":1,\\"starterClaimed\\":true,\\"symbols\\":[\\"MARTIAL\\",\\"FIELD\\"],\\"items\\":[{\\"id\\":\\"fixture-sword\\",\\"name\\":\\"Training Sword\\",\\"kind\\":\\"weapon\\",\\"state\\":\\"available\\",\\"source\\":\\"practice\\",\\"minimumLevel\\":1,\\"allowedSlots\\":[\\"main_hand\\"],\\"requiredSymbols\\":[\\"MARTIAL\\"]}]}"; t.GetField("inventory",f).SetValue(m,UnityEngine.JsonUtility.FromJson(fixture,replyType)); return "Inventory UI fixture loaded; no authentication or writes";')
    run('capture', 'game_view', '--', '--source', 'screen', '--save_path', 'Screenshots/Inventory-Menu.png')
    evaluate('var m=UnityEngine.Object.FindFirstObjectByType<Imperial.Butcher.ButcherCharacterMenu>(); var t=m.GetType(); var f=System.Reflection.BindingFlags.NonPublic|System.Reflection.BindingFlags.Instance; t.GetField("session",f).SetValue(m,""); t.GetField("inventory",f).SetValue(m,null); t.GetField("showEquipment",f).SetValue(m,false); t.GetField("<SelectedCharacterId>k__BackingField",f).SetValue(m,null); t.GetField("<IsOpen>k__BackingField",f).SetValue(m,false); return "Inventory fixture cleared";')
    state = evaluate('var a=UnityEngine.Object.FindFirstObjectByType<UnityEngine.Animator>(); if(a==null || !a.isHuman || !a.isInitialized || a.GetBoneTransform(UnityEngine.HumanBodyBones.Head)==null) throw new System.Exception("Humanoid rig not initialized"); return "Humanoid initialized, animationTime="+a.GetCurrentAnimatorStateInfo(0).normalizedTime;')
    assert 'Humanoid initialized' in state
    for visual in ['scout', 'spellweaver', 'knight']:
        assert evaluate('return UnityEngine.Object.FindFirstObjectByType<Imperial.Butcher.ButcherWorld>().ApplyHeroAppearance("'+visual+'");') is True
        assert evaluate('var a=UnityEngine.Object.FindFirstObjectByType<UnityEngine.Animator>(); return a!=null && a.isHuman && a.isInitialized;') is True
    assert evaluate('return UnityEngine.Object.FindFirstObjectByType<Imperial.Butcher.ButcherWorld>().ApplyHeroAppearance("untrusted/path");') is False
    assert evaluate('return UnityEngine.Object.FindFirstObjectByType<Imperial.Butcher.ButcherTrailObjective>().Interact();') is False
    for expected, position in [(1, 'new UnityEngine.Vector3(-6,0,3)'), (2, 'new UnityEngine.Vector3(0,0,22)'), (3, 'new UnityEngine.Vector3(5,0,-3)')]:
        code='var c=UnityEngine.Object.FindFirstObjectByType<UnityEngine.CharacterController>(); c.enabled=false; c.transform.position='+position+'; c.enabled=true; var objective=c.GetComponent<Imperial.Butcher.ButcherTrailObjective>(); if(!objective.Interact()) throw new System.Exception("Objective did not accept nearby interaction"); return objective.Stage;'
        assert evaluate(code) == expected
    assert evaluate('return UnityEngine.Object.FindFirstObjectByType<Imperial.Butcher.ButcherTrailObjective>().Interact();') is False
    evaluate('var c=UnityEngine.Object.FindFirstObjectByType<UnityEngine.CharacterController>(); c.enabled=false; c.transform.position=new UnityEngine.Vector3(0,.1f,-12); c.enabled=true; return "Reset hero for capture";')
    run('job', 'wait', '--', '--condition', '{"member":"UnityEngine.Time.frameCount","op":"changed"}', '--timeout', '10')
    run('capture', 'game_view', '--', '--source', 'camera', '--save_path', 'Screenshots/Camp-Hero.png')
    console = run('console', 'status')
    assert not console['groundTruth']['compilationFailed']
    assert console['groundTruth']['consoleErrors'] == 0
    print('PASS: live frames, humanoid rig, three visual swaps, invalid visual rejection, objective order and no repeated completion.', flush=True)
finally:
    if started:
        run('editor.playmode', 'stop')
        run('editor.playmode', 'set_run_in_background', '--', '--enable', 'false')
    (root/'Verification').mkdir(exist_ok=True)
    payload = json.dumps({'passed': sys.exc_info()[0] is None, 'events': report}, indent=2)
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    (root/'Verification'/('Camp-'+stamp+'.json')).write_text(payload)
    (root/'Verification'/'Camp-latest.json').write_text(payload)
