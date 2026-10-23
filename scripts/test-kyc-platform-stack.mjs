import assert from 'node:assert/strict';
import {execFileSync,spawn,spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdtempSync,mkdirSync,rmSync,openSync,closeSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout} from 'node:timers/promises';
import {build} from 'esbuild';

// Only an isolated CLI-managed local project; no remote URL, profile, key or
// database argument accepted. --check validates packaging without starting Docker.
assert(process.argv.length===2||(process.argv.length===3&&process.argv[2]==='--check'));
const check=process.argv[2]==='--check',root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const stage=mkdtempSync('/tmp/ig-kyc-platform-'),project='ig-kyc-platform-'+randomUUID().replaceAll('-','').slice(0,12);
// CLI truncates longer project IDs; keep generated service hostnames intact.
assert(project.length<=32);
const require=createRequire(import.meta.url),db='supabase_db_'+project;
const env={...process.env,SUPABASE_TELEMETRY_DISABLED:'1',DO_NOT_TRACK:'1',SUPABASE_INTERNAL_IMAGE_REGISTRY:'docker.io'};
// Do not inherit credentials for hosted management into the local CLI process.
for(const name of ['SUPABASE_ACCESS_TOKEN','SUPABASE_DB_PASSWORD','SUPABASE_PROJECT_ID','SUPABASE_PROJECT_REF'])delete env[name];
const cli=(args,options={})=>execFileSync('supabase',[...args,'--workdir',stage],{env,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:600000,...options});
let started=false,server,logfd;let secrets=[];
try{
 execFileSync(process.execPath,[resolve(root,'scripts/prepare-reviewed-backend.mjs'),stage],{stdio:'pipe'});
 const manifest=JSON.parse(readFileSync(resolve(root,'supabase/backend-manifest.json'),'utf8'));
 assert.equal(manifest.migrations.length,107);
 // Package checksums first, then retain only the allowed HTTP handler. No
 // comparison worker, other function or model code is launched by this harness.
 rmSync(stage+'/supabase/functions',{recursive:true});mkdirSync(stage+'/supabase/functions/ig-kyc-v1',{recursive:true});
 await build({entryPoints:[resolve(root,'supabase/functions/ig-kyc-v1/index.ts')],outfile:stage+'/supabase/functions/ig-kyc-v1/index.ts',bundle:true,platform:'browser',format:'esm',plugins:[{name:'locked-npm',setup(b){b.onResolve({filter:/^npm:/},a=>({path:require.resolve(a.path.replace(/^npm:/,'').replace(/@\d.*$/,''))}));}}]});
 writeFileSync(stage+'/supabase/config.toml',`project_id = "${project}"\n[db]\nmajor_version = 17\n[db.seed]\nenabled = false\n[functions.ig-kyc-v1]\nverify_jwt = true\n`);
 writeFileSync(stage+'/local.env','IG_LOCAL_PRACTICE=true\n',{mode:0o600});
 console.log('PASS full-platform preflight: 107 checksum-verified migrations, one bundled reviewed handler, seeds disabled, JWT guard preserved');
 if(!check){
  const driver=execFileSync('docker',['info','--format','{{.Driver}}'],{encoding:'utf8'}).trim();
  assert.notEqual(driver,'vfs','Full platform requires an existing copy-on-write runner; do not repeat local vfs pull');
  started=true;
  cli(['start','--debug','--exclude','studio,imgproxy,logflare,vector,postgres-meta,realtime,mailpit,supavisor,edge-runtime']);
  const c=JSON.parse(cli(['status','--output','json']));
  assert.equal(c.API_URL,'http://127.0.0.1:54321');
  for(const field of ['ANON_KEY','SERVICE_ROLE_KEY','JWT_SECRET'])assert.equal(typeof c[field],'string',field+' is local CLI output');
  secrets=[c.ANON_KEY,c.SERVICE_ROLE_KEY,c.JWT_SECRET];
  const versions=execFileSync('docker',['exec',db,'psql','-U','postgres','-d','postgres','-At','-c','select version from supabase_migrations.schema_migrations order by version;'],{encoding:'utf8'}).trim().split('\n');
  assert.deepEqual(versions,manifest.migrations.map(m=>m.file.split('_')[0]).sort());
  console.log('PASS actual Supabase PostgreSQL: all 107 packaged migration versions replayed');
  logfd=openSync(stage+'/edge.log','w',0o600);
  server=spawn('supabase',['functions','serve','--workdir',stage,'--env-file',stage+'/local.env'],{env,stdio:['ignore',logfd,logfd]});
  let ready=false;
  for(let i=0;i<120;i++){
   try{const r=await fetch(c.API_URL+'/functions/v1/ig-kyc-v1',{method:'POST',headers:{apikey:c.ANON_KEY,authorization:'Bearer '+c.ANON_KEY,'content-type':'application/json'},body:JSON.stringify({action:'mine'}),signal:AbortSignal.timeout(2000)});const data=await r.json();if(r.status===401&&data.error==='Registered account required'){ready=true;break;}}catch{}
   if(server.exitCode!==null)break;
   await setTimeout(500);
  }
  assert(ready,'CLI Edge handler must become ready through normal Kong gateway');
  writeFileSync(stage+'/runtime-info.json',JSON.stringify({...c,DB_CONTAINER:db,SCHEMA_MODE:'full-platform'}),{mode:0o600});
  const result=spawnSync(process.execPath,[resolve(root,'scripts/test-kyc-local-runtime.mjs'),stage+'/runtime-info.json'],{stdio:'inherit',timeout:180000});
  assert.equal(result.status,0,'full platform synthetic manual-review and retention scenarios');
  console.log('PASS full-schema Auth/Storage/PostgREST/Edge scenarios through actual local Kong; no comparison actions');
 }
}catch(error){
 // Never dump local CLI status/env or entire logs (they include generated keys).
 let message=error.message.split('\n')[0];for(const secret of secrets)message=message.split(secret).join('[local credential]');
 console.error(message);
 if(error.stderr||error.stdout){
  const lines=(String(error.stdout||'')+'\n'+String(error.stderr||'')).split('\n').filter(s=>!(/password|secret|bearer|authorization|api.?key|postgres(?:ql)?:\/\/|^[a-f0-9]{12}:|pulling|download|checksum|digest:|pgwire.*(?:Parse|Bind|DataRow)/i.test(s)));
  console.error(lines.slice(-100).map(s=>s.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[local JWT]').slice(0,500)).join('\n'));
 }
 if(server){const lines=readFileSync(stage+'/edge.log','utf8').split('\n').filter(s=>/error|failed|exception/i.test(s)&&!(/token|secret|password|bearer|authorization|key/i.test(s)));console.error(lines.slice(-5).map(s=>s.slice(0,350)).join('\n'));}
 process.exitCode=1;
}finally{
 if(server){server.kill('SIGTERM');await new Promise(r=>{if(server.exitCode!==null)return r();server.once('exit',r);globalThis.setTimeout(r,3000);});}
 if(logfd!==undefined)closeSync(logfd);
 if(started){try{cli(['stop','--no-backup']);}catch{console.error('Disposable platform cleanup failed; inspect project '+project);process.exitCode=1;}}
 rmSync(stage,{recursive:true,force:true});
}
