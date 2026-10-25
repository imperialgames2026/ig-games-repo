import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const id='11111111-1111-4111-8111-111111111111';
const requests={
 'ig-originals-practice':{action:'commit',game:'coin',requestId:id},
 'ig-mines-practice':{action:'commit',roundId:id,mineCount:3},
 'ig-final-practice':{action:'commit',game:'hilo',roundId:id,options:{}},
 'provably-fair-v2':{action:'commit',game:'dice'},
 'provably-fair-demo':{action:'commit',game:'dice',clientSeed:'synthetic-client-seed'},
};
function harness(name,{valid=true,anonymous=false}={}){
 let handler;let authCalls=0;const writes=[];const filters=[];
 const client={auth:{getUser:async()=>{authCalls++;return {data:{user:valid?{id,is_anonymous:anonymous}:null},error:valid?null:{message:'synthetic invalid session'}};}},
  rpc:async(...args)=>{writes.push(args);throw Error('Parked mutation reached SQL');},
  from(table){
   assert.ok(['profiles','user_roles','fair_seed_commitments'].includes(table));
   return {select(){return this;},eq(key,value){filters.push({table,key,value});return this;},order(){return this;},
    maybeSingle:async()=>({data:table==='profiles'?{is_excluded:false}:{role:'player'},error:null}),
    limit:async()=>({data:[],error:null}),insert(){writes.push(table);throw Error('Parked mutation reached SQL');}};
  }};
 const source=readFileSync(new URL('../supabase/functions/'+name+'/index.ts',import.meta.url),'utf8').replace(/^import[^\n]*\n/,'');
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText,
  {createClient:()=>client,Response,JSON,TextEncoder,console,Deno:{env:{get:key=>key==='SUPABASE_URL'?'https://qonqemhljgxlwpghkxhn.supabase.co':'synthetic-setting'},serve:fn=>handler=fn}});
 return {writes,filters,authCalls:()=>authCalls,invoke:(body,token=true)=>handler(new Request('https://example.invalid',{method:'POST',headers:token?{authorization:'Bearer synthetic'}:{},body:JSON.stringify(body)}))};
}
for(const [name,body] of Object.entries(requests)){
 test(name+' preserves authentication and denies parked mutation before SQL',async()=>{
  const h=harness(name);const response=await h.invoke(body);assert.equal(response.status,403);assert.equal((await response.json()).code,'GAME_PARKED');assert.equal(h.authCalls(),1);assert.equal(h.writes.length,0);
  for(const options of [{valid:false},{anonymous:true}]){const denied=harness(name,options);assert.equal((await denied.invoke(body)).status,401);assert.equal(denied.writes.length,0);}
  const signedOut=harness(name);assert.equal((await signedOut.invoke(body,false)).status,401);assert.equal(signedOut.writes.length,0);
 });
}
test('standalone Dice history remains revealed-only and owner-scoped while mutation is parked',async()=>{
 const h=harness('provably-fair-v2');assert.equal((await h.invoke({action:'history'})).status,200);
 assert.ok(h.filters.some(x=>x.table==='fair_seed_commitments'&&x.key==='user_id'&&x.value===id));
 assert.ok(h.filters.some(x=>x.table==='fair_seed_commitments'&&x.key==='status'&&x.value==='revealed'));assert.equal(h.writes.length,0);
});
