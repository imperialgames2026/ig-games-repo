import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=readFileSync(new URL('../supabase/functions/poker-table-v1/index.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source.replace(/^import[^\n]*\n/gm,''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const actor='11111111-1111-4111-8111-111111111111',table='22222222-2222-4222-8222-222222222222';
const body={action:'buyTime',tableId:table,requestId:'33333333-3333-4333-8333-333333333333',version:7};
function harness({valid=true,anonymous=false,eligible=true,role='player',member=true,paymentEnabled=true}={}){
 let serve;const calls=[];
 const db={from(name){calls.push({from:name});assert.ok(!['wallets','transactions'].includes(name));const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:name==='profiles'?{is_excluded:!eligible}:name==='user_roles'?{role}:member?{seat_no:0}:null,error:null}),single:async()=>({data:{id:table,version:7,payment_enabled:paymentEnabled},error:null})};return q;},async rpc(name,args){calls.push({rpc:name,args});return {data:name==='poker_buy_time_v1'?{charged:false,currency:args.p_currency}:null,error:null};}};
 vm.runInNewContext(compiled,{Response,Request,console,crypto:globalThis.crypto,createClient:(_url,key)=>key==='anon'?{auth:{getUser:async()=>({data:{user:valid?{id:actor,is_anonymous:anonymous}:null},error:valid?null:{}})}}:db,Deno:{env:{get:k=>k==='SUPABASE_ANON_KEY'?'anon':'synthetic'},serve:fn=>serve=fn}});
 return {calls,invoke:(payload,token=true)=>serve(new Request('https://example.invalid',{method:'POST',headers:token?{authorization:'Bearer synthetic'}:{},body:JSON.stringify(payload)}))};
}
test('IGD and IGN are denied before any mutation RPC regardless of paid config',async()=>{
 for(const paymentEnabled of [false,true])for(const currency of ['IGD','IGN']){
  const h=harness({paymentEnabled});const r=await h.invoke({...body,currency});assert.equal(r.status,403);assert.equal((await r.json()).error,'FINANCIAL_OPERATIONS_DISABLED');assert.equal(h.calls.filter(c=>c.rpc).length,0);assert.deepEqual(h.calls.map(c=>c.from),['profiles','user_roles','poker_seats_v1']);
 }
});
test('free PRACTICE timebank retains server actor and timeout/purchase flow',async()=>{
 const h=harness();const r=await h.invoke({...body,currency:'PRACTICE'});assert.equal(r.status,200);assert.equal((await r.json()).charged,false);assert.deepEqual(h.calls.filter(c=>c.rpc).map(c=>c.rpc),['poker_timeout_turn_v1','poker_buy_time_v1']);const last=h.calls.at(-1);assert.equal(last.args.p_actor,actor);assert.equal(last.args.p_currency,'PRACTICE');
});
test('Auth eligibility membership and original request validation remain fail closed',async()=>{
 for(const [options,token,status] of [[{},false,401],[{valid:false},true,401],[{anonymous:true},true,401],[{eligible:false},true,403],[{role:'tester'},true,403],[{member:false},true,403]]){const h=harness(options);assert.equal((await h.invoke({...body,currency:'IGD'},token)).status,status);assert.equal(h.calls.filter(c=>c.rpc).length,0);}
 for(const changed of [{requestId:'bad'},{version:1.5},{currency:'USD'}]){const h=harness();assert.equal((await h.invoke({...body,currency:'IGD',...changed})).status,400);assert.equal(h.calls.filter(c=>c.rpc).length,0);}
});
