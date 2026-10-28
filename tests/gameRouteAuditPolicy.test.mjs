import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,copyFileSync,readFileSync,writeFileSync,rmSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const root=new URL('../',import.meta.url);
function audit(edit){
 const dir=mkdtempSync(join(tmpdir(),'ig-route-policy-'));
 try{
  for(const folder of ['scripts','lib','config','pages'])mkdirSync(join(dir,folder));
  for(const name of ['scripts/audit-game-backends.mjs','lib/practiceReleasePolicy.js','config/game-migration-scope.json','App.jsx'])copyFileSync(new URL(name,root),join(dir,name));
  for(const name of readdirSync(new URL('pages/',root)).filter(x=>/^Play[A-Z].*\.jsx$/.test(x)))copyFileSync(new URL('pages/'+name,root),join(dir,'pages',name));
  writeFileSync(join(dir,'package.json'),' {"type":"module"}');
  const change=(file,fn)=>writeFileSync(join(dir,file),fn(readFileSync(join(dir,file),'utf8')));
  edit?.(change);
  return spawnSync(process.execPath,['scripts/audit-game-backends.mjs'],{cwd:dir,encoding:'utf8'});
 }finally{rmSync(dir,{recursive:true,force:true});}
}
test('canonical narrow site policy passes the complete game audit',()=>assert.equal(audit().status,0));
for(const [label,file,from,to] of [
 ['activate parked route','lib/practiceReleasePolicy.js',"'PlayPoker',","'PlayDice',"],
 ['bypass canonical set','App.jsx','new Set(activePracticeGameRoutes)','new Set([])'],
 ['remove route blocker','App.jsx','!verifiedPracticeGames.has(path)','false'],
 ['remove financial blocker','App.jsx','disabledFinancialRoutes.has(path)','false'],
 ['direct financial write','pages/PlayPoker.jsx','export default','base44.entities.UserWallet.update({});\nexport default'],
])test('audit rejects '+label,()=>assert.notEqual(audit(change=>change(file,s=>{assert.ok(s.includes(from));return s.replace(from,to);})).status,0));
