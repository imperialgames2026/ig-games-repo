"""Run an opt-in, headless Linux player startup check; no Auth or lab writes."""
import json
import pathlib
import subprocess
import sys

root=pathlib.Path(__file__).resolve().parent.parent
binary=root/'Builds/Linux/Butcher.x86_64'
graphics='--graphics' in sys.argv
suffix='Linux-graphics-smoke' if graphics else 'Linux-smoke'
report=root/('Verification/'+suffix+'.json')
log=root/('Verification/'+suffix+'.log')
if not binary.is_file(): raise SystemExit('Build the Linux player first')
report.unlink(missing_ok=True)
command=[str(binary),'-batchmode',*(['-force-glcore'] if graphics else ['-nographics']),'--butcher-smoke-test','--butcher-smoke-report',str(report),'-logFile',str(log)]
try:
    result=subprocess.run(command,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=75)
except subprocess.TimeoutExpired:
    raise SystemExit('Linux startup check timed out; the test player was stopped')
if not report.is_file(): raise SystemExit(f'No runtime report; process exited {result.returncode}. Inspect {log}')
payload=json.loads(report.read_text())
device_initialized=graphics and log.is_file() and 'OpenGL' in log.read_text(errors='replace') and 'Renderer:' in log.read_text(errors='replace')
payload.update({'processExitCode':result.returncode,'graphicsDeviceInitialized':device_initialized,'graphicsVerified':False,'authenticatedInventoryVerified':False})
report.write_text(json.dumps(payload,indent=2)+'\n')
print(json.dumps(payload,indent=2))
sys.exit(0 if payload.get('passed') and result.returncode==0 and (not graphics or device_initialized) else 1)
