import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Execute response construction and auth denial in-process. This does not prove
// a browser preflight through a real HTTP gateway or real Supabase Auth.
for(const name of ['poker-events-v1','admin-poker-events']){
 test(name+' permits SDK preflight headers while preserving POST authentication',async()=>{
  let handler;let authClients=0;
  const source=readFileSync(new URL('../supabase/functions/'+name+'/index.ts',import.meta.url),'utf8');
  const compiled=ts.transpileModule(source.replace(/^import[^\n]*\n/,''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
  vm.runInNewContext(compiled,{Request,Response,console,createClient:()=>{authClients++;return {auth:{getUser:async()=>({data:{user:null},error:{message:'Synthetic invalid token'}})}};},Deno:{env:{get:()=> 'synthetic-setting'},serve:fn=>handler=fn}});
  const invoke=(method,headers={})=>handler(new Request('https://example.invalid/handler',{method,headers}));
  const cors=response=>{
   assert.equal(response.headers.get('access-control-allow-origin'),'*');
   assert.deepEqual(response.headers.get('access-control-allow-methods').split(',').map(x=>x.trim()),['POST','OPTIONS']);
   const allowed=new Set(response.headers.get('access-control-allow-headers').split(',').map(x=>x.trim().toLowerCase()));
   for(const header of ['authorization','apikey','content-type','x-client-info','x-supabase-api-version'])assert.ok(allowed.has(header),header);
   assert.equal(response.headers.get('cache-control'),'no-store');
  };
  const preflight=await invoke('OPTIONS',{'origin':'https://example.invalid','access-control-request-method':'POST','access-control-request-headers':'authorization,apikey,content-type,x-client-info,x-supabase-api-version'});
  assert.equal(preflight.status,200);cors(preflight);assert.equal(authClients,0);
  const unsigned=await invoke('POST');assert.equal(unsigned.status,401);cors(unsigned);assert.equal(authClients,0);
  const rejected=await invoke('POST',{authorization:'Bearer synthetic-invalid'});assert.equal(rejected.status,401);cors(rejected);assert.equal(authClients,1);
  const wrongMethod=await invoke('GET');assert.equal(wrongMethod.status,405);cors(wrongMethod);assert.equal(authClients,1);
 });
}
