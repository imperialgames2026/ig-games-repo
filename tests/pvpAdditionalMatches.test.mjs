import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {fixture,actors,call,room} from './helpers/pvpHostedFixture.mjs';
import {modules} from '../supabase/functions/pvp-games-review/runtime/engine.mjs';
import {dictionary} from '../supabase/functions/pvp-games-review/runtime/dictionary.mjs';
const trie=modules.words.makeTrie(dictionary);
function choice(game,s,n,steps){
 if(s.phase==='round')return {type:'next'};
 if(game==='checkers')return {type:'play',...modules.checkers.bot(s)};
 if(game==='dominoes')return s.legalMoves?.[0]||{type:s.stockCount?'draw':'pass'};
 if(game==='euchre'){
  if(s.phase==='bid')return {type:'bid',suit:s.bidOptions[0],alone:false};
  if(s.phase==='discard')return {type:'discard',id:s.hands[n][0].id};
  return {type:'play',id:s.legalCards[0]};
 }
 // Use minimum contracts: the authored demo bot can repeatedly overbid both teams into negative scores.
 if(game==='pinochle'&&s.phase==='bid')return {type:'bid',amount:s.bidder===null?25:null};
 if(game==='words')return steps<2?modules.words.bestMove(s,dictionary,trie,35000):{type:'pass'};
 return modules[game].bot(structuredClone(s),n);
}
for(const [game,seats]of Object.entries({checkers:2,dominoes:2,euchre:4,hearts:4,pinochle:4,connectfour:2,backgammon:2,reversi:2,gomoku:2,words:2}))test('complete '+game+' using only private player projections and durable PostgreSQL receipts',{timeout:120000},async t=>{
 const f=await fixture();try{
  let snapshot=await room(f.service,game,seats),steps=0,latest,body,actor;
  while(!snapshot.view.state.over){assert.ok(steps<16000,game+' did not reach its authored terminal boundary');const visible=snapshot.view.state;actor=game==='hearts'&&visible.phase==='pass'?visible.passed.findIndex(x=>!x):visible.turn;
   const own=(await call(f.service,actor,{op:'snapshot',roomId:snapshot.roomId})).snapshot,s=own.view.state;
   assert.equal(s.seed,undefined);assert.equal(s.initialSeed,undefined);assert.equal(s.stock,undefined);assert.equal(s.bag,undefined);if(s.hands)for(let n=0;n<seats;n++)if(n!==actor)assert.equal(s.hands[n],null);
   const action=choice(game,s,actor,steps);assert.ok(action,game+' supplied no legal test-client action');delete action.player;
   body={op:'action',roomId:own.roomId,expectedVersion:own.revision,requestId:randomUUID(),action};latest=await call(f.service,actor,body);snapshot=latest.snapshot;steps++;
   if(steps===3){assert.deepEqual((await call(f.service,actor,body)).receipt,latest.receipt);await assert.rejects(call(f.service,actor,{...body,action:{type:'invalid'}}),/REQUEST_PAYLOAD_CONFLICT/);}
  }
  assert.ok(steps>0);assert.equal(snapshot.financialExecutionEnabled,false);assert.deepEqual((await call(f.service,actor,body)).receipt,latest.receipt);
  await assert.rejects(call(f.service,actor,{op:'action',roomId:snapshot.roomId,expectedVersion:snapshot.revision,requestId:randomUUID(),action:{type:'next'}}),/GAME_ACTION_REJECTED/);
  t.diagnostic(JSON.stringify({game,steps,revision:snapshot.revision,scores:snapshot.view.state.scores,result:snapshot.view.state.message,financialExecutionEnabled:false}));
 }finally{await f.db.close();}
});
test('new games cannot turn trick bids into monetary amounts or grant arbitrary game engines',async()=>{const f=await fixture();try{for(const game of ['unreviewed','wallet','slots','external','bowling'])await assert.rejects(call(f.service,0,{op:'create',game,requestId:randomUUID()}),/GAME_NOT_REVIEWED/);const s=await room(f.service,'pinochle',4);for(const amount of [-1,251,'100',{value:50}])await assert.rejects(call(f.service,s.view.state.turn,{op:'action',roomId:s.roomId,expectedVersion:s.revision,requestId:randomUUID(),action:{type:'bid',amount}}),/INVALID_NONMONETARY_BID/);}finally{await f.db.close();}});
