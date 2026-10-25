import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the actual handler in-process with synthetic Auth/database results.
// No listener, hosted request, customer data, or monetary operation is used.
const source=readFileSync(new URL('../supabase/functions/poker-events-v1/index.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source.replace(/^import[^\n]*\n/,''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const actor='11111111-1111-4111-8111-111111111111';
const eventId='22222222-2222-4222-8222-222222222222';
const free={id:eventId,name:'Synthetic free event',format:'scheduled_mtt',status:'registration',config:{practiceOnly:true,realValueEnabled:false,buyInUnits:0,levels:[{level:1,smallBlind:5,bigBlind:10,durationSeconds:600}]}};
function harness({events=[free],role='player',eligible=true,errorAt=null}={}){
 let handler;const calls=[];
 const ownEntry={event_id:eventId,user_id:actor,status:'registered',table_id:null,seat_no:null};
 const db={from:table=>{
  let owned=false;const q={select:()=>q,in:()=>q,order:()=>q,limit:()=>q,eq:key=>{if(key==='user_id')owned=true;return q;},maybeSingle:async()=>({data:table==='profiles'?{is_excluded:!eligible}:table==='user_roles'?{role}:ownEntry,error:null}),then:(ok,bad)=>Promise.resolve(table==='poker_events_v1'?{data:events,error:errorAt==='events'?{}:null}:{data:owned?[ownEntry]:[{event_id:eventId},{event_id:eventId}],error:errorAt===(owned?'own':'counts')?{}:null}).then(ok,bad)};return q;
 },rpc:async(name,args)=>{calls.push({name,args});return {data:{registered:true},error:null};}};
 vm.runInNewContext(compiled,{Request,Response,Date,console,createClient:(_url,key)=>key==='synthetic-anon'?{auth:{getUser:async token=>token==='synthetic-valid'?{data:{user:{id:actor}},error:null}:{data:{user:null},error:{message:'Invalid synthetic session'}}}}:db,Deno:{env:{get:key=>({SUPABASE_URL:'https://example.invalid',SUPABASE_ANON_KEY:'synthetic-anon',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service'})[key]},serve:fn=>handler=fn}});
 return {calls,invoke:(body,token='synthetic-valid')=>handler(new Request('https://example.invalid/handler',{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify(body)}))};
}
test('list returns only free practice tournaments and the authenticated player entry',async()=>{
 const h=harness({events:[free,{...free,id:'paid',config:{...free.config,buyInUnits:1}},{...free,id:'real',config:{...free.config,realValueEnabled:true}},{...free,id:'unreviewed',config:{}},{...free,id:'ring',format:'ring'}]});
 const response=await h.invoke({action:'list'});assert.equal(response.status,200);const body=await response.json();assert.equal(body.events.length,1);const event=body.events[0];assert.equal(event.id,eventId);assert.equal(event.registered,2);assert.equal(event.myEntry.user_id,actor);assert.deepEqual(event.levels,free.config.levels);assert.equal(event.practiceOnly,true);assert.equal(event.realValueEnabled,false);
});
test('event, own-entry and registration-count query failures fail closed',async()=>{
 for(const errorAt of ['events','own','counts']){const response=await harness({errorAt}).invoke({action:'list'});assert.equal(response.status,500,errorAt);assert.equal((await response.json()).events,undefined);}
});
test('registration binds the SQL actor to authenticated identity',async()=>{
 const h=harness();const response=await h.invoke({action:'register',eventId,actor:'forged',userId:'forged'});assert.equal(response.status,200);assert.equal(h.calls.length,1);assert.equal(h.calls[0].name,'poker_event_register_v1');assert.equal(h.calls[0].args.p_actor,actor);assert.equal(h.calls[0].args.p_event,eventId);
});
test('missing or invalid sessions, excluded accounts and tester mutation do not reach SQL',async()=>{
 for(const [options,token,status] of [[{},null,401],[{},'synthetic-invalid',401],[{eligible:false},'synthetic-valid',403],[{role:'tester'},'synthetic-valid',403]]){const h=harness(options);assert.equal((await h.invoke({action:'register',eventId},token)).status,status);assert.equal(h.calls.length,0);}
});
test('invalid tournament identifiers are rejected before SQL mutation',async()=>{
 const h=harness();assert.equal((await h.invoke({action:'register',eventId:'not-an-event'})).status,400);assert.equal(h.calls.length,0);
});
