import assert from 'node:assert/strict';import {randomUUID,randomBytes} from 'node:crypto';
import {payoutExtension} from './payout-extension/phases.mjs';
import {createManualCashoutAttempt} from './payout-extension/attempt.mjs';
import {tournamentShowdown} from '../tournament-showdown/phase.mjs';
import {protocolAcceptance} from './protocol-acceptance.mjs';
import {fixedCapacityAcceptance} from './fixed-capacity-acceptance.mjs';
import {tournamentSeating} from './tournament-seating.mjs';
import {settlementAcceptance} from './accounting-lifecycle/settlement.mjs';
import {fixturePlan} from './policy.mjs';
import {seedAuth} from './fixtures.mjs';import {verifyLoginAndRecovery} from './browser-journeys.mjs';import {verifyEightGames} from './game-journeys.mjs';import {verifyFreeRegistration} from './tournament-journey.mjs';
export async function acceptance({run,anon,service,browser,sql,db,record=()=>{},slice='full'}){
 if(process.env.IG_SYNTHETIC_STACK_APPROVED!=='1')throw Error('runtime approval interlock missing');
 const origin='http://127.0.0.1:54321';
 const provision=async phase=>{
 const passwords=Array.from({length:fixturePlan(run,phase).length},()=>randomBytes(32).toString('base64url'));
 const users=await seedAuth({origin,run,serviceKey:service,passwords,phase});
 for(const [i,u]of users.entries()){
  assert.match(u.id,/^[a-f0-9-]{36}$/i);u.password=passwords[i];
  // Only these captured synthetic UUIDs are canonical fixture targets.
  if(u.kind==='admin')sql(`update public.user_roles set role='superadmin' where user_id='${u.id}';`);
  if(u.kind==='tester')sql(`update public.user_roles set role='tester' where user_id='${u.id}';`);
  if(u.kind==='excluded')sql(`update public.profiles set is_excluded=true where id='${u.id}';`);
  const r=await fetch(origin+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:anon,'content-type':'application/json'},body:JSON.stringify({email:u.email,password:u.password}),signal:AbortSignal.timeout(10000)});assert.equal(r.status,200);const d=await r.json();assert.equal(d.user.id,u.id);assert.ok(d.access_token);u.token=d.access_token;
 }
 return users;};
 const call=async(user,slug,body,expected=200)=>{
  const r=await fetch(origin+'/functions/v1/'+slug,{method:'POST',headers:{apikey:anon,'content-type':'application/json',...(user?{authorization:'Bearer '+user.token}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});assert.equal(r.status,expected,`${slug} ${body.action}`);return r.json();
 };
 if(!['full','seating','formats','protocol','showdown','extended'].includes(slice))throw Error('unsupported acceptance slice');
 if(['protocol','showdown','extended'].includes(slice)){
  let protocol=null,showdown=null;
  if(slice!=='showdown'){const users=await provision('protocol');protocol=await protocolAcceptance({run,users,call,db,browser,record});record('protocol',protocol);}
  if(slice!=='protocol'){const users=await provision('showdown');showdown=await tournamentShowdown({run,users,call,db,maxCycles:3,record});}
  const ledger=JSON.parse(await db.sql("select json_build_object('components',count(*),'inconsistent',count(*)filter(where not consistent),'liveUnits',coalesce(sum(balance),0),'journalUnits',coalesce(sum(journal_balance),0)) from ig_practice_audit.reconciliation"));assert.equal(Number(ledger.inconsistent),0);assert.equal(Number(ledger.liveUnits),Number(ledger.journalUnits));record('final-reconciliation',ledger);return {slice,protocol,showdown,ledger,releaseReady:false};
 }
 if(['seating','formats'].includes(slice)){
  const users=await provision('tournament');
  const seating=slice==='seating'?await tournamentSeating({run,users,call,db,browser,record}):null;if(seating)record('tournament-seating',seating);
  const formats=await fixedCapacityAcceptance({run,users,call,db,browser,record});record('fixed-formats',formats);
  const ledger=JSON.parse(await db.sql("select json_build_object('components',count(*),'inconsistent',count(*)filter(where not consistent),'liveUnits',coalesce(sum(balance),0),'journalUnits',coalesce(sum(journal_balance),0)) from ig_practice_audit.reconciliation"));
  assert.equal(Number(ledger.inconsistent),0);assert.equal(Number(ledger.liveUnits),Number(ledger.journalUnits));assert.ok(ledger.components>0);record('final-reconciliation',ledger);
  return {slice,tournamentSeating:seating,fixedFormats:formats,ledger,releaseReady:false};
 }
 const lifecycle=await provision('lifecycle');const accounting=await settlementAcceptance({run,players:lifecycle.filter(u=>u.kind.startsWith('player-')),call,db,operatorCorrectionFixture:false});record('bounded-accounting',accounting);
 const payoutUsers=await provision('payout');const payouts=await payoutExtension({run,players:payoutUsers.filter(u=>u.kind.startsWith('player-')),call,attempt:createManualCashoutAttempt({origin,anon}),db,maxBlackjackRounds:12,maxCrashRounds:6});record('payout-extension',payouts);
 const users=await provision('browser');
 const players=users.filter(u=>u.kind.startsWith('player-')),admin=users.find(u=>u.kind==='admin');
 await call(null,'ig-blackjack-practice',{action:'join'},401);
 for(const u of users.filter(u=>['tester','excluded'].includes(u.kind)))await call(u,'ig-blackjack-practice',{action:'join'},403);
 await call(players[0],'ig-blackjack-practice',{action:'join',actor:players[1].id},400);
 const headers={apikey:anon,authorization:'Bearer '+players[0].token};
 const own=await fetch(origin+`/rest/v1/profiles?id=eq.${players[1].id}&select=id`,{headers,signal:AbortSignal.timeout(10000)});assert.equal(own.status,200);assert.deepEqual(await own.json(),[]);
 const role=await fetch(origin+`/rest/v1/user_roles?user_id=eq.${players[0].id}`,{method:'PATCH',headers:{...headers,'content-type':'application/json'},body:JSON.stringify({role:'superadmin'}),signal:AbortSignal.timeout(10000)});assert.ok([401,403].includes(role.status));record('auth-rls',{invalidSessionDenied:true,testerExcludedDenied:true,forgedActorDenied:true,otherOwnerProfileHidden:true,roleEscalationDenied:true});
 const login=await verifyLoginAndRecovery({browser,email:players[0].email,password:players[0].password});record('browser-auth',login);
 const pokerTables={};for(const variant of ['holdem','omaha']){const t=await call(players[0],'poker-table-v1',{action:'create',variant});assert.match(t.tableId,/^[a-f0-9-]{36}$/i);pokerTables[variant]=t.tableId;}
 const observeWager=async(g,user,body)=>{
  const id=body.requestId??body.actionId;assert.match(id,/^[a-f0-9-]{36}$/i);assert.match(user.id,/^[a-f0-9-]{36}$/i);
  const game=({PlayPoker:'poker',PlayOmaha:'omaha',PlayBlackjack:'blackjack',PlayBaccarat:'baccarat',PlayCraps:'craps',PlayRoulette:'roulette',PlayCrash:'crash-trenball',PlayTrenball:'crash-trenball'})[g.route];assert.ok(game);
  const q=JSON.parse(await db.sql(`select json_build_object('posts',count(*),'delta',coalesce(sum(delta),0)) from ig_practice_audit.entries where actor_id='${user.id}' and request_ref='${id}' and game='${game}'`));assert.ok(q.posts>0);assert.equal(Number(q.delta),g.poker?0:-body.units);return {actorId:user.id,requestId:id,game,posts:q.posts,delta:Number(q.delta)};
 };
 const games=await verifyEightGames({browser,players,pokerTables,record,observeWager,prepareGame:async g=>{if(g.route==='PlayRoulette'){const ticks=[];for(let attempt=0;attempt<8;attempt++){const tick=JSON.parse(await db.sql('select ig_internal.roulette_tick()'));ticks.push(tick);if(tick.phase==='betting')break;assert.ok(['spinning','busy'].includes(tick.phase));await new Promise(resolve=>setTimeout(resolve,1000));}assert.equal(ticks.at(-1).phase,'betting','native house cycle must reopen before browser wager');record('browser-roulette-house-tick',{nativeController:true,clockOverrides:false,ticks,realtimeVerified:false});}}});
 const name='Synthetic '+run;const created=await call(admin,'admin-poker-events',{action:'create',requestId:randomUUID(),name,format:'scheduled_mtt',config:{maxPlayers:2,seatsPerTable:2,startingStack:1000,smallBlind:5,bigBlind:10,startAt:new Date(Date.now()+3600000).toISOString(),levels:[{level:1,smallBlind:5,bigBlind:10,ante:0,durationSeconds:60}]}},201);
 assert.match(created.eventId,/^[a-f0-9-]{36}$/i);await call(admin,'admin-poker-events',{action:'publish',eventId:created.eventId,version:created.version,requestId:randomUUID()});
 const context=await browser.newContext();let tournament;
 try{
  await context.route('**/*',r=>['http://127.0.0.1:4173',origin].includes(new URL(r.request().url()).origin)?r.continue():r.abort());const page=await context.newPage();await page.goto('http://127.0.0.1:4173/login');await page.getByLabel('Email',{exact:true}).fill(players[0].email);await page.getByLabel('Password',{exact:true}).fill(players[0].password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL(u=>u.pathname!=='/login');tournament=await verifyFreeRegistration({page,eventId:created.eventId,eventName:name});
 }finally{await context.close();}
 record('tournament',tournament);const tournamentUsers=await provision('tournament');const seating=await tournamentSeating({run,users:tournamentUsers,call,db,browser,record});record('tournament-seating',seating);const fixedFormats=await fixedCapacityAcceptance({run,users:tournamentUsers,call,db,browser,record});record('fixed-formats',fixedFormats);const ledger=JSON.parse(await db.sql("select json_build_object('components',count(*),'inconsistent',count(*)filter(where not consistent),'liveUnits',coalesce(sum(balance),0),'journalUnits',coalesce(sum(journal_balance),0)) from ig_practice_audit.reconciliation"));assert.equal(Number(ledger.inconsistent),0);assert.equal(Number(ledger.liveUnits),Number(ledger.journalUnits));assert.ok(ledger.components>0);record('final-reconciliation',ledger);return {login,games,tournament,authorizationAndRls:true,boundedAccounting:accounting,payoutExtension:payouts,tournamentSeating:seating,fixedFormats,settlementLedgerConcurrency:false,releaseReady:false};
}
