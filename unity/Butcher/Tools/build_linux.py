"""Build through Unity Pipeline's async build command. --resume <id> observes an existing build."""
import json
import pathlib
import subprocess
import sys
import time

root=pathlib.Path(__file__).resolve().parent.parent
cli=str(pathlib.Path.home()/'.local/bin/unity')
def call(*args):
 result=subprocess.run([cli,'command','--project-path',str(root),'--caller','plugin','--skill','unity-cli','--format','json',*args],capture_output=True,text=True,timeout=90)
 if result.returncode: raise RuntimeError(result.stdout+result.stderr)
 return json.loads(result.stdout)['data']['result']
if len(sys.argv)==3 and sys.argv[1]=='--resume': build_id=sys.argv[2]
else:
 if call('editor','status')['playMode']!='stopped': raise SystemExit('Stop your Play session before building')
 if call('console','status')['groundTruth']['compilationFailed']: raise SystemExit('Fix compilation errors before building')
 if not call('script','eval','return UnityEditor.SceneManagement.EditorSceneManager.SaveOpenScenes();')['result']: raise SystemExit('Save the open scene before building')
 queued=call('build','run','--','--target','StandaloneLinux64','--outputPath','Builds/Linux/Butcher.x86_64','--scenes','["Assets/Butcher/Scenes/Camp.unity"]','--confirm','true')
 if queued.get('status')!='queued': raise SystemExit(str(queued))
 build_id=queued['buildId']
print('Observing',build_id,flush=True)
deadline=time.monotonic()+600
last=None
while time.monotonic()<deadline:
 result=call('build','status')
 if result.get('buildId')!=build_id: raise SystemExit('A different build replaced this job')
 (root/'Verification').mkdir(exist_ok=True)
 (root/'Verification/Linux-build.json').write_text(json.dumps(result,indent=2)+'\n')
 status=result.get('status')
 if status!=last: print('Build status:',status,flush=True);last=status
 if status=='completed':
  if result.get('result') != 'Succeeded': raise SystemExit('Build failed; inspect Verification/Linux-build.json')
  print('Build succeeded; run Tools/verify_linux.py',flush=True)
  break
 time.sleep(10)
else: raise SystemExit('Build is still pending after ten minutes; inspect build status before retrying')
