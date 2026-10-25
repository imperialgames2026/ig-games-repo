import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHmac,createHash} from 'node:crypto';
import {acceptTableFairness,verifyTableRound,tableSampler,tableDeck,blackjackTotal} from '../lib/tableFairness.js';
import {verifyPracticeDice,calculatePracticeDice,sha256Hex} from '../lib/practiceFairDice.js';
import {rememberCrashCommitment,verifyCrashRound} from '../lib/crashFairness.js';
import {observeRound} from '../lib/observedRound.js';
import {finalCard,towerLayout} from '../lib/finalPracticeFairness.js';
import {saveDeviceProof} from '../lib/deviceProofStorage.js';
let db,actors;const fixtures={},q=async(sql,args=[])=>(await db.query(sql,args)).rows;
const storage=()=>{const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};};
const copy=x=>structuredClone(x);
const migration='20261025054518_table_game_fairness_and_verification.sql';
beforeAll(async()=>{
 db=new PGlite({extensions:{pgcrypto}});
 await db.exec(`create schema auth;create schema extensions;create extension pgcrypto with schema extensions;create role anon;create role authenticated;create role service_role;
 create table auth.users(id uuid primary key);create table profiles(id uuid primary key,is_excluded boolean default false);create table user_roles(user_id uuid,role text);`);
 for(const file of ['20261017200000_multiplayer_practice_tables.sql','20261017201000_multiplayer_betting_windows_and_seats.sql','20261017201500_multiplayer_idle_seat_reclamation.sql','20261017202000_crash_trenball_baccarat_practice.sql','20261017202500_extended_practice_rng.sql','20261017203000_multiplayer_blackjack_practice.sql','20261017205000_blackjack_idempotency_payload_guard.sql','20261017205500_blackjack_turn_timeouts.sql','20261018120000_craps_practice_chip_refill.sql','20261018121000_craps_shooter_queue.sql','20261018121500_craps_fifo_claim.sql','20261024024002_continuous_practice_roulette.sql','20261018234308_crash_trenball_server_timed_practice_v2.sql'])
  await db.exec(readFileSync('supabase/migrations/'+file,'utf8').replace(/^select cron.schedule\(.*$/gm,''));
 await db.exec(`update ig_bj_table set phase='playing',deck=array(select i%52 from generate_series(0,311) i);
 update ig_mp_tables set pending_result=jsonb_build_object('game','roulette','round',round_no,'number',17,'color','black'),last_result=jsonb_build_object('game','roulette','round',round_no,'number',17,'color','black') where game='roulette';`);
 await db.exec(readFileSync('supabase/migrations/'+migration,'utf8'));
 actors=(await q('insert into auth.users select gen_random_uuid() from generate_series(1,3) returning id')).map(r=>r.id);
 for(const id of actors){await q('insert into profiles values($1,false)',[id]);await q("insert into user_roles values($1,'player')",[id]);}
},30000);
afterAll(async()=>{if(process.env.IG_FAIRNESS_FIXTURE_PATH)writeFileSync(process.env.IG_FAIRNESS_FIXTURE_PATH,JSON.stringify(fixtures));await db?.close();});
const snap=async(game,store)=>{
 const sql=game==='blackjack'?'select ig_bj_state($1) s':game==='baccarat'?"select ig_event_state($1,'baccarat') s":'select ig_mp_state($1,$2) s';
 const [{s}]=await q(sql,game==='blackjack'||game==='baccarat'?[actors[0]]:[actors[0],game]);
 const checked=await acceptTableFairness(s,game,store);return checked;
};
describe('committed table games, real PostgreSQL pgcrypto and independent browser verification',()=>{
 it('does not invent proofs for legacy hands already in flight during migration',async()=>{
  expect((await q("select ig_bj_state($1) s",[actors[0]]))[0].s.fairness).toBeNull();
  expect((await q("select ig_mp_state($1,'roulette') s",[actors[0]]))[0].s.fairness).toBeNull();
  await q("update ig_mp_tables set revision=revision+1 where game='roulette'");
  expect((await q("select count(*)::int n from internal.table_fair_rounds where game='roulette'"))[0].n).toBe(0);
  await q("update ig_bj_table set round_no=round_no+1,phase='betting',deck='{}',last_result=jsonb_build_object('round',round_no),dealer_cards='{}'");
  await q("update ig_mp_tables set round_no=round_no+1,pending_result=null,betting_closes_at=clock_timestamp()+interval '1 hour' where game='roulette'");
  expect((await q("select ig_bj_state($1) s",[actors[0]]))[0].s.fairness.phase).toBe('committed');
  expect((await q("select ig_mp_state($1,'roulette') s",[actors[0]]))[0].s.fairness.phase).toBe('committed');
 });
 it('matches independent Node HMAC samples and separates games and round numbers',async()=>{
  const seed='ab'.repeat(32);
  for(const game of ['blackjack','baccarat','craps','roulette']){
   await q('select internal.table_fair_ensure($1,999)',[game]);
   const [{server_seed:s}]=await q('select server_seed from internal.table_fair_rounds where game=$1 and round_no=999',[game]);
   const sample=await tableSampler(s,game,999),bound=game==='roulette'?37:52;
   const bytes=createHmac('sha256',s).update(`table-fair-v1|${game}|999|0|0`).digest();
   expect(await sample(0,bound)).toBe(bytes.readUInt32BE(0)%bound);
   expect((await q('select internal.table_fair_sample($1,999,0,$2::int) n',[game,bound]))[0].n).toBe(await sample(0,bound));
  }
  expect(await tableDeck(seed,'blackjack',1)).not.toEqual(await tableDeck(seed,'blackjack',2));
 });
 it('runs eight interleaved rounds of all four games, with real hits, settlements, hidden seeds and saved commitments',async()=>{
  const stores=Object.fromEntries(['blackjack','baccarat','craps','roulette'].map(g=>[g,storage()]));
  await q("select ig_bj_action($1,'join')",[actors[0]]);await q("select ig_bj_action($1,'join')",[actors[1]]);
  await q("select ig_event_action($1,'baccarat','join')",[actors[0]]);
  await q("select ig_mp_action($1,'craps','join',null,'shooter')",[actors[0]]);
  await q("select ig_mp_action($1,'roulette','join')",[actors[0]]);
  for(let cycle=0;cycle<8;cycle++){
   const initial={};for(const game of Object.keys(stores)){
    if(game==='roulette')await q("update ig_mp_tables set betting_closes_at=clock_timestamp()+interval '1 hour',presentation_ends_at=clock_timestamp()+interval '2 hours' where game='roulette'");
    initial[game]=await snap(game,stores[game]);expect(initial[game].fairness.phase).toBe('committed');expect(initial[game].fairness.serverSeed).toBeUndefined();
   }
   if(cycle===0)for(const game of Object.keys(initial))fixtures[game]={committed:copy(initial[game])};
   // Both card games are open together; their shoes and commitments remain independent.
   await q("update ig_bj_table set betting_closes_at=now()+interval '1 hour'");
   for(const id of actors.slice(0,2))await q("select ig_bj_action($1,'bet',gen_random_uuid(),10,'main')",[id]);
   await q("select ig_bj_action($1,'bet',gen_random_uuid(),1,'perfect_pairs')",[actors[0]]);
   await q("select ig_event_action($1,'baccarat','bet',gen_random_uuid(),'banker',10)",[actors[0]]);
   await q("select ig_mp_action($1,'roulette','bet',gen_random_uuid(),'red',1)",[actors[0]]);
   await q("update ig_bj_table set betting_closes_at=now()-interval '1 second'");
   await q("select ig_bj_action($1,'deal',gen_random_uuid(),null,null,$2::bigint)",[actors[0],initial.blackjack.round]);
   let live=await snap('blackjack',stores.blackjack);expect(live.fairness.serverSeed).toBeUndefined();
   expect(live.fairness.layout).toHaveLength(2);if(live.phase==='playing'){expect(live.dealerCards).toHaveLength(1);expect(live.dealerHidden).toBe(true);}
   if(cycle===0)fixtures.blackjack.active=copy(live);
   for(let move=0;move<50&&live.phase==='playing';move++){
    const p=live.players.find(p=>p.id===live.turnActor),action=p.total<17?'hit':'stand';
    await q('select ig_bj_action($1,$2,gen_random_uuid(),null,null,$3::bigint)',[p.id,action,live.round]);
    live=await snap('blackjack',stores.blackjack);
   }
   expect(live.phase).toBe('showdown');
   await q("select ig_bj_action($1,'resolve',gen_random_uuid(),null,null,$2::bigint)",[actors[0],live.round]);
   await q("update ig_event_tables set betting_closes_at=now()-interval '1 second' where game='baccarat'");
   await q("select ig_event_action($1,'baccarat','resolve',gen_random_uuid(),null,null,$2::bigint)",[actors[0],initial.baccarat.round]);
   await q("update ig_mp_tables set betting_closes_at=clock_timestamp()-interval '1 second',presentation_ends_at=clock_timestamp()+interval '1 hour' where game='roulette'");
   await q('select ig_internal.roulette_tick()');
   const spinning=await snap('roulette',stores.roulette);expect(spinning.fairness.serverSeed).toBeUndefined();
   await q("update ig_mp_tables set presentation_ends_at=clock_timestamp()-interval '1 second' where game='roulette'");await q('select ig_internal.roulette_tick()');
   await q("update ig_mp_tables set betting_closes_at=now()-interval '1 second' where game='craps'");
   await q("select ig_mp_action($1,'craps','roll',gen_random_uuid(),null,null,$2::bigint)",[actors[0],initial.craps.round]);
   for(const game of Object.keys(stores)){
    const ended=await snap(game,stores[game]),proof=ended.fairnessHistory.find(p=>p.round===initial[game].round);
    expect(proof.serverSeed).toMatch(/^[a-f0-9]{64}$/);expect(ended.fairnessChecks.find(p=>p.round===proof.round).preflightVerified).toBe(true);
    expect(proof.serverSeedHash).toBe(initial[game].fairness.serverSeedHash);
    if(cycle===0){fixtures[game].ended=copy(ended);fixtures[game].proof=copy(proof);}
    for(const patch of [{round:proof.round+1},{game:game==='roulette'?'craps':'roulette'},{serverSeed:'00'.repeat(32)},{serverSeedHash:'00'.repeat(32)}])await expect(verifyTableRound({...proof,...patch})).rejects.toThrow();
    const altered=copy(proof);if(game==='blackjack')altered.outcome.seats[0].returned++;else if(game==='baccarat')altered.outcome.playerCards[0]=altered.outcome.playerCards[0]%13+1;else if(game==='craps')altered.outcome.dice[0]=altered.outcome.dice[0]%6+1;else altered.outcome.number=(altered.outcome.number+1)%37;
    await expect(verifyTableRound(altered)).rejects.toThrow();
   }
  }
 },60000);
 it('rejects substitution, changed observations, premature secrets and missing commitments after reconnect',async()=>{
  for(const game of Object.keys(fixtures)){
   const store=storage();await acceptTableFairness(fixtures[game].committed,game,store);
   const replaced=copy(fixtures[game].committed);replaced.fairness.serverSeedHash='00'.repeat(32);await expect(acceptTableFairness(replaced,game,store)).rejects.toThrow();
   const leaked=copy(fixtures[game].committed);leaked.fairness.serverSeed='ab'.repeat(32);await expect(acceptTableFairness(leaked,game,store)).rejects.toThrow();
   const missing=copy(fixtures[game].committed);delete missing.fairness;await expect(acceptTableFairness(missing,game,store)).rejects.toThrow();
   expect((await verifyTableRound(fixtures[game].proof)).preflightVerified).toBe(false);
  }
  const store=storage(),f=fixtures.blackjack;await acceptTableFairness(f.committed,'blackjack',store);await acceptTableFairness(f.active,'blackjack',store);
  const changed=copy(f.active);changed.players.find(p=>p.cards.length).cards[0]=(changed.players.find(p=>p.cards.length).cards[0]+1)%52;
  await expect(acceptTableFairness(changed,'blackjack',store)).rejects.toThrow();
 });
 it('keeps seeds and helpers inaccessible to client roles and commitments immutable',async()=>{
  for(const role of ['anon','authenticated','service_role']){
   expect((await q("select has_table_privilege($1,'internal.table_fair_rounds','select') allowed",[role]))[0].allowed).toBe(false);
   expect((await q("select has_function_privilege($1,'internal.table_fair_sample(text,bigint,integer,integer)','execute') allowed",[role]))[0].allowed).toBe(false);
  }
  await expect(db.exec("update internal.table_fair_rounds set server_seed=repeat('00',32) where game='craps' and round_no=1")).rejects.toThrow(/cannot change/);
  await expect(db.exec("delete from internal.table_fair_rounds where game='craps' and round_no=1")).rejects.toThrow(/append-only/);
  await expect(q("select ig_bj_state($1)",[crypto.randomUUID()])).rejects.toThrow();
 });
});
describe('four reported fairness regressions',()=>{
 it('bounds device witnesses without deleting another game or the latest active round',()=>{
  const map=new Map(),store={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
  saveDeviceProof(store,'other-game:1',{round:1},'other-game',2);
  for(let i=1;i<=5;i++)saveDeviceProof(store,'crash:'+i,{round:i},'crash',2);
  expect(map.has('crash:1')).toBe(false);expect(map.has('crash:4')).toBe(true);expect(map.has('crash:5')).toBe(true);expect(map.has('other-game:1')).toBe(true);
 });
 it('generates canonical Crash commitments at both SQL numeric boundaries',async()=>{
  for(const bytes of ['00000000','ffffffff']){
   await db.exec(`create or replace function extensions.gen_random_bytes(integer) returns bytea language sql volatile as 'select case when $1=4 then decode(''${bytes}'',''hex'') else decode(repeat(''ab'',32),''hex'') end';delete from ig_crash_v2_queue;select ig_crash_v2_fill_queue();`);
   const rows=await q('select seed_secret,crash_point::float8 point,duration_ms,commitment from ig_crash_v2_queue');
   expect(rows).toHaveLength(25);for(const row of rows){expect(row.point).toBe(bytes==='00000000'?0:12000);expect(row.commitment).toBe(await sha256Hex(`${row.seed_secret}:${row.point.toFixed(2)}:${row.duration_ms}`));}
  }
 });
 it('rejects an otherwise valid Dice proof using an unsubmitted client seed',async()=>{
  const serverSeed='private-seed',hash=await sha256Hex(serverSeed),commit={id:'r',game:'dice',phase:'committed',algorithm:'hmac-sha256-v2',nonce:0,server_seed_hash:hash};
  const reveal={roundId:'r',game:'dice',phase:'revealed',algorithm:commit.algorithm,nonce:0,serverSeed,serverSeedHash:hash,clientSeed:'substitute',outcome:await calculatePracticeDice(serverSeed,'substitute',0)};
  expect(await verifyPracticeDice(commit,reveal,'player-chosen')).toBe(false);expect(await verifyPracticeDice(commit,reveal)).toBe(false);
 });
 it('verifies legacy and canonical Crash boundaries, pins preflight and distinguishes unwitnessed history',async()=>{
  for(const point of [0,2.34,12000])for(const legacy of [false,true]){
   const p={round:point+1,serverSeed:'ab'.repeat(32),crashPoint:point,durationMs:point===0?500:40000};p.round=Math.floor(p.round);
   p.commitment=createHash('sha256').update(`${p.serverSeed}:${legacy&&point!==2.34?point:point.toFixed(2)}:${p.durationMs}`).digest('hex');
   const store=storage();expect((await verifyCrashRound(p,store)).preflightVerified).toBe(false);
   rememberCrashCommitment({round:p.round,commitment:p.commitment,phase:'betting'},store);expect((await verifyCrashRound(p,store)).preflightVerified).toBe(true);
   const altered={...p,crashPoint:9.99};altered.commitment=await sha256Hex(`${p.serverSeed}:9.99:${p.durationMs}`);await expect(verifyCrashRound(altered,store)).rejects.toThrow(/preflight/);
  }
 });
 it('rejects the displayed Ace / committed Nine HiLo scenario and substituted player choices',async()=>{
  const seed='ab'.repeat(32),clientSeed='client:unicode-🎲';let known={clientSeed};
  known=await observeRound(known,{phase:'active',roundId:'r',version:1,history:[],outcome:{rank:1,suit:0}},'hilo');
  await expect(observeRound(known,{phase:'ended',roundId:'r',version:2,serverSeed:seed,clientSeed,history:[{choice:'higherOrSame',card:await finalCard(seed,clientSeed,1),won:false}]},'hilo')).rejects.toThrow(/observed/);
  await expect(observeRound({}, {phase:'active',roundId:'r',version:2,history:[{choice:'same'}]},'hilo',{action:'move',roundId:'r',version:1,choice:'higherOrSame'})).rejects.toThrow();
 });
 it('rejects changed Mines and Towers prefixes and unsubmitted moves while preserving retries',async()=>{
  for(const game of ['mines','towers']){
   const field=game==='mines'?'picks':'history',steps=game==='mines'?[1]:[{tile:1,safe:true}],bad=game==='mines'?[0]:[{tile:0,safe:false}];
   const active={phase:'active',roundId:'r',version:2,[field]:steps},known=await observeRound({},active,game);
   expect(await observeRound(known,active,game)).toEqual(known);
   await expect(observeRound(known,{...active,phase:'ended',[field]:bad},game)).rejects.toThrow();
   await expect(observeRound({},active,game,{action:game==='mines'?'pick':'move',roundId:'r',version:1,cell:0,choice:'0'})).rejects.toThrow();
  }
 });
});
