import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const actor='11111111-1111-4111-8111-111111111111';
const tableId='22222222-2222-4222-8222-222222222222';
const botId='33333333-3333-4333-8333-333333333333';
function setup({role='player',variant='holdem',botError=false}={}){
 let handler;const queries=[],calls=[];
 const table={id:tableId,owner_id:actor,variant,status:'playing',turn_index:0,version:3,
  board:[],private_deck:'server-deck-secret',seed_secret:'server-seed-secret',hand_no:1};
 const seats=[{seat_no:0,user_id:actor,stack:990,committed:10,street_bet:10,folded:false,all_in:false,acted:false},
  {seat_no:7,user_id:botId,stack:990,committed:10,street_bet:10,folded:false,all_in:false,acted:false}];
 function from(name){
  const query={name,fields:'',filters:[]};queries.push(query);
  const api={
   select(fields){query.fields=fields;return api;},
   eq(key,value){query.filters.push([key,value]);return api;},
   in(key,value){query.filters.push([key,value]);return api;},
   order(){return api;},
   maybeSingle(){return Promise.resolve(result());},single(){return Promise.resolve(result());},
   then(resolve,reject){return Promise.resolve(result()).then(resolve,reject);},
  };
  function result(){
   let data;
   if(name==='profiles')data={is_excluded:false};
   else if(name==='user_roles')data={role};
   else if(name==='poker_tables_v1')data=query.fields==='variant'?{variant}:table;
   else if(name==='poker_seats_v1')data=query.fields==='seat_no'?{seat_no:0}:query.fields==='private_hole'?{private_hole:[{rank:14,suit:'c'},{rank:13,suit:'c'}]}:seats;
   else if(name==='ig_poker_lab_bots')data=[{user_id:botId,public_name:'Imperial Ace [AI BOT]'}];
   else if(name==='poker_timebank_prices_v1')data={practice_preview_enabled:true,payment_enabled:true,igd_price:0.15};
   else throw Error('Unexpected table '+name);
   return {data,error:botError&&name==='ig_poker_lab_bots'?{message:'fixture failure'}:null};
  }
  return api;
 }
 const client={auth:{getUser:async()=>({data:{user:{id:actor,is_anonymous:false}},error:null})},from,
  rpc:async(name,args)=>{calls.push({name,args});return {data:{accepted:true},error:null};}};
 const source=readFileSync(new URL('../supabase/pending-functions/poker-table-v1/index.ts',import.meta.url),'utf8').replace(/^import .*\n/,'');
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,
  {createClient:()=>client,Response,JSON,Deno:{env:{get:key=>key==='SUPABASE_URL'?'https://jvyzpxjqmymafjapprpp.supabase.co':'fixture-key'},serve:fn=>handler=fn}});
 return {queries,calls,request:body=>handler(new Request('https://fixture.invalid',{method:'POST',headers:{Authorization:'Bearer fixture'},body:JSON.stringify({tableId,...body})}))};
}
test('candidate snapshot labels every automated seat without exposing private deck, seed or other cards',async()=>{
 const h=setup();const response=await h.request({action:'snapshot'});assert.equal(response.status,200);
 const data=await response.json();assert.equal(data.seats[1].isBot,true);
 assert.equal(data.seats[1].displayName,'Imperial Ace [AI BOT]');assert.equal(data.seats[0].isBot,false);
 assert.equal(data.holeCards.length,2);
 assert.ok(data.seats.every(seat=>!Object.hasOwn(seat,'private_hole')));
 assert.equal(JSON.stringify(data).includes('server-deck-secret'),false);
 assert.equal(JSON.stringify(data).includes('server-seed-secret'),false);
 assert.equal(h.queries.find(query=>query.name==='ig_poker_lab_bots').fields,'user_id,public_name');
});
test('candidate stops snapshots if bot labeling cannot be verified',async()=>{
 const h=setup({botError:true});assert.equal((await h.request({action:'snapshot'})).status,503);
});
test('paid timebank cannot activate on the chip test site even if a database payment switch is enabled',async()=>{
 for(const currency of ['IGD','IGN','USD']){
  const h=setup();const response=await h.request({action:'buyTime',currency,requestId:actor,version:3});
  assert.equal(response.status,403);assert.ok(h.calls.every(call=>call.name!=='poker_buy_time_v1'));
  assert.ok(h.queries.every(query=>!['wallets','transactions'].includes(query.name)));
 }
 const h=setup();assert.equal((await h.request({action:'buyTime',currency:'PRACTICE',requestId:actor,version:3})).status,200);
 assert.equal(h.calls.find(call=>call.name==='poker_buy_time_v1').args.p_currency,'PRACTICE');
});
test('wrong-variant invites cannot consume a seat and read-only testers cannot join',async()=>{
 const wrong=setup({variant:'omaha'});assert.equal((await wrong.request({action:'join',variant:'holdem'})).status,409);
 assert.equal(wrong.calls.length,0);
 const readOnly=setup({role:'tester'});assert.equal((await readOnly.request({action:'join',variant:'holdem'})).status,403);
 assert.equal(readOnly.calls.length,0);
});

function eventSetup({anonymous=false,role='player'}={}){
 let handler;const calls=[];
 const client={auth:{getUser:async()=>({data:{user:{id:actor,is_anonymous:anonymous}},error:null})},
  from(name){
   const result={data:name==='profiles'?{is_excluded:false}:name==='user_roles'?{role}:[],error:null};
   const query={select(){return query;},eq(){return query;},in(){return query;},order(){return query;},limit(){return query;},
    maybeSingle(){return Promise.resolve(result);},then(resolve,reject){return Promise.resolve(result).then(resolve,reject);}};
   return query;
  },rpc:async(name,args)=>{calls.push({name,args});return {data:{registered:true},error:null};}};
 const source=readFileSync(new URL('../supabase/pending-functions/poker-events-v1/index.ts',import.meta.url),'utf8').replace(/^import .*\n/,'');
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,
  {createClient:()=>client,Response,JSON,Deno:{env:{get:()=> 'fixture'},serve:fn=>handler=fn}});
 return {calls,request:(body,method='POST')=>handler(new Request('https://fixture.invalid',{method,
  headers:{Authorization:'Bearer fixture'},...(method==='POST'?{body:JSON.stringify(body)}:{})}))};
}
test('restored event lobby permits the actual browser preflight and binds registration to the session',async()=>{
 const h=eventSetup();const preflight=await h.request(null,'OPTIONS');
 assert.match(preflight.headers.get('Access-Control-Allow-Headers'),/x-client-info/);
 assert.match(preflight.headers.get('Access-Control-Allow-Headers'),/x-supabase-api-version/);
 assert.match(preflight.headers.get('Access-Control-Allow-Methods'),/POST/);
 const result=await h.request({action:'register',eventId:tableId});assert.equal(result.status,200);
 assert.equal(h.calls[0].name,'poker_event_register_v1');
 assert.equal(h.calls[0].args.p_actor,actor);assert.equal(h.calls[0].args.p_event,tableId);
});
test('event registration rejects anonymous and read-only identities',async()=>{
 const anonymous=eventSetup({anonymous:true});assert.equal((await anonymous.request({action:'register',eventId:tableId})).status,401);
 assert.equal(anonymous.calls.length,0);
 const readOnly=eventSetup({role:'tester'});assert.equal((await readOnly.request({action:'register',eventId:tableId})).status,403);
 assert.equal(readOnly.calls.length,0);
 assert.equal((await readOnly.request({action:'list'})).status,200);
});
