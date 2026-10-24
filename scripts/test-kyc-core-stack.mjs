import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync,writeFileSync,mkdtempSync,mkdirSync,copyFileSync,rmSync } from 'node:fs';
import {tmpdir} from 'node:os';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
import { randomUUID, createHmac } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout } from 'node:timers/promises';

// No remote target or credentials accepted. All users/services are disposable.
if (process.argv.length !== 2) throw new Error('Usage: node scripts/test-kyc-core-stack.mjs');
const root = resolve(dirname(fileURLToPath(import.meta.url)),'..');
const stage=mkdtempSync(resolve(tmpdir(),'ig-kyc-core-'));
const prefix = `ig-kyc-core-${randomUUID()}`;
const network = prefix;
const db = prefix+'-db', auth = prefix + '-auth', rest = prefix + '-rest', storage = prefix + '-storage';
const withStorage=true;
const secret = randomUUID() + randomUUID();
const sign = role => {
 const header=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
 const body=Buffer.from(JSON.stringify({role,iss:'supabase',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');
 return `${header}.${body}.${createHmac('sha256',secret).update(`${header}.${body}`).digest('base64url')}`;
};
const anonKey=sign('anon'),serviceKey=sign('service_role');
const created = [];
const docker = (args, options={}) => execFileSync('docker', args, { encoding:'utf8', stdio:['pipe','pipe','pipe'], ...options });
const sql = input => docker(['exec','-i',db,'psql','-h','127.0.0.1','-U','postgres','-X','-q','-v','ON_ERROR_STOP=1'],{input});
const read = path => readFileSync(resolve(root,path),'utf8');
function run(name,args) { created.push(name);docker(['run','-d','--name',name,'--network',network,...args]); }
const port = (name,port) => 'http://' + docker(['port',name,`${port}/tcp`]).trim();
async function ready(check) {
 for(let i=0;i<100;i++){try{if(await check())return;}catch{} await setTimeout(300);}
 throw new Error('Local service did not become ready');
}
async function fetchWithDeadline(url, options={}) {
 // A referenced timer keeps Node alive while a cold local Docker endpoint has
 // no active socket. AbortSignal.timeout uses an unreferenced timer and could
 // end CI with an unsettled top-level await before readiness was evaluated.
 const controller=new AbortController();
 const deadline=globalThis.setTimeout(()=>controller.abort(),10000);
 try { return await fetch(url,{...options,signal:controller.signal}); }
 finally { globalThis.clearTimeout(deadline); }
}
async function request(origin,path,{token,body,method}={}) {
 assert.equal(new URL(origin).hostname,'127.0.0.1');
 const r=await fetchWithDeadline(origin+path,{method:method || (body ? 'POST':'GET'),headers:{...(token?{Authorization:`Bearer ${token}`} : {}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const text=await r.text(); let data;try{data=JSON.parse(text);}catch{data=text;}
 return {status:r.status,data};
}
let net=false, storageOrigin;
try {
 mkdirSync(stage+'/application-main');mkdirSync(stage+'/application');mkdirSync(stage+'/raster');
 copyFileSync(resolve(root,'tests/privacy-runtime/main.ts'),stage+'/application-main/index.ts');
 copyFileSync(resolve(root,'tests/privacy-runtime/gateway.mjs'),stage+'/gateway.mjs');
 for(const [entry,out] of [['supabase/functions/ig-kyc-v1/index.ts','application'],['tests/privacy-runtime/raster.ts','raster']])await build({entryPoints:[resolve(root,entry)],outfile:stage+'/'+out+'/index.js',bundle:true,platform:'browser',format:'esm',plugins:[{name:'locked-npm',setup(b){b.onResolve({filter:/^npm:/},a=>({path:require.resolve(a.path.replace(/^npm:/,'').replace(/@\d.*$/,''))}));}}]});
 // Docker suppresses host port publication for --internal networks. Use a
 // dedicated bridge, publish API ports on loopback only, and never publish DB.
 docker(['network','create',network]);net=true;
 run(db,['--network-alias','db','--tmpfs','/var/lib/postgresql/data','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17@sha256:b8faeff7712663c2773a190181e1246e37e364b887611c04658c28b44e2408fe']);
 await ready(()=>{docker(['exec',db,'pg_isready','-h','127.0.0.1','-U','postgres']);return true;});
 const bootstrap = read('tests/database/bootstrap.sql');
 let initial=bootstrap.replace(/^create table auth\.(users|mfa_factors).*\n/gm,'').replace(/^create function auth\..*\n/gm,'');
 if(withStorage)initial=initial.replace(/^.*storage\.(buckets|objects|foldername).*\n/gm,'');
 sql(initial+`
 create role supabase_auth_admin login;
 alter schema auth owner to supabase_auth_admin;
 alter role supabase_auth_admin set search_path=auth,extensions,public;
 grant usage on schema public,extensions to supabase_auth_admin;
 create role authenticator login noinherit;
 grant anon,authenticated,service_role to authenticator;
 `);
 if(withStorage)sql(`create role supabase_storage_admin login noinherit bypassrls;
 alter schema storage owner to supabase_storage_admin;
 alter role supabase_storage_admin set search_path=storage,public,extensions;
 grant usage on schema auth,public,extensions to supabase_storage_admin;
 grant anon,authenticated,service_role to supabase_storage_admin;`);
 run(auth,['--network-alias','auth','-p','127.0.0.1::9999',
 '-e','GOTRUE_API_HOST=0.0.0.0','-e','GOTRUE_API_PORT=9999',
 '-e','API_EXTERNAL_URL=http://127.0.0.1:9999','-e','GOTRUE_SITE_URL=http://127.0.0.1',
 '-e','GOTRUE_DB_DRIVER=postgres','-e','GOTRUE_DB_DATABASE_URL=postgres://supabase_auth_admin@db:5432/postgres',
 '-e',`GOTRUE_JWT_SECRET=${secret}`,'-e','GOTRUE_JWT_AUD=authenticated',
 '-e','GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated','-e','GOTRUE_JWT_ADMIN_ROLES=service_role',
 '-e','GOTRUE_EXTERNAL_EMAIL_ENABLED=true','-e','GOTRUE_MAILER_AUTOCONFIRM=true',
 'supabase/gotrue:v2.197.0@sha256:1736a63078f5922b198c4cbe50f80ab9a2d3b54fe8b7b6cfb2e9dc5dbbc12c6b']);
 const authOrigin=port(auth,9999);
 await ready(async()=> (await request(authOrigin,'/health')).status===200);
 // GoTrue owns its Auth schema; apply the API claim helpers only after its
 // migrations, so startup can create/replace its own legacy helper functions.
 sql(bootstrap.split('\n').filter(line=>line.startsWith('create function auth.')).map(line=>line.replace('create function','create or replace function')).join('\n'));
 if(withStorage){
  run(storage,['--network-alias','storage','-p','127.0.0.1::5000','--tmpfs','/var/lib/storage:mode=1777',
   '-e',`ANON_KEY=${anonKey}`,'-e',`SERVICE_KEY=${serviceKey}`,'-e',`AUTH_JWT_SECRET=${secret}`,
   '-e','DATABASE_URL=postgres://supabase_storage_admin@db:5432/postgres','-e','POSTGREST_URL=http://rest:3000',
   '-e','STORAGE_PUBLIC_URL=http://127.0.0.1','-e','STORAGE_BACKEND=file','-e','FILE_STORAGE_BACKEND_PATH=/var/lib/storage',
   '-e','FILE_SIZE_LIMIT=52428800','-e','GLOBAL_S3_BUCKET=local','-e','TENANT_ID=local','-e','REGION=local',
   '-e','ENABLE_IMAGE_TRANSFORMATION=false',
   'supabase/storage-api:v1.82.1@sha256:ec2ad41411eac8fc2b769b4bb00d1af32ae37eca3745c15bdb329db27d218934']);
  storageOrigin=port(storage,5000);
  await ready(async()=> (await request(storageOrigin,'/status')).status===200);
 }
 sql(`create table public.profiles(id uuid primary key references auth.users(id),is_excluded boolean default false,kyc_status text default 'not_started');
 create table public.user_roles(user_id uuid primary key references auth.users(id),role text);
 create table public.kyc_verifications(user_id uuid primary key references auth.users(id),provider text,external_session_id text unique,status text,document_verified boolean,selfie_verified boolean,provider_updated_at timestamptz,updated_at timestamptz);
 grant all on public.profiles,public.user_roles,public.kyc_verifications to service_role;
 `);
 sql(read('supabase/migrations/20261022153018_secure_kyc_intake_review.sql'));
 sql(read('supabase/migrations/20261022210709_kyc_profile_lifecycle.sql'));
 sql(read('supabase/migrations/20261022212136_kyc_retention_reconciliation.sql'));
 sql(read('supabase/migrations/20261023164745_kyc_retention_fair_retry.sql'));
 run(rest,['--network-alias','rest','-p','127.0.0.1::3000','-e','PGRST_DB_URI=postgres://authenticator@db:5432/postgres',
 '-e','PGRST_DB_SCHEMAS=public','-e','PGRST_DB_ANON_ROLE=anon','-e',`PGRST_JWT_SECRET=${secret}`,
 'postgrest/postgrest:v16.4@sha256:d155c6718ed9a9f990d159a2ab7c0a3f16944dbb6d0a0344557421042acfe0df']);
 const restOrigin=port(rest,3000);
 await ready(async()=> (await request(restOrigin,'/')).status===200);

 run(prefix+'-gateway',['--network-alias','kong','-p','127.0.0.1:54321:8000','-v',process.execPath+':/node:ro','-v',stage+'/gateway.mjs:/gateway.mjs:ro','postgres:17@sha256:b8faeff7712663c2773a190181e1246e37e364b887611c04658c28b44e2408fe','/node','/gateway.mjs']);
 writeFileSync(stage+'/local-info.json',JSON.stringify({ANON_KEY:anonKey,SERVICE_ROLE_KEY:serviceKey}),{mode:0o600});
 run(prefix+'-edge',['--network-alias','edge','-e','NO_PROXY=kong,auth,rest,storage,edge,localhost,127.0.0.1','-v',stage+':/probe:ro','supabase/edge-runtime:v1.77.4@sha256:ad45164b7548bf5820ed7be714789c17ac2865edce79a09cfb4c3756c3d365a8','start','--main-service','/probe/application-main','--port','9000']);
 writeFileSync(stage+'/runtime-info.json',JSON.stringify({DB_CONTAINER:db,API_URL:'http://127.0.0.1:54321',ANON_KEY:anonKey,SERVICE_ROLE_KEY:serviceKey,JWT_SECRET:secret}),{mode:0o600});
 await ready(async()=> (await fetchWithDeadline('http://127.0.0.1:54321/functions/v1/health')).status===200);
 console.log('PASS core local Auth/Storage/PostgREST startup, four KYC migrations, isolated fixture schemas; no full platform replay');
 for(const [script,arg] of [['test-kyc-local-runtime.mjs',stage+'/runtime-info.json'],['test-kyc-edge-resources.mjs','http://127.0.0.1:54321']]){const r=spawnSync(process.execPath,[resolve(root,'scripts',script),arg],{stdio:'inherit',timeout:180000});assert.equal(r.status,0,script);}
}catch(error){let message=error.message;for(const value of [secret,anonKey,serviceKey])message=message.split(value).join('[local fixture credential]');console.error(message);process.exitCode=1;}finally{for(const name of created.reverse()){try{docker(['rm','-fv',name]);}catch{}}if(net){try{docker(['network','rm',network]);}catch{}}rmSync(stage,{recursive:true,force:true});}
