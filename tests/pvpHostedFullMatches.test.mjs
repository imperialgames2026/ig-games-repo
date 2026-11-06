import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID,createHash} from 'node:crypto';
import {fixture as databaseFixture,actors} from './helpers/pvpHostedFixture.mjs';
import {createHostedPvpService} from '../supabase/functions/pvp-games-review/service.mjs';
import * as rummy from '../supabase/functions/pvp-games-review/runtime/dist/games/rummy.js';
import * as spades from '../supabase/functions/pvp-games-review/runtime/dist/games/spades.js';
async function fixture(game,capacity){
 const f=await databaseFixture();let service=f.service;const call=(n,b)=>service.execute(actors[n].id,b),mutate=(n,b)=>call(n,{...b,requestId:randomUUID()});let result=await mutate(0,{op:'create',game}),id=result.snapshot.roomId;
 for(let n=1;n<capacity;n++){result=await mutate(0,{op:'invite',roomId:id,targetId:actors[n].id,expectedVersion:result.snapshot.revision});result=await mutate(n,{op:'join',roomId:id,seat:n,expectedVersion:result.snapshot.revision});}
 return {actors,call,mutate,id,view:async n=>(await call(n,{op:'snapshot',roomId:id})).snapshot,action:(n,a,v)=>mutate(n,{op:'action',roomId:id,expectedVersion:v,action:a}),restart(){service=createHostedPvpService({store:f.store,resolveActor:async token=>actors.find(a=>a.id===token)});},close:()=>f.db.close()};
}
const wire=x=>JSON.parse(JSON.stringify(x));
function privateState(snapshot,seat){
 const s=snapshot.view.state;
 assert.equal(snapshot.financialExecutionEnabled,false);assert.equal(s.seed,undefined);assert.equal(s.initialSeed,undefined);assert.equal(s.stock,undefined);
 if(!s.over&&s.hands)for(let n=0;n<s.hands.length;n++)if(n!==seat)assert.equal(s.hands[n],null);
 if(!s.over&&s.ships){assert.deepEqual(s.ships[1-seat],[]);for(const p of s.fleetProofs||[])if(p){assert.equal(p.nonce,undefined);assert.equal(p.payload,undefined);}}
}
for(const [game,capacity] of [['chess',2],['rummy',2],['rummy6',6],['spades',4],['battleship',2],['battleship6',2]]){
 test(`full ${game} via private service projections; durable reconnect/retry/terminal denial`,async t=>{
  const f=await fixture(game,capacity);let steps=0,rounds=1,lastBody,lastActor,restarted=false;
  try{
   await assert.rejects(f.view(capacity),e=>e.code==='ROOM_MEMBERSHIP_REQUIRED');
   let snap=await f.view(0);const joinedRevision=snap.revision;
   await assert.rejects(f.mutate(1,{op:'join',roomId:f.id,seat:1,expectedVersion:snap.revision}),e=>e.code==='SEAT_UNAVAILABLE');
   assert.equal((await f.view(0)).revision,joinedRevision);
   if(game.startsWith('battleship'))for(let n=0;n<2;n++)for(const type of ['auto','ready']){snap=await f.view(n);await f.action(n,{type},snap.revision);}
   while(true){
    snap=await f.view(0);if(snap.view.state.over)break;
    assert.ok(steps<16000,`${game} did not terminate within bounded authored-rule turns`);
    const actor=snap.view.state.turn,own=await f.view(actor),state=own.view.state;privateState(own,actor);
    let action;
    if(game==='chess')action=[{type:'play',from:'f2',to:'f3'},{type:'play',from:'e7',to:'e5'},{type:'play',from:'g2',to:'g4'},{type:'play',from:'d8',to:'h4'}][steps];
    else if(state.phase==='round'){action={type:'next'};rounds++;}
    else if(game.startsWith('rummy'))action=rummy.bot(structuredClone(state));
    else if(game==='spades')action=spades.bot(structuredClone(state));
    else action={type:'fire',index:state.shots[actor].findIndex(x=>x===null)};
    lastBody={op:'action',roomId:f.id,expectedVersion:own.revision,requestId:randomUUID(),action};lastActor=actor;
    const result=await f.call(actor,lastBody);assert.equal(result.snapshot.revision,own.revision+1);steps++;
    if(steps===3){
     f.restart();restarted=true;const reconnect=await f.view(actor);assert.equal(reconnect.view.seat,actor);assert.deepEqual(wire(reconnect),wire(result.snapshot));
     const retry=await f.call(actor,lastBody);assert.deepEqual(retry.receipt,result.receipt);assert.equal(retry.snapshot.revision,result.snapshot.revision);
     await assert.rejects(f.call(actor,{...lastBody,action:{type:'not-an-action'}}),e=>e.code==='REQUEST_PAYLOAD_CONFLICT');
     assert.equal((await f.view(actor)).revision,result.snapshot.revision);
    }
   }
   assert.ok(restarted);assert.equal(snap.view.state.over,true);
   if(game==='chess')assert.equal(snap.view.state.result,'0-1');
   if(game.startsWith('rummy'))assert.ok(Math.max(...snap.view.state.scores)>=100);
   if(game==='spades'){assert.ok(Math.max(...snap.view.state.scores)>=500);assert.notEqual(snap.view.state.scores[0],snap.view.state.scores[1]);}
   if(game.startsWith('battleship')){
    assert.ok([0,1].includes(snap.view.state.winner));
    for(const proof of snap.view.state.fleetProofs){assert.equal(createHash('sha256').update(proof.nonce+':'+proof.payload).digest('hex'),proof.commitment);}
   }
   const beforeRestart=await f.view(lastActor);f.restart();const final=await f.view(lastActor);assert.deepEqual(wire(final),wire(beforeRestart));
   const replay=await f.call(lastActor,lastBody);assert.equal(replay.receipt.version,final.revision);assert.equal(replay.snapshot.revision,final.revision);
   await assert.rejects(f.action(final.view.state.turn,{type:'next'},final.revision),e=>e.code==='GAME_ACTION_REJECTED');
   assert.equal((await f.view(0)).revision,final.revision);
   t.diagnostic(JSON.stringify({game,steps,rounds,finalRevision:final.revision,scores:snap.view.state.scores,terminal:snap.view.state.message||snap.view.state.log?.at(-1),restarted,financialExecutionEnabled:false}));
  }finally{await f.close();}
 });
}
test('Chess threefold repetition ends as authored draw; reconnect and terminal actions preserve result',async()=>{
 const f=await fixture('chess',2);
 try{
  for(let n=0;n<8;n++){
   const s=await f.view(0),[from,to]=[['g1','f3'],['g8','f6'],['f3','g1'],['f6','g8']][n%4];
   await f.action(s.view.state.turn,{type:'play',from,to},s.revision);
  }
  let s=await f.view(0);assert.equal(s.view.state.over,true);assert.equal(s.view.state.result,'1/2-1/2');
  f.restart();assert.equal((await f.view(1)).view.state.result,'1/2-1/2');
  await assert.rejects(f.action(s.view.state.turn,{type:'resign'},s.revision),e=>e.code==='GAME_ACTION_REJECTED');
  assert.equal((await f.view(0)).revision,s.revision);
 }finally{await f.close();}
});
for(const [game,capacity]of [['rummy',2],['rummy6',6]])test(`${game} authored stock-exhaustion draw, next hand and old-receipt replay do not redeal`,async()=>{
 const f=await fixture(game,capacity);
 try{
  let s=await f.view(0),steps=0;
  while(s.view.state.phase!=='round'){
   assert.ok(steps++<120);const n=s.view.state.turn;
   s=(await f.action(n,{type:'draw',source:'stock'},s.revision)).snapshot;
   const own=await f.view(n);privateState(own,n);
   s=(await f.action(n,{type:'discard',id:own.view.state.hands[n][0].id},own.revision)).snapshot;
  }
  assert.equal(s.view.state.over,false);assert.deepEqual(s.view.state.scores,Array(capacity).fill(0));assert.equal(s.view.state.stockCount,0);
  const body={op:'action',roomId:f.id,expectedVersion:s.revision,requestId:randomUUID(),action:{type:'next'}};
  const next=await f.call(0,body);assert.equal(next.snapshot.view.state.round,2);assert.equal(next.snapshot.view.state.phase,'draw');
  f.restart();const retry=await f.call(0,body);assert.deepEqual(retry.receipt,next.receipt);assert.equal(retry.snapshot.view.state.round,2);assert.equal(retry.snapshot.revision,next.snapshot.revision);
  assert.deepEqual(retry.snapshot.view.state.scores,Array(capacity).fill(0));
 }finally{await f.close();}
});
