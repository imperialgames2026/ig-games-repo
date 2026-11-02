import test from 'node:test';
import assert from 'node:assert/strict';
import { createEncounterHandler } from '../supabase/functions/_shared/imperial-campaign/encounter-service.ts';
const id='a1111111-1111-4111-8111-111111111111',requestId='b1111111-1111-4111-8111-111111111111';
const intent=(command={type:'attack',targetId:'sentinel'})=>({action:'act',encounterId:id,requestId,expectedRevision:0,command});
const send=(handler,body,token='test')=>handler(new Request('https://test',{method:'POST',headers:token?{authorization:'Bearer '+token}:{},body:JSON.stringify(body)}));
const actor=(actorId,team,ownerUserId,x)=>({id:actorId,team,ownerUserId,name:actorId,level:1,abilities:{strength:14,dexterity:14,constitution:14,intelligence:10,wisdom:10,charisma:10},armorClass:12,hitPoints:10,maxHitPoints:10,position:{x,y:1},movementPerTurnFeet:30,movementRemainingFeet:30,actionUsed:false,weapon:{id:'practice_sword',attackAbility:'strength',damageAbility:'strength',proficient:true,attackFlatBonus:0,damageFlatBonus:0,rangeFeet:5,damageDiceCount:1,damageDieSides:6}});
const state=()=>({id,revision:0,phase:'active',outcome:null,map:{width:8,height:8,tileSizeFeet:5,blockedCells:[]},turnOrder:['hero','sentinel'],activeTurnIndex:0,combatants:[actor('hero','heroes','owner',1),actor('sentinel','hostiles',null,2)]});
test('trial rejects unauthenticated/anonymous users and injected fields before storage',async()=>{
 let calls=0;
 for(const user of [null,{id:'owner',isAnonymous:true}]){
  const h=createEncounterHandler({authenticate:async()=>user,rpc:async()=>{calls++;throw Error('Unexpected RPC');}});
  assert.equal((await send(h,intent())).status,401);
 }
 const h=createEncounterHandler({authenticate:async()=>({id:'owner'}),rpc:async()=>{calls++;throw Error('Unexpected RPC');}});
 for(const body of [{...intent(),roll:20},{...intent(),ownerUserId:'fake'},intent({type:'attack',targetId:'sentinel',damage:99}),intent({type:'move',path:[{x:1,y:2,z:0}]}),{...intent(),expectedRevision:-1}])assert.equal((await send(h,body)).status,400);
 assert.equal(calls,0);
});
test('accepted retry returns committed receipt without rerolling or rewriting',async()=>{
 let rolls=0,calls=0;const cached={encounter:{id,state:{revision:1}},events:[{hit:true}]};
 const h=createEncounterHandler({authenticate:async()=>({id:'owner'}),randomInt:()=>{rolls++;return 19;},rpc:async(name,args)=>{calls++;assert.equal(name,'ig_campaign_trial_prepare_v1');assert.equal(args.p_user_id,'owner');return{data:{replay:cached},error:null};}});
 assert.deepEqual(await (await send(h,intent())).json(),cached);assert.equal(rolls,0);assert.equal(calls,1);
});
test('end turn resolves enemy on server and persists both events together',async()=>{
 const calls=[];const h=createEncounterHandler({authenticate:async()=>({id:'owner'}),randomInt:()=>0,rpc:async(name,args)=>{calls.push({name,args});return{data:name.includes('prepare')?{state:state()}:{encounter:{state:args.p_next_state},events:args.p_events},error:null};}});
 const r=await send(h,intent({type:'end_turn'}));assert.equal(r.status,200);const data=await r.json();
 assert.equal(data.encounter.state.revision,2);assert.equal(data.encounter.state.phase,'active');assert.deepEqual(data.events.map(e=>e.kind),['end_turn','hostile_turn']);assert.equal(calls.length,2);
});
test('CAS loser never returns its uncommitted roll and stale state never rerolls',async()=>{
 let rolls=0;const h=createEncounterHandler({authenticate:async()=>({id:'owner'}),randomInt:n=>{rolls++;return n-1;},rpc:async(name)=>name.includes('prepare')?{data:{state:state()},error:null}:{data:null,error:{code:'40001',message:'private details'}}});
 const r=await send(h,intent());assert.equal(r.status,409);const text=await r.text();assert.equal(text.includes('criticalHit'),false);assert.equal(text.includes('private details'),false);assert.ok(rolls>0);
 rolls=0;assert.equal((await send(h,{...intent(),expectedRevision:1})).status,409);assert.equal(rolls,0);
});
test('start/resume use verified owner and only start accepts a request ID',async()=>{
 const calls=[];const h=createEncounterHandler({authenticate:async()=>({id:'owner'}),rpc:async(name,args)=>{calls.push({name,args});return{data:{encounter:null},error:null};}});
 assert.equal((await send(h,{action:'start',characterId:id,requestId})).status,200);assert.equal(calls[0].args.p_user_id,'owner');assert.equal(calls[0].args.p_request_id,requestId);
 assert.equal((await send(h,{action:'resume',characterId:id})).status,200);assert.equal(calls[1].args.p_request_id,null);
 assert.equal((await send(h,{action:'resume',characterId:id,requestId})).status,400);
});
