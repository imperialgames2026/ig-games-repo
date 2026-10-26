import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
const source=readFileSync(new URL('../review/slots-parked/index.ts',import.meta.url),'utf8');
const original=readFileSync(new URL('../review/slots-parked/hosted-index.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source.replace(/^import[^\n]*\n/gm,''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
function harness({valid=true,anonymous=false,excluded=false,role='player',lookupError=false,url='https://qonqemhljgxlwpghkxhn.supabase.co'}={}){
 let serve;const calls=[];const actor='11111111-1111-4111-8111-111111111111';
 const db={from:table=>{calls.push(table);assert.ok(['profiles','user_roles'].includes(table),'no slot table access');const q={select:()=>q,eq:(key,value)=>{assert.equal(value,actor);return q;},maybeSingle:async()=>({data:table==='profiles'?{id:actor,is_excluded:excluded}:{role},error:lookupError?{}:null})};return q;},rpc:()=>{throw Error('No slot RPC permitted');}};
 const forbidden=()=>{throw Error('No gameplay evaluation permitted');};
 vm.runInNewContext(compiled,{createClient:(_url,key)=>key==='anon'?{auth:{getUser:async()=>({data:{user:valid?{id:actor,is_anonymous:anonymous}:null},error:valid?null:{}})}}:db,Response,Request,console,crypto:{getRandomValues:forbidden},GAMES:{},generateGrid:forbidden,evaluateGrid:forbidden,validateSpinInput:forbidden,Deno:{env:{get:k=>k==='SUPABASE_URL'?url:k==='SUPABASE_ANON_KEY'?'anon':'synthetic'},serve:f=>serve=f}});
 return {calls,invoke:(body,{token=true,method='POST',raw}={})=>serve(new Request('https://example.invalid',{method,headers:token?{authorization:'Bearer synthetic'}:{},...(method==='POST'?{body:raw??JSON.stringify(body)}:{})}))};
}
test('park state refill spin and unknown actions before slot data RNG or RPC',async()=>{
 for(const role of ['player','admin','superadmin'])for(const action of ['state','refill','spin','unknown']){
  const h=harness({role});const r=await h.invoke({action,game:'mystic-forest',requestId:'22222222-2222-4222-8222-222222222222',betUnits:1,lines:1});assert.equal(r.status,403);assert.equal((await r.json()).error,'GAME_PARKED');assert.deepEqual(h.calls,['profiles','user_roles']);
 }
});
test('preserve auth account role staging and malformed request denials',async()=>{
 for(const [options,status] of [[{valid:false},401],[{anonymous:true},401],[{excluded:true},403],[{role:'tester'},403],[{role:'invented'},403],[{lookupError:true},503],[{url:'https://production.invalid'},503]]){assert.equal((await harness(options).invoke({action:'spin'})).status,status);}
 const h=harness();assert.equal((await h.invoke({action:'state'},{token:false})).status,401);assert.deepEqual(h.calls,[]);
 for(const raw of ['{','[]','null'])assert.equal((await harness().invoke(null,{raw})).status,400);
 assert.equal((await harness().invoke(null,{raw:'x'.repeat(1001)})).status,413);
});
test('preflight stays available and other methods remain denied',async()=>{
 const h=harness();assert.equal((await h.invoke(null,{method:'OPTIONS'})).status,204);assert.equal((await h.invoke(null,{method:'GET'})).status,405);assert.deepEqual(h.calls,[]);
});
test('candidate is exactly hosted source plus fixed local park guard',()=>{
 assert.equal(source,original.replace('const STAGING_REF=','const SLOTS_PARKED=true; // Release policy; no caller or environment override.\nconst STAGING_REF=').replace('  const action=body.action;','  // Even state initializes an account, so deny before all slot data access.\n  if(SLOTS_PARKED)return send({error:"GAME_PARKED"},403);\n  const action=body.action;'));
});

test('review inventory distinguishes observed live metadata from undeployed guarded source',()=>{
 const inventory=JSON.parse(readFileSync(new URL('../review/slots-parked/review-manifest.json',import.meta.url),'utf8'));
 const manifest=JSON.parse(readFileSync(new URL('../supabase/backend-manifest.json',import.meta.url),'utf8'));
 const hash=path=>createHash('sha256').update(readFileSync(new URL(path,import.meta.url))).digest('hex');
 assert.equal(inventory.reviewOnly,true);assert.equal(inventory.deployable,false);assert.equal(inventory.observed.version,3);assert.equal(inventory.observed.status,'ACTIVE');assert.equal(inventory.observed.verify_jwt,true);
 assert.equal(inventory.observed.inventory_function_count,32);assert.equal(manifest.functions.length,31);assert.equal(manifest.functions.some(fn=>fn.name===inventory.slug),false);
 assert.equal(inventory.observed.plaintext_sha256['index.ts'],hash('../review/slots-parked/hosted-index.ts'));
 assert.equal(inventory.observed.plaintext_sha256['validation.js'],hash('../review/slots-parked/hosted-validation.js'));
 assert.equal(inventory.desiredReviewOnly.candidate_index_sha256,hash('../review/slots-parked/index.ts'));assert.equal(inventory.desiredReviewOnly.deployed,false);
 assert.equal(existsSync(new URL('../review/slots-parked/validation.js',import.meta.url)),false);assert.equal(existsSync(new URL('../supabase/functions/'+inventory.slug,import.meta.url)),false);
});
test('caller cannot unpark a state write through configuration fields',async()=>{
 const response=await harness({role:'superadmin'}).invoke({action:'state',SLOTS_PARKED:false,gameplayEnabled:true,practiceOnly:true});assert.equal(response.status,403);assert.equal((await response.json()).error,'GAME_PARKED');
});
