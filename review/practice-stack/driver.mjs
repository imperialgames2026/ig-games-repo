import {projectRoot} from './source-root.mjs';
// Future isolated runtime driver. Offline --plan/import is side-effect free.
import {execFileSync,spawn,spawnSync} from 'node:child_process';
import {randomBytes,createHmac,createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,existsSync,rmSync,realpathSync} from 'node:fs';
import {resolve,dirname} from 'node:path';import {fileURLToPath} from 'node:url';
import {Resources,runtimePlan} from './lifecycle.mjs';
import {functions as allowedFunctions} from './policy.mjs';
import {createContainerSql} from './accounting-lifecycle/container-sql.mjs';
import {createRequire} from 'node:module';import {acceptance} from './acceptance.mjs';
const here=dirname(fileURLToPath(import.meta.url));
export function assertFunctionInventory(entries){if(!Array.isArray(entries)||JSON.stringify(entries.map(x=>x.slug).sort())!==JSON.stringify([...allowedFunctions].sort()))throw Error('exact unique handler allowlist required');}
export function validateRunConfig(c){
 if(!c||!/^[a-f0-9]{32}$/.test(c.run))throw Error('invalid run');
 if(c.testSlice!==undefined&&!['full','seating','formats','protocol','showdown','extended','sms'].includes(c.testSlice))throw Error('unsupported acceptance slice');
 const expected=runtimePlan(c.run);if(c.stage!==expected.stage)throw Error('exact fresh stage required');
 if(c.approved!==true||c.offlineReviewComplete!==true)throw Error('explicit reviewed runtime approval missing');
 if(!c.sourceStage||!realpathSync(c.sourceStage).startsWith(here+'/staged/'))throw Error('reviewed source stage required');
 const trustedBootstrap='7281d021e17c22a4066a3897ddaaf7e7217a159ac8cd507803cbd58f45860ad8';
 if(c.bootstrapSha256!==trustedBootstrap)throw Error('bootstrap differs from independently reviewed source artifact');
 if(c.bootstrap!==resolve(here,'reviewed-app-bootstrap-fixed-formats.sql'))throw Error('exact reviewed bootstrap path required');
 if(!/^[a-f0-9]{64}$/.test(c.bootstrapSha256??''))throw Error('pinned synthetic bootstrap required');
 const root=projectRoot;
 if(!/^[a-f0-9]{40}$/.test(c.frontendCommit??''))throw Error('frontend commit pin missing');
 if(execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim()!==c.frontendCommit||execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim())throw Error('frontend source must be exact clean reviewed commit');
 const raw=readFileSync(c.bootstrap);if(createHash('sha256').update(raw).digest('hex')!==c.bootstrapSha256)throw Error('bootstrap hash mismatch');
 const manifests=JSON.parse(readFileSync(resolve(c.sourceStage,'source-manifest.json')));
 assertFunctionInventory(manifests.functions);
 const helperFiles=['application-main/index.ts','gateway.mjs','policy.mjs'];
 if(JSON.stringify((manifests.helpers??[]).map(x=>x.file).sort())!==JSON.stringify([...helperFiles].sort()))throw Error('exact helper inventory required');
 for(const h of manifests.helpers){const bytes=readFileSync(resolve(c.sourceStage,h.file));if(createHash('sha256').update(bytes).digest('hex')!==h.sha256)throw Error('helper drift');const original=h.file==='application-main/index.ts'?'main.ts':h.file;if(createHash('sha256').update(readFileSync(resolve(here,original))).digest('hex')!==h.sha256)throw Error('helper differs from reviewed source');}
 if(manifests.functions.length!==allowedFunctions.length||manifests.functions.some(x=>x.runtimeDependencyCacheVerified!==true||!Array.isArray(x.exactExternalImports)||x.exactExternalImports.length!==0))throw Error('exact dependency bundles not ready');
 for(const f of manifests.functions){if(!/^[a-z0-9-]+$/.test(f.slug))throw Error('invalid bundle slug');const bytes=readFileSync(resolve(c.sourceStage,'functions',f.slug,'index.js'));if(createHash('sha256').update(bytes).digest('hex')!==f.bundleSha256)throw Error('bundle drift');}
 if(!/^sha256:[a-f0-9]{64}$/.test(c.databaseImage??''))throw Error('local built database image identity required');
 return expected;
}
export async function execute(c){
 if(process.env.IG_SYNTHETIC_STACK_APPROVED!=='1')throw Error('startup approval interlock missing');
 const plan=validateRunConfig(c);if(existsSync(c.stage))throw Error('refuse existing stage');
 const resources=new Resources(c.run),children=[];let stageCreated=false,snapshotCreated=false,snapshotRoot;
 const docker=(args,options={})=>execFileSync('docker',args,{encoding:'utf8',timeout:30000,maxBuffer:2*1024*1024,stdio:['pipe','pipe','pipe'],...options});
 const label=['--label','ig.synthetic.run='+c.run],prefix=plan.prefix;
 const images=JSON.parse(readFileSync(resolve(here,'images.json'))).images;
 const image=key=>images.find(x=>x.startsWith(key));
 let rejectFatal;const fatal=new Promise((_,reject)=>{rejectFatal=reject;});void fatal.catch(()=>{});const onUnhandled=error=>rejectFatal(error instanceof Error?error:new Error('Unhandled test promise rejection'));process.on('unhandledRejection',onUnhandled);
 let secret,anon,service,browser,runFailure=null;const evidenceDir=resolve(projectRoot,'../approved-runtime-evidence',c.run);mkdirSync(evidenceDir,{recursive:true,mode:0o700});
 const redact=value=>{let s=String(value);for(const v of [secret,anon,service])if(v)s=s.split(v).join('[synthetic secret]');return s.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[synthetic JWT]');};
 try{
  // No cache miss may trigger a pull/build here.
  for(const i of [c.databaseImage,...images])docker(['image','inspect',i]);
  mkdirSync(c.stage,{mode:0o700});stageCreated=true;
  secret=randomBytes(48).toString('base64url');
  const sign=role=>{const h=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');const b=Buffer.from(JSON.stringify({role,iss:'supabase',aud:'authenticated',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');return h+'.'+b+'.'+createHmac('sha256',secret).update(h+'.'+b).digest('base64url');};anon=sign('anon');service=sign('service_role');
  const privateId=docker(['network','create','--internal',...label,prefix+'-private']).trim();resources.register('network',privateId);
  const transportId=docker(['network','create',...label,prefix+'-gateway']).trim();resources.register('network',transportId);
  const create=(name,args)=>{const id=docker(['create','--pull=never',...label,'--name',prefix+'-'+name,'--pids-limit','128','--security-opt','no-new-privileges:true',...args]).trim();resources.register('container',id);return id;};
  const start=id=>docker(['start',id]);const env=values=>Object.entries(values).flatMap(([k,v])=>['-e',k+'='+v]);
  const db=create('db',['--network',privateId,'--network-alias','db','--memory','1024m','--cpus','1','--tmpfs','/var/lib/postgresql/data:rw,size=768m',...env({POSTGRES_HOST_AUTH_METHOD:'trust'}),c.databaseImage,'-c','shared_preload_libraries=pg_cron','-c','cron.database_name=postgres','-c','cron.launch_active_jobs=off']);start(db);
  const sql=text=>docker(['exec','-i',db,'psql','-h','127.0.0.1','-U','postgres','-X','-q','-v','ON_ERROR_STOP=1'],{input:text});
  const wait=async fn=>{for(let i=0;i<60;i++){try{if(await fn())return;}catch(error){if(/permission denied|not allowed|access denied|authorization denied/i.test(String(error.stderr??error.message)))throw Error('Access denied during readiness; stopped without retry');}await new Promise(r=>setTimeout(r,500));}throw Error('synthetic readiness timeout');};
  await wait(()=>{docker(['exec',db,'pg_isready','-h','127.0.0.1','-U','postgres']);return true;});
  // Fresh namespaced DB proof before applying platform setup.
  const n=docker(['exec',db,'psql','-h','127.0.0.1','-U','postgres','-X','-At','-c',"select count(*) from pg_namespace where nspname not like 'pg_%' and nspname not in ('public','information_schema')"]);if(n.trim()!=='0')throw Error('fresh platform proof failed');
  sql(readFileSync(resolve(here,'platform-init.sql'),'utf8'));
  const auth=create('auth',['--network',privateId,'--network-alias','auth','--memory','256m','--cpus','.5',...env({GOTRUE_API_HOST:'0.0.0.0',GOTRUE_API_PORT:'9999',API_EXTERNAL_URL:'http://127.0.0.1:54321/auth/v1',GOTRUE_SITE_URL:'http://127.0.0.1:4173',GOTRUE_DB_DRIVER:'postgres',GOTRUE_DB_DATABASE_URL:'postgres://supabase_auth_admin@db:5432/postgres',GOTRUE_JWT_SECRET:secret,GOTRUE_JWT_AUD:'authenticated',GOTRUE_JWT_DEFAULT_GROUP_NAME:'authenticated',GOTRUE_JWT_ADMIN_ROLES:'service_role',GOTRUE_EXTERNAL_EMAIL_ENABLED:'true',GOTRUE_MAILER_AUTOCONFIRM:'true'}),image('supabase/gotrue:')]);start(auth);
  await wait(()=>docker(['exec',db,'psql','-h','127.0.0.1','-U','postgres','-X','-At','-c',"select to_regclass('auth.sessions') is not null and to_regprocedure('auth.jwt()') is not null;"]).trim()==='t');
  sql(readFileSync(resolve(here,'assert-auth-platform.sql'),'utf8'));
  sql(readFileSync(c.bootstrap,'utf8'));
  if(c.testSlice==='sms'){const consentSql=readFileSync(resolve(projectRoot,'supabase/proposals/practice-sms-consent.sql'));if(createHash('sha256').update(consentSql).digest('hex')!=='e37cc16a0880c7dc92f094129d5843f316f23111d34727892bc8a583e1d9a181')throw Error('Reviewed consent SQL drift');sql('begin;'+consentSql.toString()+'commit;');}
  const rest=create('rest',['--network',privateId,'--network-alias','rest','--memory','256m','--cpus','.5',...env({PGRST_DB_URI:'postgres://authenticator@db:5432/postgres',PGRST_DB_SCHEMAS:'public',PGRST_DB_ANON_ROLE:'anon',PGRST_JWT_SECRET:secret}),image('postgrest/postgrest:')]);start(rest);
  writeFileSync(resolve(c.stage,'local-info.json'),JSON.stringify({API_INTERNAL_URL:'http://kong:8000',ANON_KEY:anon,SERVICE_ROLE_KEY:service}),{mode:0o600});
  const edge=create('edge',['--network',privateId,'--network-alias','edge','--memory','768m','--cpus','1','-v',c.sourceStage+':/probe:ro','-v',resolve(c.stage,'local-info.json')+':/run/ig-synthetic/local-info.json:ro',...env({IG_SYNTHETIC_STACK_APPROVED:'1'}),image('supabase/edge-runtime:'),'start','--main-service','/probe/application-main','--port','9000']);start(edge);
  const gateway=create('gateway',['--network',transportId,'--memory','128m','--cpus','.25','-p','127.0.0.1:54321:8000','-v',c.sourceStage+':/probe:ro',...env({IG_SYNTHETIC_STACK_APPROVED:'1'}),image('node:'),'node','/probe/gateway.mjs']);docker(['network','connect','--alias','kong',privateId,gateway]);start(gateway);
  await wait(async()=>{const r=await fetch('http://127.0.0.1:54321/functions/v1/health',{signal:AbortSignal.timeout(2000)});if([401,403].includes(r.status))throw Error('Access denied');return r.status===200;});
  const root=projectRoot;const require=createRequire(resolve(root,'package.json'));const {chromium}=require('@playwright/test');
  const browserExecutable=existsSync(chromium.executablePath())?chromium.executablePath():'/opt/google/chrome/chrome';
  if(!existsSync(browserExecutable))throw Error('Browser binary missing; no automatic installation');
  snapshotRoot=resolve(c.stage,'frontend-source');execFileSync('git',['worktree','add','--detach',snapshotRoot,c.frontendCommit],{cwd:root,stdio:['ignore','pipe','pipe'],timeout:30000});snapshotCreated=true;
  const {symlinkSync}=await import('node:fs');symlinkSync(resolve(root,'node_modules'),resolve(snapshotRoot,'node_modules'),'dir');
  const localEnv=Object.fromEntries(Object.entries(process.env).filter(([k])=>!/^VITE_|^SUPABASE_|SERVICE_ROLE|JWT_SECRET/.test(k)));
  Object.assign(localEnv,{VITE_SUPABASE_URL:'http://127.0.0.1:54321',VITE_SUPABASE_PUBLISHABLE_KEY:anon,VITE_ENABLE_LEGACY_EDGE_FUNCTIONS:'false',GITHUB_SHA:c.frontendCommit});
  if(!/^[a-f0-9]{40}$/.test(c.frontendCommit??''))throw Error('frontend commit pin missing');
  const actual=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();if(actual!==c.frontendCommit)throw Error('frontend source changed');
  execFileSync('npm',['run','build','--','--outDir',resolve(c.stage,'web')],{cwd:snapshotRoot,env:localEnv,stdio:['ignore','pipe','pipe'],timeout:180000,maxBuffer:8*1024*1024});
  const vite=spawn(process.execPath,[resolve(root,'node_modules/vite/bin/vite.js'),'preview','--outDir',resolve(c.stage,'web'),'--host','127.0.0.1','--port','4173','--strictPort'],{cwd:snapshotRoot,env:localEnv,stdio:'ignore'});children.push(vite);
  await wait(async()=>{const r=await fetch('http://127.0.0.1:4173',{signal:AbortSignal.timeout(2000)});if([401,403].includes(r.status))throw Error('Access denied');return r.status===200;});
  browser=await chromium.launch({executablePath:browserExecutable});const evidence=await Promise.race([fatal,acceptance({run:c.run,anon,service,browser,sql,slice:c.testSlice,db:createContainerSql({run:c.run,id:db,image:c.databaseImage,approvedRun:c.run}),record:(phase,data)=>{if(!/^[a-zA-Z0-9-]+$/.test(phase))throw Error('invalid evidence phase');writeFileSync(resolve(evidenceDir,phase+'.json'),JSON.stringify(data,null,2)+'\n',{mode:0o600});}})]);
  await browser.close();browser=null;
  // This bounded suite does not turn missing settlement/concurrency evidence
  // into a pass. Full release gates remain open and are printed explicitly.
  writeFileSync(resolve(evidenceDir,'acceptance.json'),JSON.stringify({runtimeSlice:evidence,releaseReady:false},null,2)+'\n',{mode:0o600});console.log(JSON.stringify({runtimeSlice:evidence,releaseReady:false}));return evidence;
 }catch(error){let msg=String(error.message);for(const s of [secret,anon,service])if(s)msg=msg.split(s).join('[synthetic secret]');runFailure=redact(msg.slice(0,1000));throw Error(runFailure);}
 finally{const summaries=[];for(const record of resources.records.filter(x=>x.kind==='container')){try{const x=JSON.parse(docker(['inspect',record.id]))[0];summaries.push({id:x.Id,name:x.Name,image:x.Image,state:x.State.Status,exitCode:x.State.ExitCode,oom:x.State.OOMKilled,memory:x.HostConfig.Memory,ports:x.HostConfig.PortBindings});writeFileSync(resolve(evidenceDir,record.id+'.log'),redact((()=>{const l=spawnSync('docker',['logs','--tail','60',record.id],{encoding:'utf8',timeout:5000,maxBuffer:1024*1024});return (l.stdout??'')+(l.stderr??'');})()),{mode:0o600});}catch{}}writeFileSync(resolve(evidenceDir,'containers.json'),JSON.stringify({failure:runFailure,containers:summaries},null,2)+'\n',{mode:0o600});if(browser)await browser.close().catch(()=>{});let childCleanup=true;for(const child of children){if(child.exitCode===null&&child.signalCode===null){child.kill('SIGTERM');await Promise.race([new Promise(r=>child.once('exit',r)),new Promise(r=>setTimeout(r,2000))]);if(child.exitCode===null&&child.signalCode===null){childCleanup=false;console.error('Own preview process did not exit; preserved stage for review');}}}const cleaned=await resources.cleanup(async args=>docker(args));writeFileSync(resolve(evidenceDir,'cleanup.json'),JSON.stringify(cleaned,null,2)+'\n',{mode:0o600});if(!cleaned.removed)console.error('Synthetic cleanup incomplete; inspect tracked exact IDs without broad cleanup');let snapshotClean=true;if(snapshotCreated&&childCleanup){try{const fs=await import('node:fs');const link=resolve(snapshotRoot,'node_modules');if(fs.lstatSync(link).isSymbolicLink()&&fs.readlinkSync(link)===resolve(projectRoot,'node_modules'))fs.unlinkSync(link);execFileSync('git',['worktree','remove',snapshotRoot],{cwd:projectRoot,stdio:['ignore','pipe','pipe'],timeout:30000});}catch{snapshotClean=false;console.error('Preserved source snapshot: cleanup requires review');}}if(stageCreated&&cleaned.removed&&snapshotClean&&childCleanup)rmSync(c.stage,{recursive:true});process.removeListener('unhandledRejection',onUnhandled);}
}
if(process.argv[1]&&import.meta.url===new URL('file://'+resolve(process.argv[1])).href){if(process.argv.length!==4||process.argv[2]!=='--plan')throw Error('Only --plan RUN is exposed; no execute CLI until source review complete');console.log(JSON.stringify(runtimePlan(process.argv[3])));}
