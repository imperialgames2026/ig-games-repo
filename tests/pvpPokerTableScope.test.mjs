import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {readFileSync} from 'node:fs';
import {fixture,call,actors} from './helpers/pvpHostedFixture.mjs';
import {onlineGames} from '../supabase/functions/pvp-games-review/service.mjs';
import {pendingPvpGames} from '../lib/pvpIntegration.mjs';
import {raiseLimit} from '../supabase/functions/pvp-games-review/runtime/dist/games/poker-core.js';
const mutate=(s,n,body)=>call(s,n,{...body,requestId:randomUUID()});
test('published poker formats are exactly 2,4,6,8,9 seats; seven-max aliases cannot be created',async()=>{for(const prefix of ['poker','omaha']){assert.deepEqual(pendingPvpGames.filter(g=>g.id.startsWith(prefix)).map(g=>g.seats),[2,4,6,8,9]);assert.equal(onlineGames[prefix+'7'],undefined);}const models=readFileSync(new URL('../review/pvp-runtime/dist/model-view.js',import.meta.url),'utf8');assert.equal(models.includes('NLHE_7'),false);const f=await fixture();try{for(const game of ['poker7','omaha7','bowling','progressive5'])await assert.rejects(mutate(f.service,0,{op:'create',game}),/GAME_NOT_REVIEWED/);for(const [game,players]of [['poker2',7],['poker8',6],['poker9',8],['omaha8','7'],['chess',7],['poker8',0]])await assert.rejects(mutate(f.service,0,{op:'create',game,players}),/INVALID_PLAYER_COUNT/);}finally{await f.db.close();}});
for(const game of ['poker8','poker9','omaha8','omaha9'])test('seven participants complete a match using the approved '+game+' physical table',{timeout:60000},async t=>{const f=await fixture();try{
 const capacity=onlineGames[game],create={op:'create',game,players:7,requestId:randomUUID()};let result=await call(f.service,0,create),snapshot=result.snapshot,id=snapshot.roomId;
 assert.deepEqual((await call(f.service,0,create)).receipt,result.receipt);await assert.rejects(call(f.service,0,{...create,players:capacity}),/REQUEST_PAYLOAD_CONFLICT/);
 assert.equal(snapshot.view.seats.length,capacity);assert.equal(snapshot.view.playerCount,7);assert.equal(snapshot.view.tableSeats,capacity);assert.equal(snapshot.view.state.players,7);assert.equal(snapshot.view.seats.filter(s=>s.inactive).length,capacity-7);
 for(let n=1;n<7;n++){snapshot=(await mutate(f.service,0,{op:'invite',roomId:id,targetId:actors[n].id,expectedVersion:snapshot.revision})).snapshot;snapshot=(await mutate(f.service,n,{op:'join',roomId:id,seat:n,expectedVersion:snapshot.revision})).snapshot;}
 snapshot=(await mutate(f.service,0,{op:'invite',roomId:id,targetId:actors[7].id,expectedVersion:snapshot.revision})).snapshot;
 await assert.rejects(mutate(f.service,7,{op:'join',roomId:id,seat:7,expectedVersion:snapshot.revision}),/SEAT_UNAVAILABLE/);
 const spectator=(await call(f.service,7,{op:'snapshot',roomId:id})).snapshot;assert.equal(spectator.view.seat,-1);assert.equal(spectator.view.state.hands.every(h=>h===null),true);
 await assert.rejects(mutate(f.service,7,{op:'action',roomId:id,expectedVersion:snapshot.revision,action:{type:'call'}}),/GAME_ACTION_REJECTED/);
 const raw=(await f.db.query("select jsonb_array_length(data->'state'->'hands') as players,jsonb_array_length(data->'seats') as slots from ig_pvp_review_rooms where id=$1",[id])).rows[0];assert.deepEqual(raw,{players:7,slots:capacity});
 let moves=0;while(!snapshot.view.state.over){assert.ok(moves++<3000);const actor=snapshot.view.state.phase==='round'?0:snapshot.view.state.turn;assert.ok(actor<7);const own=(await call(f.service,actor,{op:'snapshot',roomId:id})).snapshot,s=own.view.state;
 for(let n=0;n<capacity;n++)if(n!==actor&&!s.revealed.includes(n))assert.equal(s.hands[n],null);assert.equal(s.stacks.reduce((a,b)=>a+b,0)+(s.phase==='round'||s.over?0:s.contributions.reduce((a,b)=>a+b,0)),7000);
 const max=raiseLimit(s,actor),action=s.phase==='round'?{type:'next'}:max>s.currentBet&&(max-s.currentBet>=s.minRaise||max===s.bets[actor]+s.stacks[actor])&&(s.lastActBet[actor]===null||s.currentBet-s.lastActBet[actor]>=s.minRaise)?{type:'raise',to:max}:{type:'call'};
 snapshot=(await mutate(f.service,actor,{op:'action',roomId:id,expectedVersion:own.revision,action})).snapshot;
 }
 assert.equal(snapshot.view.game,game);assert.equal(snapshot.financialExecutionEnabled,false);t.diagnostic(JSON.stringify({game,tableSeats:capacity,players:7,moves,totalChips:7000}));
 }finally{await f.db.close();}});
