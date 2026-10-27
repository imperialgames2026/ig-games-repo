// REVIEW ONLY. Actual authenticated HTTP callback + approved async SQL provider.
// No imports, globals or fake responses can make this suite execute by itself.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const uuid=x=>{assert.match(x,/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i);return x;};
export function payoutCredit(before,after,recorded){
 for(const n of [before,after,recorded])assert.ok(Number.isSafeInteger(n)&&n>=0,'invalid accounting units');
 assert.equal(after-before,recorded,'settled return differs from balance credit');
}
export async function settlementAcceptance({run,players,call,db,operatorCorrectionFixture=false,operator=null}){
 if(process.env.IG_SYNTHETIC_STACK_APPROVED!=='1'||db?.run!==run||!/^[a-f0-9]{32}$/.test(run))throw Error('explicit isolated test execution required');
 assert.equal(players.length,2);for(const p of players){uuid(p.id);assert.equal(p.phase,'lifecycle');assert.ok(p.email.endsWith('@example.invalid'));}assert.notEqual(players[0].id,players[1].id);
 const [a,b]=players;const evidence=[],trace=[],races=[];
 const sql=t=>db.sql(t),num=async t=>Number(await sql(t));
 const count=()=>num('select count(*) from ig_practice_audit.entries');
 const reconcile=async()=>assert.equal(await num('select count(*) from ig_practice_audit.reconciliation where not consistent'),0);
 // Isolated fresh lifecycle must precede browser actors/rounds. No reset fallback.
 assert.equal(await num('select count(*) from ig_mp_bets'),0);assert.equal(await num('select count(*) from ig_bj_receipts'),0);assert.equal(await num('select count(*) from ig_event_bets'),0);assert.equal(await num('select count(*) from ig_crash_v2_bets'),0);
 const request=async(user,slug,body)=>{const result=await call(user,slug,body,200);return result;};
 const wager=async(user,slug,body,game)=>{
  const id=uuid(body.requestId??body.actionId);const before=await count();const result=await request(user,slug,body);
  const first=await count();assert.ok(first>before,'accepted wager must have journal entries');
  await request(user,slug,body);assert.equal(await count(),first,'exact HTTP replay posted twice');
  const rows=JSON.parse(await sql(`select json_build_object('posts',count(*),'delta',coalesce(sum(delta),0)) from ig_practice_audit.entries where actor_id='${user.id}' and request_ref='${id}' and game='${game}'`));
  assert.ok(rows.posts>0);const expectedDelta=slug==='poker-table-v1'?0:-body.units;assert.equal(Number(rows.delta),expectedDelta,'native accounting delta');trace.push({actorId:user.id,requestId:id,game,observedPosts:rows.posts,observedDelta:rows.delta,expectedDelta});await reconcile();return result;
 };
 for(const variant of ['holdem','omaha']){
  const {tableId}=await request(a,'poker-table-v1',{action:'create',variant});uuid(tableId);
  await request(b,'poker-table-v1',{action:'join',tableId});await request(a,'poker-table-v1',{action:'start',tableId});
  const snap=await request(a,'poker-table-v1',{action:'snapshot',tableId});const actor=players.find(p=>snap.seats.some(s=>s.user_id===p.id&&s.seat_no===snap.table.turnIndex));assert.ok(actor);
  await wager(actor,'poker-table-v1',{action:'act',tableId,actionId:randomUUID(),version:snap.table.version,move:'fold',amount:0},variant==='holdem'?'poker':'omaha');
  assert.equal(await num(`select sum(stack+committed) from poker_seats_v1 where table_id='${tableId}'`),2000);assert.equal(await num(`select sum(committed) from poker_seats_v1 where table_id='${tableId}'`),0);
  evidence.push({game:variant,settled:true,potConserved:2000,actualHttp:true});
 }
 // Baccarat: cover all three outcomes with real bets, never set RNG/result.
 await request(a,'ig-shared-event-practice',{game:'baccarat',action:'join'});
 await sql("update ig_event_tables set betting_closes_at=clock_timestamp()+interval '1 hour' where game='baccarat'");
 for(const target of ['player','banker','tie'])await wager(a,'ig-shared-event-practice',{game:'baccarat',action:'bet',requestId:randomUUID(),target,units:1},'baccarat');
 const baccarat=await request(a,'ig-shared-event-practice',{game:'baccarat',action:'state'});const controller=players.find(p=>p.id===baccarat.state.shooterId);assert.ok(controller);
 await sql("update ig_event_tables set betting_closes_at=clock_timestamp()-interval '1 second' where game='baccarat'");
 const baccaratBefore=await num(`select chips from ig_event_seats where game='baccarat' and user_id='${a.id}'`);
 const resolve={game:'baccarat',action:'resolve',requestId:randomUUID(),expectedRound:baccarat.state.round};await request(controller,'ig-shared-event-practice',resolve);const baccaratAfter=await num(`select chips from ig_event_seats where game='baccarat' and user_id='${a.id}'`);payoutCredit(baccaratBefore,baccaratAfter,await num(`select coalesce(sum(paid_units),0) from ig_event_bets where game='baccarat' and placed_round=${baccarat.state.round} and user_id='${a.id}'`));const paid=await count();await request(controller,'ig-shared-event-practice',resolve);assert.equal(await count(),paid);await reconcile();
 evidence.push({game:'baccarat',settled:true,actualHttp:true,positivePayoutObserved:await num("select coalesce(sum(paid_units),0) from ig_event_bets where game='baccarat'")>0});
 // Blackjack: real dealer/turn transitions; deadline fixture changes clock only.
 await request(a,'ig-blackjack-practice',{action:'join'});await request(b,'ig-blackjack-practice',{action:'join'});await sql("update ig_bj_table set betting_closes_at=clock_timestamp()+interval '1 hour'");
 await wager(a,'ig-blackjack-practice',{action:'bet',requestId:randomUUID(),units:1,target:'main'},'blackjack');
 let bj=(await request(a,'ig-blackjack-practice',{action:'state'})).state;const dealer=players.find(p=>p.id===bj.controllerId);assert.ok(dealer);const round=bj.round;
 await sql("update ig_bj_table set betting_closes_at=clock_timestamp()-interval '1 second'");await request(dealer,'ig-blackjack-practice',{action:'deal',requestId:randomUUID(),expectedRound:round});
 for(let i=0;i<20;i++){bj=(await request(a,'ig-blackjack-practice',{action:'state'})).state;if(bj.phase!=='playing')break;const actor=players.find(p=>p.id===bj.turnActor);assert.ok(actor);await request(actor,'ig-blackjack-practice',{action:'stand',requestId:randomUUID(),expectedRound:round});}
 bj=(await request(a,'ig-blackjack-practice',{action:'state'})).state;assert.equal(bj.phase,'showdown');const bjBefore=await num('select sum(chips) from ig_bj_seats');const bjResolve={action:'resolve',requestId:randomUUID(),expectedRound:round};await request(dealer,'ig-blackjack-practice',bjResolve);payoutCredit(bjBefore,await num('select sum(chips) from ig_bj_seats'),await num(`select coalesce(sum((s->>'returned')::bigint+(s->>'pairsReturned')::bigint),0) from ig_bj_history h cross join lateral jsonb_array_elements(h.settled->'seats') s where h.round_no=${round}`));const bjPaid=await count();await request(dealer,'ig-blackjack-practice',bjResolve);assert.equal(await count(),bjPaid);await reconcile();evidence.push({game:'blackjack',settled:true,actualHttp:true});
 // Roulette: house result and credits remain native; 37 bets assure a payout.
 await request(a,'ig-multiplayer-practice',{game:'roulette',action:'join'});await sql("update ig_mp_tables set betting_closes_at=clock_timestamp()+interval '1 hour',presentation_ends_at=clock_timestamp()+interval '2 hours' where game='roulette'");
 for(let n=0;n<37;n++)await wager(a,'ig-multiplayer-practice',{game:'roulette',action:'bet',requestId:randomUUID(),target:'number_'+n,units:1},'roulette');
 const rouletteRequest={game:'roulette',action:'bet',requestId:randomUUID(),target:'red',units:1};
 const outcomes=await Promise.all([request(a,'ig-multiplayer-practice',rouletteRequest),request(a,'ig-multiplayer-practice',rouletteRequest)]);assert.equal(outcomes.length,2);
 assert.equal(await num(`select count(*) from ig_mp_bets where game='roulette' and user_id='${a.id}' and request_id='${rouletteRequest.requestId}'`),1);
 await sql("update ig_mp_tables set betting_closes_at=clock_timestamp()-interval '1 second',presentation_ends_at=clock_timestamp()+interval '1 hour' where game='roulette';select ig_internal.roulette_tick();update ig_mp_tables set presentation_ends_at=clock_timestamp()-interval '1 second' where game='roulette'");
 const rouletteBefore=await num(`select chips from ig_mp_players where game='roulette' and user_id='${a.id}'`);const rouletteRound=await num("select round_no from ig_mp_tables where game='roulette'");const beforePayout=await count();races.push(await db.race('roulette house settlement',['select ig_internal.roulette_tick()','select ig_internal.roulette_tick()'],2));payoutCredit(rouletteBefore,await num(`select chips from ig_mp_players where game='roulette' and user_id='${a.id}'`),await num(`select coalesce(sum(paid_units),0) from ig_mp_bets where game='roulette' and placed_round=${rouletteRound} and user_id='${a.id}'`));assert.ok(await count()>beforePayout);const afterPayout=await count();await sql('select ig_internal.roulette_tick()');assert.equal(await count(),afterPayout);await reconcile();evidence.push({game:'roulette',settled:true,actualHttpWagers:true,actualSqlHouseTick:true});
 // Craps: actual shooter HTTP roll, native dice and settlement; payout may be0.
 await request(a,'ig-multiplayer-practice',{game:'craps',action:'join',mode:'shooter'});await sql("update ig_mp_tables set betting_closes_at=clock_timestamp()+interval '1 hour' where game='craps'");await wager(a,'ig-multiplayer-practice',{game:'craps',action:'bet',requestId:randomUUID(),target:'field',units:1},'craps');
 const craps=(await request(a,'ig-multiplayer-practice',{game:'craps',action:'state'})).state;await sql("update ig_mp_tables set betting_closes_at=clock_timestamp()-interval '1 second' where game='craps'");const crapsBefore=await num(`select chips from ig_mp_players where game='craps' and user_id='${a.id}'`);const roll={game:'craps',action:'roll',requestId:randomUUID(),expectedRound:craps.round};await request(a,'ig-multiplayer-practice',roll);payoutCredit(crapsBefore,await num(`select chips from ig_mp_players where game='craps' and user_id='${a.id}'`),await num(`select coalesce(sum(paid_units),0) from ig_mp_bets where game='craps' and placed_round=${craps.round} and user_id='${a.id}'`));const rolled=await count();await request(a,'ig-multiplayer-practice',roll);assert.equal(await count(),rolled);await reconcile();evidence.push({game:'craps',settled:true,actualHttp:true});
 // Grant retry/concurrency is SQL-only, distinct from public HTTP refund policy.
 await sql(`update ig_mp_players set chips=50 where game='craps' and user_id='${a.id}'`);const grant=randomUUID();const beforeGrant=await count();races.push(await db.race('same practice grant',[`select ig_mp_craps_refill('${a.id}','${grant}')`,`select ig_mp_craps_refill('${a.id}','${grant}')`],2));assert.equal(await count(),beforeGrant+1);
 // Crash and Trenball share a native committed round. No outcome/seed override.
 await request(a,'ig-crash-v2',{action:'join'});await sql("update ig_crash_v2_runtime set betting_ends_at=clock_timestamp()+interval '1 hour',started_at=clock_timestamp()+interval '1 hour',crashes_at=clock_timestamp()+interval '2 hours'");
 const crash=(await request(a,'ig-crash-v2',{action:'state'})).state;for(const [mode,target] of [['crash_auto',1.5],['tren_red',null],['tren_green',null]])await wager(a,'ig-crash-v2',{action:'bet',round:crash.round,requestId:randomUUID(),mode,target,units:1},'crash-trenball');
 const crashBefore=await num(`select chips from ig_crash_v2_seats where user_id='${a.id}'`);await sql("update ig_crash_v2_runtime set betting_ends_at=clock_timestamp()-interval '2 seconds',started_at=clock_timestamp()-interval '2 seconds',crashes_at=clock_timestamp()-interval '1 second'");races.push(await db.race('Crash/Trenball house settlement',['select ig_crash_v2_tick()','select ig_crash_v2_tick()'],2));payoutCredit(crashBefore,await num(`select chips from ig_crash_v2_seats where user_id='${a.id}'`),await num(`select coalesce(sum(paid_units),0) from ig_crash_v2_bets where round_no=${crash.round} and user_id='${a.id}'`));const crashPaid=await count();await sql('select ig_crash_v2_tick()');assert.equal(await count(),crashPaid);await reconcile();
 for(const game of ['crash','trenball'])evidence.push({game,settled:true,actualHttpWagers:true,actualSqlHouseTick:true,fixtureClockOnly:true,fairnessVerified:false});
 const charge=randomUUID(),beforeCharge=await count();await sql("update ig_mp_tables set betting_closes_at=clock_timestamp()+interval '1 hour' where game='roulette'");
 races.push(await db.race('same native charge receipt',[`select ig_mp_action('${a.id}','roulette','bet','${charge}','red',1)`,`select ig_mp_action('${a.id}','roulette','bet','${charge}','red',1)`],2));assert.equal(await count(),beforeCharge+1);await reconcile();
 // Deliberate failing transaction must restore BOTH source balance and journal.
 await sql("update ig_mp_tables set betting_closes_at=clock_timestamp()+interval '1 hour' where game='roulette'");
 const balance=await num(`select chips from ig_mp_players where game='roulette' and user_id='${a.id}'`),beforeFailure=await count();
 const failed=await db.result(`begin;update ig_mp_players set chips=0 where game='roulette' and user_id='${a.id}';select ig_mp_action('${a.id}','roulette','bet','${randomUUID()}','red',1);commit;`);assert.notEqual(failed.code,0);assert.match(failed.err,/insufficient practice chips/i);assert.equal(await count(),beforeFailure);assert.equal(await num(`select chips from ig_mp_players where game='roulette' and user_id='${a.id}'`),balance);await reconcile();
 // Finish the extra SQL receipt's live roulette wager before leaving naturally.
 await sql("update ig_mp_tables set betting_closes_at=clock_timestamp()-interval '1 second',presentation_ends_at=clock_timestamp()+interval '1 hour' where game='roulette';select ig_internal.roulette_tick();update ig_mp_tables set presentation_ends_at=clock_timestamp()-interval '1 second' where game='roulette';select ig_internal.roulette_tick()");
 await reconcile();
 let compensation='UNSUPPORTED_NO_PUBLIC_POLICY';
 if(operatorCorrectionFixture){
  assert.ok(operator&&operator.phase==='lifecycle');uuid(operator.id);assert.ok(!players.some(p=>p.id===operator.id));assert.equal(await num(`select count(*) from user_roles where user_id='${operator.id}' and role='superadmin'`),1);
  const original=JSON.parse(await sql(`select json_build_object('id',id::text,'delta',delta) from ig_practice_audit.entries where source='ig_mp_players' and game='roulette' and player_id='${a.id}' and kind='wager' order by id limit 1`));assert.equal(original.delta,-1);assert.match(original.id,/^\d+$/);const id=randomUUID();
  const context=JSON.stringify({actor:operator.id,request:id,operation:'synthetic operator compensation fixture',kind:'refund',reversesId:original.id,reason:'test fixture only; not public cancellation'});
  const refund=`begin;select set_config('ig.practice_audit_context','${context}',true);update ig_mp_players set chips=chips+1 where game='roulette' and user_id='${a.id}';commit;`;
  await sql(refund);const corrected=await count();const duplicate=await db.result(refund);assert.notEqual(duplicate.code,0);assert.equal(await count(),corrected);await reconcile();compensation='OPERATOR_SQL_FIXTURE_ONLY';
 }
 for(const user of [a,b])await request(user,'ig-blackjack-practice',{action:'leave'});
 await request(a,'ig-shared-event-practice',{game:'baccarat',action:'leave'});
 for(const game of ['craps','roulette'])await request(a,'ig-multiplayer-practice',{game,action:'leave'});
 await request(a,'ig-crash-v2',{action:'leave'});await reconcile();
 return {status:'PASS_BOUNDED_LIFECYCLE',evidence,trace,races,rollback:true,compensation,publicCancellationRefund:false,fullAccountingAcceptance:false,remaining:['positive manual Crash cashout case','Blackjack sidebet and all game payout branches','public cancellation/refund policy','all denied/failed actor permutations','tournament seat lifecycle real Auth HTTP','realtime broadcast','fairness proof after clock fixtures']};
}
