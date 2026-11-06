import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {fixture,call,room} from './helpers/pvpHostedFixture.mjs';
import {modules} from '../supabase/functions/pvp-games-review/runtime/engine.mjs';
import {onlineGames} from '../supabase/functions/pvp-games-review/service.mjs';
import {raiseLimit} from '../supabase/functions/pvp-games-review/runtime/dist/games/poker-core.js';
const casino=new Set(['blackjack','roulette','craps','baccarat']);
const games=Object.keys(onlineGames).filter(id=>casino.has(id)||/^(poker|omaha)/.test(id)||['pineapple6','crazy6','lazy6','stud5','draw5','progressive5','triple27'].includes(id));
for(const game of games)test('server-controlled authored '+game+' match, private cards and nonfinancial receipts',{timeout:120000},async t=>{
 const f=await fixture();try{let snap=await room(f.service,game,onlineGames[game]),steps=0,rounds=0,lastRound=snap.view.state.round,body,last,actor;
 while(casino.has(game)?rounds<8:!snap.view.state.over){assert.ok(steps++<6000,game+' did not finish');actor=snap.view.state.phase==='round'?0:snap.view.state.turn;
 const own=(await call(f.service,actor,{op:'snapshot',roomId:snap.roomId})).snapshot,s=own.view.state;
 for(const name of ['seed','initialSeed','stock','muck','burned','discarded'])assert.equal(s[name],undefined,name+' leaked');
 if(!casino.has(game)){for(let n=0;n<onlineGames[game];n++)if(n!==actor&&!s.revealed.includes(n)){if(game==='stud5'){assert.equal(s.hands[n][0],null);assert.equal(s.hands[n].slice(1).every(Boolean),true);}else assert.equal(s.hands[n],null);}
 assert.equal(s.stacks.reduce((x,y)=>x+y,0)+(s.phase==='round'||s.over?0:s.contributions.reduce((x,y)=>x+y,0)),onlineGames[game]*1000,'table chips were created/lost');}
 if(game==='blackjack'&&s.phase==='play'){assert.equal(s.hands[1],null);assert.ok(s.dealerUpcard);}
 let action;if(s.phase==='round')action={type:'next'};else if(casino.has(game))action=modules[game].bot(s);else if(['opening','draw','discard'].includes(s.phase))action=modules[game].bot(s);else{const max=raiseLimit(s,actor);action=max>s.currentBet&&((max-s.currentBet>=s.minRaise)||max===s.bets[actor]+s.stacks[actor])&&(s.lastActBet[actor]===null||s.currentBet-s.lastActBet[actor]>=s.minRaise)?{type:'raise',to:max}:{type:'call'};}
 body={op:'action',roomId:snap.roomId,expectedVersion:snap.revision,requestId:randomUUID(),action};last=await call(f.service,actor,body);snap=last.snapshot;assert.equal(snap.financialExecutionEnabled,false);assert.equal(snap.view.practiceOnly,true);
 if(snap.view.state.phase==='round'&&snap.view.state.round!==lastRound){rounds++;lastRound=snap.view.state.round;}
 if(steps===2){assert.deepEqual((await call(f.service,actor,body)).receipt,last.receipt);await assert.rejects(call(f.service,actor,{...body,action:{type:'invalid'}}),/REQUEST_PAYLOAD_CONFLICT/);}
 }
 assert.ok(steps>=2);assert.deepEqual((await call(f.service,actor,body)).receipt,last.receipt);t.diagnostic(JSON.stringify({game,steps,rounds,terminal:snap.view.state.over,financialExecutionEnabled:false}));
 }finally{await f.db.close();}
});
test('casino practice amount bounds and caller financial authority are rejected',async()=>{const f=await fixture();try{await assert.rejects(call(f.service,0,{op:'create',game:'progressive5',requestId:randomUUID()}),/GAME_NOT_REVIEWED/);const s=await room(f.service,'blackjack',1);for(const amount of [-1,0,101,102,1e9,'10'])await assert.rejects(call(f.service,0,{op:'action',roomId:s.roomId,expectedVersion:s.revision,requestId:randomUUID(),action:{type:'bet',amount}}),/INVALID_NONMONETARY_BID/);for(const field of ['wallet','balance','payout','credits','player','role'])await assert.rejects(call(f.service,0,{op:'action',roomId:s.roomId,expectedVersion:s.revision,requestId:randomUUID(),action:{type:'bet',amount:10,[field]:100}}),/CALLER_AUTHORITY_FORBIDDEN/);}finally{await f.db.close();}});

test('roulette accepts only actual betting spots and fixed practice denominations',async()=>{const f=await fixture();try{const s=await room(f.service,'roulette',1);for(const action of [{type:'placeChip',spot:'constructor',cents:100},{type:'placeChip',spot:'__proto__',cents:100},{type:'placeChip',spot:'red',cents:-10},{type:'placeChip',spot:'red',cents:100000000}])await assert.rejects(call(f.service,0,{op:'action',roomId:s.roomId,expectedVersion:s.revision,requestId:randomUUID(),action}),/GAME_ACTION_REJECTED/);}finally{await f.db.close();}});

test('poker folded cards stay private after uncontested settlement',async()=>{const f=await fixture();try{let s=await room(f.service,'poker2',2);const actor=s.view.state.turn;s=(await call(f.service,actor,{op:'action',roomId:s.roomId,expectedVersion:s.revision,requestId:randomUUID(),action:{type:'fold'}})).snapshot;assert.equal(s.view.state.phase,'round');const other=(await call(f.service,1-actor,{op:'snapshot',roomId:s.roomId})).snapshot;assert.equal(other.view.state.hands[actor],null);assert.equal(other.view.state.stock,undefined);}finally{await f.db.close();}});

test('server poker settles unequal side pots and requires exactly two Omaha hole cards',async()=>{const {settle,bestOmaha,best}=await import('../supabase/functions/pvp-games-review/runtime/dist/games/poker-core.js');const card=(r,s)=>({r,s,id:s+r});const state={players:4,stacks:[900,800,700,1000],contributions:[100,200,300,0],folded:[false,false,false,true],dealer:3,board:[card(7,'S'),card(7,'H'),card(2,'C'),card(3,'D'),card(4,'H')],hands:[[card(1,'C'),card(1,'D')],[card(13,'C'),card(13,'D')],[card(12,'C'),card(12,'D')],[]],log:[]};settle(state);assert.deepEqual(state.awards,[300,200,100,0]);assert.equal(state.stacks.reduce((a,b)=>a+b,0),4000);assert.equal(state.pots.at(-1).kind,'uncalled_return');const hole=[card(1,'C'),card(1,'S'),card(13,'C'),card(13,'S')],board=[2,3,4,5,6].map(r=>card(r,'H'));assert.equal(best([...hole,...board])[0],8);assert.equal(bestOmaha(hole,board)[0],1);});
