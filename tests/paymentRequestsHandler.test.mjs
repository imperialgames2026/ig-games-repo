import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=readFileSync(new URL('../supabase/functions/ig-payment-requests/index.ts',import.meta.url),'utf8').replace(/^import .*\n/,'').replace(/^export /gm,'');
const javascript=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const requestId='11111111-1111-4111-8111-111111111111';
const valid={action:'prepare',requestId,kind:'deposit',asset:'BTC',network:'bitcoin',amount:'0.01'};
function setup({role='player',excluded=false,anonymous=false}={}){
 let handler;const calls=[];const filters=[];
 const client={
  auth:{getUser:async()=>({data:{user:{id:'actor',is_anonymous:anonymous}},error:null})},
  from(table){return {select(){return this;},eq(key,value){filters.push({table,key,value});return this;},in(){return this;},order(){return this;},update(){return this;},async limit(){return{data:[],error:null};},async maybeSingle(){return{data:null,error:null};},async single(){return{data:table==='profiles'?{id:'actor',role:'superadmin',is_excluded:excluded}:{role},error:null};}};},
  async rpc(name,args){calls.push({name,args});return{data:{id:requestId,status:'awaiting_provider'},error:null};}
 };
 vm.runInNewContext(javascript,{Deno:{env:{get:()=> 'local-test-setting'},serve:fn=>handler=fn},createClient:()=>client,Response,JSON,console});
 return{calls,filters,request:(body,authorized=true)=>handler(new Request('https://example.invalid',{method:'POST',headers:authorized?{authorization:'Bearer mock'}:{},body:JSON.stringify(body)}))};
}
test('payment preparation rejects missing identity, exclusions, anonymous sessions and canonical tester roles',async()=>{
 const signedOut=setup();assert.equal((await signedOut.request(valid,false)).status,401);
 for(const options of [{role:'tester'},{role:'unknown'},{excluded:true},{anonymous:true}]){
  const h=setup(options);assert.ok([401,403].includes((await h.request(valid)).status));assert.equal(h.calls.length,0);
 }
});
test('client identity injection and imprecise or nonpositive amounts never reach payment SQL',async()=>{
 for(const body of [{...valid,user_id:'other'},{...valid,amount:'1e2'},{...valid,amount:'0'},{...valid,amount:'1.000000001'},{...valid,amount:1},{...valid,kind:'withdrawal',destination:'short'}]){
  const h=setup();assert.equal((await h.request(body)).status,400);assert.equal(h.calls.length,0);
 }
});
test('payment SQL receives the authenticated actor, unchanged replay UUID and exact decimal string',async()=>{
 const h=setup();assert.equal((await h.request(valid)).status,200);assert.equal(h.calls.length,1);
 assert.equal(h.calls[0].name,'payment_prepare');assert.equal(h.calls[0].args.p_user,'actor');
 assert.equal(h.calls[0].args.p_request,requestId);assert.equal(h.calls[0].args.p_amount,'0.01');
});
test('payment cancellation is owner-scoped and hides requests belonging to someone else',async()=>{
 const h=setup();assert.equal((await h.request({action:'cancel',id:requestId})).status,404);
 assert.ok(h.filters.some(f=>f.table==='payment_preparation_requests'&&f.key==='user_id'&&f.value==='actor'));
 assert.equal(h.calls.length,0);
});
