import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// Offline configuration acceptance only. Never invokes systemctl, the cleanup
// client, an existing credential path, a network service or a comparison worker.
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const name='imperial-kyc-retention';
const directory=join(root,'services/kyc-retention/systemd');
const service=readFileSync(join(directory,name+'.service'),'utf8');
const timer=readFileSync(join(directory,name+'.timer'),'utf8');
function options(source){
 const values=new Map();let section;
 for(const raw of source.split('\n')){
  const line=raw.trim();if(!line||line.startsWith('#'))continue;
  if(line.startsWith('[')){assert.match(line,/^\[[A-Za-z]+\]$/);section=line.slice(1,-1);continue;}
  const at=line.indexOf('=');assert(at>0&&section,'unit option must belong to a section');
  const key=section+'.'+line.slice(0,at);assert(!values.has(key),'duplicate unit option: '+key);values.set(key,line.slice(at+1));
 }
 return values;
}
const s=options(service),t=options(timer);
assert.equal(s.get('Service.Type'),'oneshot');
assert.equal(s.get('Service.DynamicUser'),'yes');
assert.equal(s.get('Service.LoadCredential'),'retention-config:/etc/imperial-games/kyc-retention.json');
assert.equal(s.get('Service.ExecStart'),'/usr/bin/python3 -B /opt/imperial-games/kyc-retention/cleanup.py --config %d/retention-config --once');
assert.equal(s.get('Service.TimeoutStartSec'),'7min');
assert(7*60>11*30,'service deadline must exceed eleven maximum HTTP request waits');
assert.equal(s.get('Service.UMask'),'0077');
assert.equal(s.get('Service.NoNewPrivileges'),'yes');
assert.equal(s.get('Service.ProtectSystem'),'strict');
assert.equal(s.get('Service.ProtectHome'),'yes');
assert.equal(s.get('Service.CapabilityBoundingSet'),'');
assert.equal(s.get('Service.StandardOutput'),'journal');
assert.equal(s.get('Service.StandardError'),'journal');
assert.equal(t.get('Timer.Unit'),name+'.service');
assert.equal(t.get('Timer.OnUnitInactiveSec'),'60s');
assert.equal(t.get('Timer.OnBootSec'),'2min');
assert.equal(t.get('Install.WantedBy'),'timers.target');
for(const key of ['Timer.OnCalendar','Timer.OnUnitActiveSec'])assert(!t.has(key),'use completion-relative scheduling only');
for(const key of ['Service.ExecStartPre','Service.ExecStartPost','Service.Restart','Service.RemainAfterExit'])assert(!s.has(key),'keep one bounded non-overlapping invocation');
assert(!s.has('Install.WantedBy'),'service is activated only by its timer or an approved manual start');
assert(!/kyc-worker|--models|\.venv|worker\.py/.test(service+timer),'scheduler must not depend on comparison runtime');

const version=spawnSync('systemd-analyze',['--version'],{encoding:'utf8'});
if(version.error?.code==='ENOENT'){
 if(process.env.CI)throw Error('CI must provide systemd-analyze for offline unit verification');
 console.log('PASS static scheduling guards; SKIP systemd parser: systemd-analyze unavailable');
}else{
 assert.equal(version.status,0,'systemd-analyze must be usable');
 const stage=mkdtempSync(join(tmpdir(),'ig-retention-unit-'));
 try{
  // Replace only uninstalled deployment paths. This prevents any access to an
  // operator credential and lets the real parser resolve a harmless local fixture.
  writeFileSync(join(stage,'cleanup.py'),"raise SystemExit('Verification fixture must never be executed')\n",{mode:0o600});
  writeFileSync(join(stage,'synthetic-config.json'),'{"synthetic":true}\n',{mode:0o600});
  const checkService=service.replaceAll('/opt/imperial-games/kyc-retention',stage).replace('/etc/imperial-games/kyc-retention.json',join(stage,'synthetic-config.json'));
  writeFileSync(join(stage,name+'.service'),checkService);
  writeFileSync(join(stage,name+'.timer'),timer);
  const checked=spawnSync('systemd-analyze',['verify',join(stage,name+'.service'),join(stage,name+'.timer')],{encoding:'utf8',timeout:30000});
  assert.equal(checked.status,0,checked.stderr||checked.error?.message||'offline systemd verification failed');
  console.log('PASS model-free oneshot/timer guards and offline systemd-analyze verify (temporary deployment-path substitutions only; no units started)');
 }finally{rmSync(stage,{recursive:true,force:true});}
}
