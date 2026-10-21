import {spawn, execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, mkdtempSync, chmodSync, readFileSync, writeFileSync, openSync, closeSync, rmSync} from 'node:fs';
import {resolve, dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash, createHmac, randomUUID} from 'node:crypto';
import {setTimeout} from 'node:timers/promises';
import {prepareTestLabBackend} from './prepare-test-lab-backend.mjs';
import {prepareLocalTestFunctions} from './prepare-local-test-functions.mjs';

// An isolated disposable lab, never a hosted project or production deployment.
// The compact stack avoids the full Supabase Postgres image's vfs disk limit.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workdir = resolve(root, '..', '.local-test-backend');
const runtimeFile = '/tmp/ig-local-runtime.json';
const stateFile = join(workdir, '.local-services.json');
const network = 'ig-local-test-site';
const label = 'com.imperialgames.local-test-site';
const names = {db:'supabase_db_qonqemhljgxlwpghkxhn',auth:'ig-local-site-auth',rest:'ig-local-site-rest',storage:'ig-local-site-storage',functions:'ig-local-site-functions',kong:'ig-local-site-kong'};
const dockerEnv = {...process.env, BUILDX_CONFIG:process.env.BUILDX_CONFIG || resolve(root, '..', '.docker-buildx')};
for(const key of ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH'])delete dockerEnv[key];
const action = process.argv[2] || 'start';
if (!['start','stop','status','dev','build'].includes(action) || process.argv.length > 3) throw Error('Usage: node scripts/local-test-site.mjs [start|stop|status|dev|build]');
const read = path => readFileSync(join(root,path),'utf8');
const manifestHash = () => createHash('sha256').update(read('supabase/backend-manifest.json')).update(read('supabase/test-lab-poker-candidates.json')).update(read('scripts/prepare-local-test-functions.mjs')).update(read('scripts/local-test-site.mjs')).digest('hex');
function docker(args, options={}) {
 try {return execFileSync('docker',['--host=unix:///var/run/docker.sock',...args],{env:dockerEnv,encoding:'utf8',stdio:['pipe','pipe','pipe'],maxBuffer:16*1024*1024,...options});}
 catch {throw Error(`Local Docker ${args[0]} failed. Inspect local container logs without sharing credentials.`);}
}
function inspect(name) {
 try {return JSON.parse(docker(['inspect',name]))[0];} catch {return null;}
}
function requireOwned(name) {
 const item=inspect(name);
 if (item && item.Config.Labels?.[label] !== '1') throw Error(`Refusing to change an existing container outside this local lab: ${name}`);
 return item;
}
function launch(name,alias,args) {
 requireOwned(name);
 docker(['run','-d','--name',name,'--label',`${label}=1`,'--network',network,'--network-alias',alias,...args]);
}
const sql = source => docker(['exec','-i',names.db,'psql','-h','127.0.0.1','-U','postgres','-d','postgres','-X','-q','-v','ON_ERROR_STOP=1'],{input:source});
async function waitFor(check,description) {
 for(let i=0;i<120;i++){try {if(await check())return;}catch{} await setTimeout(500);}
 throw Error(`Local ${description} did not become ready. Check its local Docker log.`);
}
async function healthy(url) {
 try {return (await fetch(url,{signal:AbortSignal.timeout(3000)})).ok;}catch{return false;}
}
function saveConnection(state) {
 const data={API_URL:'http://127.0.0.1:54321',ANON_KEY:state.anonKey,SERVICE_ROLE_KEY:state.serviceKey};
 writeFileSync(runtimeFile,JSON.stringify(data),{mode:0o600});
 writeFileSync(join(root,'.env.test.local'),`VITE_SUPABASE_URL=${data.API_URL}\nVITE_SUPABASE_PUBLISHABLE_KEY=${data.ANON_KEY}\nVITE_ENABLE_LEGACY_EDGE_FUNCTIONS=false\n`,{mode:0o600});
 return data;
}
async function functionReady(data) {
 try {
  const response=await fetch(data.API_URL+'/functions/v1/ig-support-v1',{method:'POST',headers:{apikey:data.ANON_KEY,authorization:'Bearer '+data.ANON_KEY,'content-type':'application/json'},body:JSON.stringify({action:'mine'}),signal:AbortSignal.timeout(3000)});
  return response.status===401 && (await response.json()).error==='Invalid session';
 }catch{return false;}
}
function localState() {
 if(!existsSync(stateFile))throw Error('Start the local tester backend first.');
 const state=JSON.parse(readFileSync(stateFile,'utf8'));
 if(state.source!==root)throw Error('Local backend belongs to another checkout.');
 return state;
}
function verifyPackage() {
 const output=mkdtempSync(join(workdir,'candidate-'));
 prepareTestLabBackend({output});
 return {directory:output,...JSON.parse(readFileSync(join(output,'test-lab-backend-report.json'),'utf8'))};
}
function buildDatabase() {
 try{docker(['image','inspect','ig-local-postgres-cron']);return;}catch{}
 const dockerfile=join(workdir,'Postgres.Dockerfile');
 // A read-only combined CA bundle preserves TLS and Alpine package signatures.
 const source=read('tests/database/Dockerfile').replace('RUN apk add --no-cache build-base','RUN --mount=type=secret,id=proxy_ca,target=/etc/ssl/cert.pem,required=true apk add --no-cache build-base');
 writeFileSync(dockerfile,'# syntax=docker/dockerfile:1\n'+source);
 const output=openSync('/tmp/ig-local-postgres-build.log','a',0o600);
 try{docker(['build','--secret','id=proxy_ca,src=/etc/ssl/certs/ca-certificates.crt','-t','ig-local-postgres-cron','-f',dockerfile,join(root,'tests/database')],{stdio:['ignore',output,output]});}
 finally{closeSync(output);}
}
function workerSource(manifest) {
 return `const verified = ${JSON.stringify(manifest.functions.filter(fn=>fn.verify_jwt).map(fn=>fn.name))};
const allowed = ${JSON.stringify(manifest.functions.map(fn=>fn.name))};
async function validJwt(token) {
 try {
  const pieces=token.split('.');if(pieces.length!==3)return false;
  const decode=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
  const header=JSON.parse(new TextDecoder().decode(decode(pieces[0])));
  const payload=JSON.parse(new TextDecoder().decode(decode(pieces[1])));
  if(header.alg!=='HS256'||!Number.isFinite(payload.exp)||payload.exp*1000<=Date.now())return false;
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(Deno.env.get('SUPABASE_JWT_SECRET')), {name:'HMAC',hash:'SHA-256'},false,['verify']);
  return await crypto.subtle.verify('HMAC',key,decode(pieces[2]),new TextEncoder().encode(pieces[0]+'.'+pieces[1]));
 }catch{return false;}
}
Deno.serve(async req=>{
 const name=new URL(req.url).pathname.split('/')[1];
 if(!allowed.includes(name))return Response.json({error:'Function not found'},{status:404});
 if(req.method!=='OPTIONS' && verified.includes(name) && !await validJwt((req.headers.get('authorization')||'').replace(/^Bearer /i,'')))return Response.json({error:'Invalid JWT'},{status:401,headers:{'Access-Control-Allow-Origin':'*'}});
 try {
  const worker=await EdgeRuntime.userWorkers.create({servicePath:'/home/deno/functions/'+name,memoryLimitMb:256,workerTimeoutMs:60000,noModuleCache:false,envVars:Object.entries(Deno.env.toObject())});
  return await worker.fetch(req);
 }catch{return Response.json({error:'Local practice function unavailable'},{status:503,headers:{'Access-Control-Allow-Origin':'*'}});}
});\n`;
}
function gatewaySource() {
 const services=[['auth','http://auth:9999/','/auth/v1'],['rest','http://rest:3000/','/rest/v1'],['storage','http://storage:5000/','/storage/v1'],['functions','http://functions:9000/','/functions/v1']];
 return '_format_version: "2.1"\n_transform: true\nservices:\n'+services.map(([name,url,path])=>`  - name: ${name}\n    url: ${url}\n    routes:\n      - name: ${name}\n        paths: ["${path}"]\n        strip_path: true\n    plugins:\n      - name: cors\n        config:\n          origins: ["*"]\n          methods: [GET, POST, PUT, PATCH, DELETE, OPTIONS]\n          headers: [Authorization, apikey, Accept, Accept-Profile, Content-Profile, Prefer, Range, Content-Type, x-client-info, x-supabase-api-version, x-upsert]\n          exposed_headers: [Content-Range, Range, Content-Type]\n          credentials: false\n          max_age: 3600\n`).join('');
}
async function start() {
 for(const name of Object.values(names))requireOwned(name);
 if(existsSync(stateFile) && inspect(names.db)?.State.Running){
  const state=localState();
  if(state.manifest!==manifestHash())throw Error('Reviewed sources changed. Stop and restart this disposable local lab to replay the new package.');
  const data=saveConnection(state);
  await waitFor(()=>functionReady(data),'authenticated practice runtime');
  console.log('The local tester backend is already running.');return;
 }
 if(Object.values(names).some(name=>inspect(name)))throw Error('A previous local lab is incomplete. Run stop before starting a fresh disposable lab.');
 mkdirSync(workdir,{recursive:true});
 const manifest=verifyPackage();
 buildDatabase();
 const existingNetwork=(()=>{try{return JSON.parse(docker(['network','inspect',network]))[0];}catch{return null;}})();
 if(existingNetwork && existingNetwork.Labels?.[label]!=='1')throw Error('Refusing to join a network outside this local lab');
 if(!existingNetwork)docker(['network','create','--label',`${label}=1`,network]);
 const secret=randomUUID()+randomUUID();
 const sign=role=>{const h=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');const b=Buffer.from(JSON.stringify({role,iss:'supabase',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+7*86400})).toString('base64url');return `${h}.${b}.${createHmac('sha256',secret).update(`${h}.${b}`).digest('base64url')}`;};
 const state={source:root,manifest:manifestHash(),anonKey:sign('anon'),serviceKey:sign('service_role')};
 const localEnv=['-e','NO_PROXY=kong,auth,rest,storage,functions,db,127.0.0.1,localhost','-e','no_proxy=kong,auth,rest,storage,functions,db,127.0.0.1,localhost'];
 const boot=read('tests/database/bootstrap.sql');
 launch(names.db,'db',['--tmpfs','/var/lib/postgresql/data','-e','POSTGRES_HOST_AUTH_METHOD=trust','ig-local-postgres-cron','-c','shared_preload_libraries=pg_cron','-c','cron.database_name=postgres','-c','cron.launch_active_jobs=off']);
 await waitFor(()=>{docker(['exec',names.db,'pg_isready','-h','127.0.0.1','-U','postgres']);return true;},'Postgres');
 sql(boot.replace(/^create table auth\.users.*\n/m,'').replace(/^create function auth\..*\n/gm,'').replace(/^.*storage\.(buckets|objects|foldername).*\n/gm,'')+`
 create role supabase_auth_admin login; alter schema auth owner to supabase_auth_admin;
 alter role supabase_auth_admin set search_path=auth,extensions,public; grant usage on schema public,extensions to supabase_auth_admin;
 create role authenticator login noinherit; grant anon,authenticated,service_role to authenticator;
 create role supabase_storage_admin login noinherit bypassrls; alter schema storage owner to supabase_storage_admin;
 alter role supabase_storage_admin set search_path=storage,public,extensions;
 grant usage on schema auth,public,extensions to supabase_storage_admin; grant anon,authenticated,service_role to supabase_storage_admin;`);
 launch(names.auth,'auth',[...localEnv,'-e','GOTRUE_API_HOST=0.0.0.0','-e','GOTRUE_API_PORT=9999','-e','API_EXTERNAL_URL=http://127.0.0.1:54321','-e','GOTRUE_SITE_URL=http://127.0.0.1:4173','-e','GOTRUE_URI_ALLOW_LIST=http://127.0.0.1:4173/ResetPassword,http://127.0.0.1:5173/ResetPassword','-e','GOTRUE_DB_DRIVER=postgres','-e','GOTRUE_DB_DATABASE_URL=postgres://supabase_auth_admin@db:5432/postgres','-e',`GOTRUE_JWT_SECRET=${secret}`,'-e','GOTRUE_JWT_AUD=authenticated','-e','GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated','-e','GOTRUE_JWT_ADMIN_ROLES=service_role','-e','GOTRUE_EXTERNAL_EMAIL_ENABLED=true','-e','GOTRUE_MAILER_AUTOCONFIRM=true','-e','GOTRUE_MAILER_URLPATHS_RECOVERY=/auth/v1/verify','-e','GOTRUE_MAILER_URLPATHS_CONFIRMATION=/auth/v1/verify','-e','GOTRUE_MAILER_URLPATHS_INVITE=/auth/v1/verify','-e','GOTRUE_MAILER_URLPATHS_EMAIL_CHANGE=/auth/v1/verify','supabase/gotrue:v2.197.0@sha256:1736a63078f5922b198c4cbe50f80ab9a2d3b54fe8b7b6cfb2e9dc5dbbc12c6b']);
 await waitFor(()=>{const count=sql("select count(*) from information_schema.tables where table_schema='auth' and table_name='users';").trim();return count.split('\n').some(line=>line.trim()==='1');},'Auth schema');
 sql(boot.split('\n').filter(line=>line.startsWith('create function auth.')).map(line=>line.replace('create function','create or replace function')).join('\n'));
 launch(names.storage,'storage',[...localEnv,'--tmpfs','/var/lib/storage:mode=1777','-e',`ANON_KEY=${state.anonKey}`,'-e',`SERVICE_KEY=${state.serviceKey}`,'-e',`AUTH_JWT_SECRET=${secret}`,'-e','DATABASE_URL=postgres://supabase_storage_admin@db:5432/postgres','-e','POSTGREST_URL=http://rest:3000','-e','STORAGE_PUBLIC_URL=http://127.0.0.1:54321/storage/v1','-e','STORAGE_BACKEND=file','-e','FILE_STORAGE_BACKEND_PATH=/var/lib/storage','-e','FILE_SIZE_LIMIT=52428800','-e','GLOBAL_S3_BUCKET=local','-e','TENANT_ID=local','-e','REGION=local','-e','ENABLE_IMAGE_TRANSFORMATION=false','supabase/storage-api:v1.81.0@sha256:98ffec5d0678803783c30e404c27f4ec65e97efbe014088f2a86b4b8b54b9f54']);
 await waitFor(()=>sql("select count(*) from information_schema.tables where table_schema='storage' and table_name='objects';").split('\n').some(line=>line.trim()==='1'),'Storage schema');
 for(const migration of [...manifest.migrations].sort((a,b)=>a.path.localeCompare(b.path)))sql('begin;\n'+readFileSync(join(manifest.directory,migration.path),'utf8')+'\ncommit;');
 console.log(`Replayed ${manifest.migrations.length} generated tester-candidate migrations (reviewed history plus pending poker fixes); ${manifest.functions.length} authenticated practice handlers. Scheduled jobs are disabled locally.`);
 launch(names.rest,'rest',[...localEnv,'-e','PGRST_DB_URI=postgres://authenticator@db:5432/postgres','-e','PGRST_DB_SCHEMAS=public','-e','PGRST_DB_ANON_ROLE=anon','-e',`PGRST_JWT_SECRET=${secret}`,'postgrest/postgrest:v14.18@sha256:c7cd7e265a85b05248abf53f4473fcec7e327c282d0bd0cf60f1551996d09fcf']);
 const functionsDir=join(manifest.directory,'local-functions');
 prepareLocalTestFunctions({candidateDirectory:manifest.directory,output:functionsDir});
 const mainDir=join(workdir,'main');mkdirSync(mainDir,{recursive:true});writeFileSync(join(mainDir,'index.ts'),workerSource(manifest));
 const kongFile=join(workdir,'kong.yml');writeFileSync(kongFile,gatewaySource());chmodSync(kongFile,0o644);
 launch(names.functions,'functions',[...localEnv,'--mount',`type=bind,src=${functionsDir},dst=/home/deno/functions,readonly`,'--mount',`type=bind,src=${mainDir},dst=/home/deno/main,readonly`,'--mount','type=bind,src=/etc/ssl/certs/ca-certificates.crt,dst=/run/local-ca.pem,readonly','--mount','type=bind,src=/etc/ssl/certs/ca-certificates.crt,dst=/etc/ssl/certs/ca-certificates.crt,readonly','-e','DENO_CERT=/run/local-ca.pem','-e','DENO_TLS_CA_STORE=system','-e','SSL_CERT_FILE=/run/local-ca.pem','-e','SUPABASE_URL=http://kong:8000','-e',`SUPABASE_ANON_KEY=${state.anonKey}`,'-e',`SUPABASE_SERVICE_ROLE_KEY=${state.serviceKey}`,'-e',`SUPABASE_JWT_SECRET=${secret}`,'-e','IG_LOCAL_PRACTICE=true','public.ecr.aws/supabase/edge-runtime@sha256:ad45164b7548bf5820ed7be714789c17ac2865edce79a09cfb4c3756c3d365a8','start','--main-service','/home/deno/main']);
 launch(names.kong,'kong',[...localEnv,'-p','127.0.0.1:54321:8000','--mount',`type=bind,src=${kongFile},dst=/var/lib/kong/kong.yml,readonly`,'-e','KONG_DATABASE=off','-e','KONG_DECLARATIVE_CONFIG=/var/lib/kong/kong.yml','-e','KONG_PLUGINS=bundled','-e','KONG_PROXY_LISTEN=0.0.0.0:8000','-e','KONG_ADMIN_LISTEN=off','public.ecr.aws/supabase/kong@sha256:1b53405d8680a09d6f44494b7990bf7da2ea43f84a258c59717d4539abf09f6d']);
 writeFileSync(stateFile,JSON.stringify(state),{mode:0o600});
 const data=saveConnection(state);
 await waitFor(()=>healthy(data.API_URL+'/auth/v1/health'),'Auth API');
 await waitFor(()=>functionReady(data),'authenticated practice runtime');
 console.log('Local Auth, Storage, REST and authenticated Edge Runtime are ready. Local signup auto-confirms disposable accounts; no financial wallets are funded.');
}
if(action==='stop'){
 for(const name of Object.values(names))requireOwned(name);
 for(const name of Object.values(names).reverse())if(inspect(name))docker(['rm','-fv',name]);
 try{docker(['network','rm',network]);}catch{}
 rmSync(stateFile,{force:true});rmSync(runtimeFile,{force:true});rmSync(join(root,'.env.test.local'),{force:true});
 console.log('Stopped the local lab and discarded its disposable accounts, game state and files.');
}else if(action==='status'){
 const data=saveConnection(localState());const ready=await healthy(data.API_URL+'/auth/v1/health') && await functionReady(data);
 console.log(ready?'Local Auth and authenticated practice functions are ready.':'The local backend is not ready.');if(!ready)process.exitCode=1;
}else if(action==='dev'||action==='build'){
 const data=saveConnection(localState());if(!await functionReady(data))throw Error('Start the local tester backend before its frontend.');
 const args=action==='build'?['build','--mode','test']:['--mode','test','--host','127.0.0.1','--port','5173','--strictPort'];
 const localEnv={...process.env,VITE_SUPABASE_URL:data.API_URL,VITE_SUPABASE_PUBLISHABLE_KEY:data.ANON_KEY,VITE_SUPABASE_ANON_KEY:data.ANON_KEY,VITE_ENABLE_LEGACY_EDGE_FUNCTIONS:'false'};
 const child=spawn(process.execPath,[join(root,'node_modules/vite/bin/vite.js'),...args],{cwd:root,env:localEnv,stdio:'inherit'});
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));child.on('exit',(code,signal)=>{process.exitCode=Number.isInteger(code)?code:signal==='SIGINT'?130:143;});
 child.on('error',()=>{console.error('Local frontend process could not start.');process.exitCode=1;});
}else{await start();}
