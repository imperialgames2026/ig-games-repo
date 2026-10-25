import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {randomUUID} from 'node:crypto';

// Pure in-process handler tests. No HTTP listener, network or real Auth service.
const source=readFileSync(new URL('../supabase/functions/admin-poker-events/index.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source.replace(/^import[^\n]*\n/,''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
function harness(role='superadmin'){
 let handler;const calls=[];const actor=randomUUID();
 const db={from:()=>{
  const chain={select:()=>chain,eq:()=>chain,maybeSingle:async()=>({data:role==='superadmin'?{role}:null,error:null})};return chain;
 },rpc:async(name,args)=>{calls.push({name,args});return {data:{eventId:randomUUID()},error:null};}};
 vm.runInNewContext(compiled,{
  Request,Response,Date,console,
  createClient:(_url,key)=>key==='synthetic-anon'?{auth:{getUser:async token=>token==='synthetic-valid'?{data:{user:{id:actor}},error:null}:{data:{user:null},error:{message:'Invalid synthetic session'}}}}:db,
  Deno:{env:{get:key=>({SUPABASE_URL:'https://example.invalid',SUPABASE_ANON_KEY:'synthetic-anon',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service'})[key]},serve:fn=>handler=fn},
 });
 const invoke=(body,token='synthetic-valid')=>handler(new Request('https://example.invalid/handler',{method:'POST',headers:{'content-type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)}));
 return {invoke,calls,actor};
}
const draft=()=>({action:'create',name:'Synthetic practice tournament',format:'scheduled_mtt',requestId:randomUUID(),config:{
 maxPlayers:6,seatsPerTable:6,startingStack:1000,smallBlind:5,bigBlind:10,
 startAt:new Date(Date.now()+3600000).toISOString(),levels:[{level:1,smallBlind:5,bigBlind:10,ante:0,durationSeconds:600}],
 buyInUnits:999,practiceOnly:false,realValueEnabled:true,
}});
test('authorized admin create stamps explicit zero fee and nonredeemable practice flags',async()=>{
 const h=harness();const response=await h.invoke(draft());assert.equal(response.status,201);assert.equal(h.calls.length,1);
 const call=h.calls[0];assert.equal(call.name,'poker_event_create_v1');assert.equal(call.args.p_actor,h.actor);
 assert.equal(call.args.p_config.buyInUnits,0);assert.equal(call.args.p_config.practiceOnly,true);assert.equal(call.args.p_config.realValueEnabled,false);
});
test('missing or invalid session and non-superadmin cannot reach draft mutation',async()=>{
 for(const [role,token,status] of [['superadmin',null,401],['superadmin','synthetic-invalid',401],['player','synthetic-valid',403]]){
  const h=harness(role);assert.equal((await h.invoke(draft(),token)).status,status);assert.equal(h.calls.length,0);
 }
});
test('invalid tournament configuration remains rejected before SQL mutation',async()=>{
 const h=harness();const body=draft();body.config.levels=[];assert.equal((await h.invoke(body)).status,400);assert.equal(h.calls.length,0);
});
