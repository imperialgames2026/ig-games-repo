import assert from 'node:assert/strict';
import { execFileSync, spawnSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { randomUUID, createHash, createHmac } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout } from 'node:timers/promises';

// No remote target or credentials accepted. All users/services are disposable.
if (process.argv.length !== 2) throw new Error('Usage: node scripts/test-local-auth.mjs');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const prefix = `ig-auth-test-${randomUUID()}`;
const network = prefix;
const db = prefix + '-db', auth = prefix + '-auth', rest = prefix + '-rest', storage = prefix + '-storage';
const withStorage=process.env.IG_LOCAL_STORAGE === '1';
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
function run(name,args) { docker(['run','-d','--name',name,'--network',network,...args]); created.push(name); }
const port = (name,port) => 'http://' + docker(['port',name,`${port}/tcp`]).trim();
async function ready(check) {
 for(let i=0;i<100;i++){try{if(await check())return;}catch{} await setTimeout(300);}
 throw new Error('Local service did not become ready');
}
async function request(origin,path,{token,body,method}={}) {
 assert.equal(new URL(origin).hostname,'127.0.0.1');
 const r=await fetch(origin+path,{method:method || (body ? 'POST':'GET'),headers:{...(token?{Authorization:`Bearer ${token}`} : {}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(10000)});
 const text=await r.text(); let data;try{data=JSON.parse(text);}catch{data=text;}
 return {status:r.status,data};
}
let net=false, proxy, vite, browser, storageOrigin;
try {
 // Docker suppresses host port publication for --internal networks. Use a
 // dedicated bridge, publish API ports on loopback only, and never publish DB.
 docker(['network','create',network]);net=true;
 run(db,['--network-alias','db','--tmpfs','/var/lib/postgresql/data','-e','POSTGRES_HOST_AUTH_METHOD=trust','ig-local-postgres-cron','-c','shared_preload_libraries=pg_cron','-c','cron.database_name=postgres','-c','cron.launch_active_jobs=off']);
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
 run(auth,['-p','127.0.0.1::9999',
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
  run(storage,['-p','127.0.0.1::5000','--tmpfs','/var/lib/storage:mode=1777',
   '-e',`ANON_KEY=${anonKey}`,'-e',`SERVICE_KEY=${serviceKey}`,'-e',`AUTH_JWT_SECRET=${secret}`,
   '-e','DATABASE_URL=postgres://supabase_storage_admin@db:5432/postgres','-e','POSTGREST_URL=http://rest:3000',
   '-e','STORAGE_PUBLIC_URL=http://127.0.0.1','-e','STORAGE_BACKEND=file','-e','FILE_STORAGE_BACKEND_PATH=/var/lib/storage',
   '-e','FILE_SIZE_LIMIT=52428800','-e','GLOBAL_S3_BUCKET=local','-e','TENANT_ID=local','-e','REGION=local',
   '-e','ENABLE_IMAGE_TRANSFORMATION=false',
   'supabase/storage-api:v1.81.0@sha256:98ffec5d0678803783c30e404c27f4ec65e97efbe014088f2a86b4b8b54b9f54']);
  storageOrigin=port(storage,5000);
  await ready(async()=> (await request(storageOrigin,'/status')).status===200);
 }
 const manifest=JSON.parse(read('supabase/backend-manifest.json'));
 for(const m of [...manifest.migrations].sort((a,b)=>a.file.localeCompare(b.file))){
  assert.match(m.file,/^\d{14}_[a-zA-Z0-9_-]+\.sql$/);
  const content=read('supabase/deployed-migrations/'+m.file);
  assert.equal(createHash('sha256').update(content).digest('hex'),m.sha256);
  sql('begin;\n'+content+'\ncommit;');
 }
 console.log(`PASS: ${manifest.migrations.length} migrations replayed with real GoTrue Auth${withStorage?' and Storage API schemas':''}; cron execution disabled.`);
 run(rest,['--network-alias','rest','-p','127.0.0.1::3000','-e','PGRST_DB_URI=postgres://authenticator@db:5432/postgres',
 '-e','PGRST_DB_SCHEMAS=public','-e','PGRST_DB_ANON_ROLE=anon','-e',`PGRST_JWT_SECRET=${secret}`,
 'postgrest/postgrest:v14.18@sha256:c7cd7e265a85b05248abf53f4473fcec7e327c282d0bd0cf60f1551996d09fcf']);
 const restOrigin=port(rest,3000);
 await ready(async()=> (await request(restOrigin,'/')).status===200);
 const users=[];
 for(let i=0;i<2;i++){
  const email=`local-${randomUUID()}@example.invalid`,password=randomUUID();
  const signup=await request(authOrigin,'/signup',{body:{email,password,data:{role:'superadmin',full_name:'Local test user'}}});
  assert.equal(signup.status,200,JSON.stringify(signup.data));
  const login=await request(authOrigin,'/token?grant_type=password',{body:{email,password}});
  assert.equal(login.status,200,JSON.stringify(login.data));assert.ok(login.data.access_token);
  users.push({id:login.data.user.id,token:login.data.access_token,email,password});
 }
 console.log('PASS: two local users signed up and logged in through real Auth; email autoconfirm is local-only.');
 for(const user of users){
  const roles=await request(restOrigin,`/user_roles?user_id=eq.${user.id}&select=role`,{token:user.token});
  assert.equal(roles.status,200);assert.deepEqual(roles.data,[{role:'player'}]);
  const other=users.find(u=>u!==user);
  const hidden=await request(restOrigin,`/wallets?user_id=eq.${other.id}&select=user_id`,{token:user.token});
  assert.equal(hidden.status,200);assert.deepEqual(hidden.data,[]);
  const denied=await request(restOrigin,`/user_roles?user_id=eq.${user.id}`,{token:user.token,method:'PATCH',body:{role:'superadmin'}});
  assert.ok([401,403].includes(denied.status));
 }
 console.log('PASS: real JWT/PostgREST enforces canonical player roles, other-owner wallet isolation and denies role writes.');
 const saved=await request(restOrigin,`/profiles?id=eq.${users[0].id}`,{token:users[0].token,method:'PATCH',body:{full_name:'Saved Local Name'}});
 assert.equal(saved.status,204,JSON.stringify(saved.data));
 const profile=await request(restOrigin,`/profiles?id=eq.${users[0].id}&select=full_name`,{token:users[0].token});
 assert.deepEqual(profile.data,[{full_name:'Saved Local Name'}]);
 console.log('PASS: authenticated owner profile update is persisted through real REST.');
 if(withStorage){
  const {verifyStorageServices}=await import('../tests/database/storage-service-checks.mjs');
  await verifyStorageServices({origin:storageOrigin,users,serviceKey,sql});
 }
 if(process.env.IG_LOCAL_BROWSER === '1' || process.env.IG_LOCAL_EDGE === '1') {
  let functionRequests=0, functionRequestPaths=[];
  proxy=createServer(async(req,res)=>{
   res.setHeader('Access-Control-Allow-Origin','*');
   res.setHeader('Access-Control-Allow-Headers','authorization,apikey,content-type,x-client-info,x-supabase-api-version');
   res.setHeader('Access-Control-Allow-Methods','GET,POST,PATCH,DELETE,OPTIONS');
   if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
   const url=new URL(req.url,'http://127.0.0.1');
   if(url.pathname.startsWith('/functions/v1/')){functionRequests++;functionRequestPaths.push(url.pathname);}
   const prefix=url.pathname.startsWith('/auth/v1/')?'/auth/v1':url.pathname.startsWith('/rest/v1/')?'/rest/v1':null;
   if(!prefix){res.writeHead(404);res.end();return;}
   try {
    const chunks=[];for await(const chunk of req) chunks.push(chunk);
    const body=Buffer.concat(chunks);
    const response=await fetch((prefix==='/auth/v1'?authOrigin:restOrigin)+url.pathname.slice(prefix.length)+url.search,{
     method:req.method, headers:{...(req.headers.authorization?{authorization:req.headers.authorization}:{}),...(req.headers['content-type']?{'content-type':req.headers['content-type']}:{})},
     ...(body.length?{body}:{}),signal:AbortSignal.timeout(10000)});
    res.setHeader('Content-Type',response.headers.get('content-type') || 'application/json');res.writeHead(response.status);res.end(Buffer.from(await response.arrayBuffer()));
   } catch {res.writeHead(502);res.end();}
  });
  await new Promise(resolve=>proxy.listen(0,'127.0.0.1',resolve));
  const apiOrigin=`http://127.0.0.1:${proxy.address().port}`;
  if(process.env.IG_LOCAL_EDGE === '1') {
   const { verifyHandlerServices } = await import('../tests/database/handler-service-checks.mjs');
   await verifyHandlerServices({apiOrigin,anonKey,serviceKey,users,sql,read});
  }
  if(process.env.IG_LOCAL_BROWSER === '1') {
  const { chromium, expect } = await import('@playwright/test');
  const reservation=createServer();await new Promise(resolve=>reservation.listen(0,'127.0.0.1',resolve));
  const appPort=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));
  const appOrigin=`http://127.0.0.1:${appPort}`;
  vite=spawn(process.execPath,[resolve(root,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port',String(appPort),'--strictPort'],{
   cwd:root,stdio:'ignore',env:{...process.env,VITE_SUPABASE_URL:apiOrigin,VITE_SUPABASE_PUBLISHABLE_KEY:'local-test-publishable-key',VITE_ENABLE_LEGACY_EDGE_FUNCTIONS:'false'}});
  await ready(async()=> (await fetch(appOrigin)).status===200);
  browser=await chromium.launch({...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--no-sandbox']});
  const page=await browser.newPage();
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  await page.goto(appOrigin+'/Profile');
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('Email',{exact:true}).fill(users[0].email);
  await page.getByLabel('Password',{exact:true}).fill(users[0].password);
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page.getByPlaceholder('Enter your name')).toHaveValue('Saved Local Name',{timeout:15000});
  await page.reload();
  await expect(page.getByPlaceholder('Enter your name')).toHaveValue('Saved Local Name',{timeout:15000});
  await page.goto(appOrigin+'/AdminUsers');
  await expect(page).toHaveURL(appOrigin+'/',{timeout:15000});
  console.log('PASS: browser signs in against real local Auth/REST, restores its session on reload, and cannot enter the Superadmin user directory.');
  const legacyProbePath='/functions/v1/legacyReadProbe';
  const beforeLegacyProbe=functionRequestPaths.filter(path=>path===legacyProbePath).length;
  const blocked=await page.evaluate(async()=>{
   const {base44}=await import('/api/base44Client.js');
   try{await base44.functions.invoke('legacyReadProbe');return false;}
   catch(error){return error.message.includes('secure Supabase handler not verified');}
  });
  assert.equal(blocked,true);assert.equal(functionRequestPaths.filter(path=>path===legacyProbePath).length,beforeLegacyProbe);
  console.log('PASS: disabled legacy Base44 dispatch fails before any function HTTP request.');
  }
 }
} catch(error) {
 // Only startup errors are surfaced, never headers, JWTs or request bodies.
 for (const name of created) {
  try { const state = JSON.parse(docker(['inspect',name]))[0].State;
   if (state.Status === 'exited') {
    const logs=spawnSync('docker',['logs',name],{encoding:'utf8'});
    console.error(name.split('-').at(-1), 'startup exit', state.ExitCode,
     (logs.stdout+logs.stderr).split(secret).join('[redacted]').split('\n').filter(line=> /fatal|error/i.test(line) && !/access_token|refresh_token|authorization/i.test(line)).slice(-3).join('\n'));
   }
  } catch {}
 }
 console.error(error.message);process.exitCode=1;
} finally {
 if(browser)await browser.close();
 if(vite && vite.exitCode === null){vite.kill('SIGTERM');await new Promise(resolve=>vite.once('exit',resolve));}
 if(proxy)await new Promise(resolve=>proxy.close(resolve));
 for(const name of created.reverse()) {try{docker(['rm','-fv',name]);}catch{}}
 if(net)docker(['network','rm',network]);
}
