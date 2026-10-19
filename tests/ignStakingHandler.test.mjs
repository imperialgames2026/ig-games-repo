import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=readFileSync(new URL('../supabase/functions/ign-staking-v1/index.ts',import.meta.url),'utf8').replace(/^import .*\n/,'');
const javascript=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
function setup({role='player',excluded=false,anonymous=false,url='https://qonqemhljgxlwpghkxhn.supabase.co'}={}) {
 let handler;const calls=[];
 const client={
  auth:{getUser:async()=>({data:{user:{id:'actor',is_anonymous:anonymous}},error:null})},
  from(table){return {select(){return this;},eq(){return this;},order(){return this;},async limit(){return {data:[],error:null};},async single(){return {data:{},error:null};},async maybeSingle(){return {data:table==='profiles'?{is_excluded:excluded}:table==='user_roles'?{role}:null,error:null};}};},
  async rpc(name,args){calls.push({name,args});return {data:{status:'ok'},error:null};}
 };
 vm.runInNewContext(javascript,{Deno:{env:{get:k=>k==='SUPABASE_URL'?url:'test-public-key'},serve:fn=>handler=fn},createClient:()=>client,Response,JSON});
 return {calls,request:body=>handler(new Request('https://example.invalid',{method:'POST',headers:{authorization:'Bearer mock'},body:JSON.stringify(body)}))};
}
const operation='11111111-1111-4111-8111-111111111111';
test('tester mutations, exclusions, unknown roles and anonymous sessions never reach SQL',async()=>{
 for(const opts of [{role:'tester'},{role:'unknown'},{excluded:true},{anonymous:true}]){
  const h=setup(opts);assert.ok([401,403].includes((await h.request({action:'demo_grant',operation_id:operation})).status));assert.equal(h.calls.length,0);
 }
});
test('tester can view own simulation without mutating it',async()=>{
 const h=setup({role:'tester'});assert.equal((await h.request({action:'overview'})).status,200);assert.equal(h.calls.length,0);
});
test('rejects caller identity, unexpected fields, invalid amount and wrong environment',async()=>{
 for(const body of [{action:'stake',operation_id:operation,amount:1,user_id:'other'},{action:'stake',operation_id:operation,amount:-1},{action:'auto_stake',operation_id:operation,auto_stake:'true'}]){
  const h=setup();assert.equal((await h.request(body)).status,400);assert.equal(h.calls.length,0);
 }
 const h=setup({url:'https://production.example'});assert.equal((await h.request({action:'overview'})).status,503);
});
test('authorized request forwards original idempotency key and validated amount',async()=>{
 const h=setup();assert.equal((await h.request({action:'stake',operation_id:operation,amount:10})).status,200);
 assert.equal(h.calls.length,1);assert.equal(h.calls[0].name,'ign_action');assert.equal(h.calls[0].args.p_operation_id,operation);assert.equal(h.calls[0].args.p_amount,10);
});
