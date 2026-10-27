import {verifyDealProof} from '../lib/pokerReplayProof.js';
// Synthetic single-backend SQL proof only. Not actual Auth/HTTP/concurrency.
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {randomUUID,createHash} from 'node:crypto';import {PGlite} from '@electric-sql/pglite';import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('fixed table formats 2 4 6 8 9 with capacity-aware native accounting',async t=>{
 const db=new PGlite({extensions:{pgcrypto}}),q=async(s,a=[])=>(await db.query(s,a)).rows,exec=s=>db.exec(s);
 try{
  await exec(`create schema auth;create schema extensions;create extension pgcrypto with schema extensions;create role anon;create role authenticated;create role service_role;create table auth.users(id uuid primary key);create table profiles(id uuid primary key,is_excluded boolean default false);create table user_roles(user_id uuid primary key,role text);create function auth.jwt() returns jsonb language sql as $$select '{"role":"service_role"}'::jsonb$$;`);
  for(const f of JSON.parse(read('tests/fixtures/practice-game-source-manifest.json')).files){const text=read(f.path);assert.equal(createHash('sha256').update(text).digest('hex'),f.sha256);await exec(text.replace(/^select cron.schedule\(.*$/gm,''));}
  await exec('begin;'+read('supabase/proposals/practice-token-journal.sql')+'commit;');
  const snapshot=()=>q("select p.oid::text,p.proacl::text,p.prosecdef,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by p.oid");
  await t.test('unsupported existing seven-format aborts proposal without conversion',async()=>{
   const actor=randomUUID();await q('insert into auth.users values($1)',[actor]);const [{id}]=await q("insert into poker_events_v1(name,format,status,created_by,config) values('Legacy seven requires review','scheduled_mtt','draft',$1,$2::jsonb) returning id",[actor,JSON.stringify({seatsPerTable:7})]);
   try{await assert.rejects(exec('begin;'+read('supabase/proposals/practice-poker-fixed-capacities.sql')+'commit;'),/EXISTING_FORMAT_REQUIRES_EXPLICIT_REVIEW/);}finally{await exec('rollback');}
   assert.equal((await q("select count(*)::int n from information_schema.columns where table_schema='public' and table_name='poker_tables_v1' and column_name='seat_capacity'"))[0].n,0);
   assert.equal((await q("select (config->>'seatsPerTable')::int n from poker_events_v1 where id=$1",[id]))[0].n,7);
   await q('delete from poker_events_v1 where id=$1',[id]);await q('delete from auth.users where id=$1',[actor]);
  });
  const before=await snapshot();await exec('begin;'+read('supabase/proposals/practice-poker-fixed-capacities.sql')+'commit;');
  assert.deepEqual((await snapshot()).filter(x=>before.some(b=>b.oid===x.oid)),before);
  await exec('begin;'+read('supabase/proposals/practice-poker-receipt-binding.sql')+read('supabase/proposals/practice-poker-receipt-resolution.sql')+'commit;');
  const users=(await q('insert into auth.users select gen_random_uuid() from generate_series(1,20) returning id')).map(x=>x.id);
  for(const [i,u]of users.entries()){await q('insert into profiles values($1,false)',[u]);await q('insert into user_roles values($1,$2)',[u,i===2?'superadmin':'player']);}
  const consistent=async()=>assert.equal((await q('select count(*)::int n from ig_practice_audit.reconciliation where not consistent'))[0].n,0);
  const chips=async id=>(await q('select sum(stack+committed)::int n from poker_seats_v1 where table_id=$1',[id]))[0].n;
  const create=async(n,variant='holdem')=>(await q('select poker_create_capacity_v1($1,$2,$3) id',[users[0],variant,n]))[0].id;
  const deck=Array.from({length:52},(_,i)=>({rank:2+Math.floor(i/4),suit:['c','d','h','s'][i%4]}));
  const start=async(id,hand,owner=users[0])=>{const seed='synthetic-fixed-capacity-'+hand;return q('select poker_start_v2($1,$2,$3::jsonb,$4,$5,$6) result',[id,owner,JSON.stringify(deck),createHash('sha256').update(seed+':'+id+':'+hand).digest('hex'),seed,hand]);};
  const fold=async id=>{const [s]=await q('select t.version,s.user_id from poker_tables_v1 t join poker_seats_v1 s on s.table_id=t.id and s.seat_no=t.turn_index where t.id=$1',[id]);return q("select poker_action_v3($1,$2,$3,$4::bigint,'fold',0,false)",[id,s.user_id,randomUUID(),s.version]);};
  await t.test('fixed choices, legacy defaults, invalid choices and owner gates',async()=>{
   for(const n of [2,4,6,8,9]){const id=await create(n);assert.equal((await q('select seat_capacity from poker_tables_v1 where id=$1',[id]))[0].seat_capacity,n);for(const u of users.slice(1,n))await q('select poker_join_v1($1,$2)',[id,u]);assert.equal(await chips(id),n*1000);await assert.rejects(q('select poker_join_v1($1,$2)',[id,users[19]]),/TABLE_FULL/);if(n===2)await q('update poker_tables_v1 set seat_capacity=2 where id=$1',[id]);else await assert.rejects(q('update poker_tables_v1 set seat_capacity=2 where id=$1',[id]),/CAPACITY_LOCKED/);const [{result:dealt}]=await start(id,1);if(n===2){assert.equal(dealt.smallBlind,0);assert.equal(dealt.bigBlind,1);}for(let i=0;i<n&&(await q('select status from poker_tables_v1 where id=$1',[id]))[0].status==='playing';i++)await fold(id);assert.equal(await chips(id),n*1000);}
   for(const n of [0,1,3,5,7,10])await assert.rejects(create(n),e=>e.code==='22023');
   await assert.rejects(create(9,'omaha'),e=>e.code==='22023');assert.equal((await q('select seat_capacity from poker_tables_v1 where id=$1',[await create(6,'omaha')]))[0].seat_capacity,6);
   const [{id:legacy}]=await q('select poker_create_v1($1) id',[users[0]]);assert.equal((await q('select seat_capacity from poker_tables_v1 where id=$1',[legacy]))[0].seat_capacity,8);
   await q('update profiles set is_excluded=true where id=$1',[users[0]]);try{await assert.rejects(create(9),e=>e.code==='42501');}finally{await q('update profiles set is_excluded=false where id=$1',[users[0]]);}
   await exec('set role authenticated');try{await assert.rejects(create(9),e=>e.code==='42501');}finally{await exec('reset role');}await consistent();
  });
  await t.test('Omaha remains six seats and four private cards',async()=>{
   const id=await create(6,'omaha');for(const u of users.slice(1,6))await q('select poker_join_v1($1,$2)',[id,u]);await assert.rejects(q('select poker_join_v1($1,$2)',[id,users[6]]),/TABLE_FULL/);
   const seed='synthetic-omaha-six-preserved';await q('select poker_start_omaha_v1($1,$2,$3::jsonb,$4,$5,1)',[id,users[0],JSON.stringify(deck),createHash('sha256').update(seed+':'+id+':1').digest('hex'),seed]);
   const [{proof}]=await q('select poker_hand_replay_v1($1,$2,1,0) proof',[users[0],id]);assert.equal(proof.dealAssignments.length,6);assert.ok(proof.dealAssignments.every(x=>x.holePositions.length===4));
   for(let i=0;i<6&&(await q('select status from poker_tables_v1 where id=$1',[id]))[0].status==='playing';i++)await fold(id);assert.equal(await chips(id),6000);await consistent();
  });
  await t.test('nine-seat native hand journal failure rolls back deal and balances',async()=>{
   const id=await create(9);for(const u of users.slice(1,9))await q('select poker_join_v1($1,$2)',[id,u]);const before=(await q('select count(*)::int n from ig_practice_audit.entries'))[0].n;
   await exec("create function ig_practice_audit.fixed_capacity_failure() returns trigger language plpgsql as $$begin raise exception 'SYNTHETIC_NINE_JOURNAL_FAILURE';end$$;create trigger fixed_capacity_failure before insert on ig_practice_audit.entries for each row execute function ig_practice_audit.fixed_capacity_failure();");
   try{await assert.rejects(start(id,1),/SYNTHETIC_NINE_JOURNAL_FAILURE/);}finally{await exec('drop trigger fixed_capacity_failure on ig_practice_audit.entries;drop function ig_practice_audit.fixed_capacity_failure()');}
   const [state]=await q('select status,hand_no from poker_tables_v1 where id=$1',[id]);assert.deepEqual(state,{status:'waiting',hand_no:0});assert.equal(await chips(id),9000);assert.equal((await q('select count(*)::int n from poker_hand_ledger_v1 where table_id=$1',[id]))[0].n,0);assert.equal((await q('select count(*)::int n from ig_practice_audit.entries'))[0].n,before);await consistent();
  });
  await t.test('seven occupants are valid at configured eight and nine',async()=>{
   for(const capacity of [8,9]){const id=await create(capacity);for(const u of users.slice(1,7))await q('select poker_join_v1($1,$2)',[id,u]);await start(id,1);assert.equal((await q('select dealt_count,seat_capacity from poker_tables_v1 where id=$1',[id]))[0].dealt_count,7);while((await q('select status from poker_tables_v1 where id=$1',[id]))[0].status==='playing')await fold(id);assert.equal(await chips(id),7000);}await consistent();
  });
  await t.test('nine-player deal proof, postflop order and full button wrap conserve chips',async()=>{
   const id=await create(9);for(const u of users.slice(1,9))await q('select poker_join_v1($1,$2)',[id,u]);
   for(let hand=1;hand<=10;hand++){
    await start(id,hand);const [table]=await q('select * from poker_tables_v1 where id=$1',[id]);assert.equal(table.button,(hand-1)%9);assert.equal(table.dealt_count,9);
    const [{proof}]=await q('select poker_hand_replay_v1($1,$2,$3,0) proof',[users[0],id,hand]);assert.equal(proof.dealAssignments.length,9);await verifyDealProof(proof);assert.ok(proof.dealAssignments.every(x=>x.holePositions.length===2));
    if(hand===1){
     for(let i=0;i<9;i++){const [s]=await q('select t.version,s.user_id from poker_tables_v1 t join poker_seats_v1 s on s.table_id=t.id and s.seat_no=t.turn_index where t.id=$1',[id]);await q("select poker_action_v3($1,$2,$3,$4::bigint,'call',0,false)",[id,s.user_id,randomUUID(),s.version]);}
     await q('select poker_advance_v1($1)',[id]);const [flop]=await q('select board,turn_index from poker_tables_v1 where id=$1',[id]);assert.deepEqual(flop.board,deck.slice(19,22));assert.equal(flop.turn_index,1);
    }
    for(let i=0;i<9&&(await q('select status from poker_tables_v1 where id=$1',[id]))[0].status==='playing';i++)await fold(id);
    assert.equal((await q('select status from poker_tables_v1 where id=$1',[id]))[0].status,'complete');assert.equal(await chips(id),9000);await consistent();
   }
  });
  await t.test('preset choices and bad or missing configuration fail closed atomically',async()=>{
   const cfg={name:'Synthetic preset',format:'scheduled_mtt',variant:'holdem',currency:'PRACTICE',tableCount:2,rakeBps:0,buyInUnits:0,initialStack:1000,blindLevels:[{small:5,big:10,durationMinutes:10}]};
   for(const seatsPerTable of [2,4,6,8,9])await q('select ig_poker_tournament_preset_save($1,$2::jsonb)',[users[2],JSON.stringify({...cfg,seatsPerTable})]);
   for(const seatsPerTable of [3,5,7,10])await assert.rejects(q('select ig_poker_tournament_preset_save($1,$2::jsonb)',[users[2],JSON.stringify({...cfg,seatsPerTable})]),/INVALID_TOURNAMENT_CONFIG/);
   await assert.rejects(q('select ig_poker_tournament_preset_save($1,$2::jsonb)',[users[0],JSON.stringify({...cfg,seatsPerTable:9})]),e=>e.code==='42501');
   await assert.rejects(q("insert into poker_events_v1(name,format,status,created_by,config) values('Not a seven format','scheduled_mtt','registration',$1,$2::jsonb)",[users[2],JSON.stringify({seatsPerTable:7})]),e=>e.code==='23514');
   const config={practiceOnly:true,realValueEnabled:false,buyInUnits:0,maxPlayers:2,seatsPerTable:2,startingStack:1000,startAt:'2000-01-01T00:00:00Z',levels:[{smallBlind:5,bigBlind:10,durationSeconds:600}]};
   const [{id}]=await q("insert into poker_events_v1(name,format,status,created_by,config) values('Missing table count','scheduled_mtt','registration',$1,$2::jsonb) returning id",[users[2],JSON.stringify(config)]);
   for(const u of users.slice(0,2))await q('select poker_event_register_v1($1,$2)',[id,u]);
   const before=(await q('select count(*)::int n from ig_practice_audit.entries'))[0].n;
   await assert.rejects(q('select poker_event_start_v1($1,$2,0,$3)',[id,users[2],randomUUID()]),/BAD_SEAT_CONFIGURATION|CONFIGURED_TABLE_LIMIT/);
   assert.equal((await q('select count(*)::int n from poker_tables_v1 where event_id=$1',[id]))[0].n,0);assert.equal((await q('select count(*)::int n from ig_practice_audit.entries'))[0].n,before);await consistent();
  });
  await t.test('service role succeeds through private triggers but cannot call helpers',async()=>{
   // Exact local model of reviewed stack defaults, rolled back; no proposal grants.
   const privileges=()=>q("select oid::text,relacl::text from pg_class where relnamespace='public'::regnamespace order by oid");const original=await privileges();
   await exec('begin');try{
    await exec('grant usage on schema public,auth,extensions to service_role;grant all on all tables in schema public to service_role;grant all on all sequences in schema public to service_role;alter role service_role bypassrls;set local role service_role');
    assert.equal((await q('select current_user name'))[0].name,'service_role');assert.equal((await q("select has_schema_privilege(current_user,'ig_practice_table_config','USAGE') allowed"))[0].allowed,false);
    assert.equal((await q("select count(*)::int n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='ig_practice_table_config' and has_function_privilege(current_user,p.oid,'EXECUTE')"))[0].n,0);
    const table=await create(9);for(const u of users.slice(1,9))await q('select poker_join_v1($1,$2)',[table,u]);await start(table,1);assert.equal(await chips(table),9000);
    const config={practiceOnly:true,realValueEnabled:false,buyInUnits:0,maxPlayers:2,seatsPerTable:2,tableCount:1,startingStack:1000,startAt:'2000-01-01T00:00:00Z',levels:[{smallBlind:5,bigBlind:10,durationSeconds:600}]};
    const [{created}]=await q("select poker_event_create_v1($1,$2,'Service role event','scheduled_mtt',$3::jsonb) created",[users[2],randomUUID(),JSON.stringify(config)]);
    const [{published}]=await q('select poker_event_publish_v1($1,$2,0,$3) published',[created.eventId,users[2],randomUUID()]);for(const u of users.slice(0,2))await q('select poker_event_register_v1($1,$2)',[created.eventId,u]);await q('select poker_event_start_v1($1,$2,$3,$4)',[created.eventId,users[2],published.version,randomUUID()]);
    assert.equal((await q("select count(*)::int n from poker_event_entries_v1 where event_id=$1 and status='seated'",[created.eventId]))[0].n,2);
    for(const helper of ['initialize_capacity','enforce_seat','enforce_event_entry']){await exec('savepoint private_helper_denial');await assert.rejects(q('select ig_practice_table_config.'+helper+'()'),e=>e.code==='42501');await exec('rollback to savepoint private_helper_denial');}
   }finally{await exec('rollback');await exec('reset role');}
   assert.deepEqual(await privileges(),original);assert.equal((await q("select rolbypassrls from pg_roles where rolname='service_role'"))[0].rolbypassrls,false);await consistent();
  });
  await t.test('configured tournaments start and consolidate for all fixed choices',async()=>{
   const foreignConfig={practiceOnly:true,realValueEnabled:false,buyInUnits:0,maxPlayers:2,seatsPerTable:2,tableCount:1,startingStack:1000,startAt:'2000-01-01T00:00:00Z',levels:[{smallBlind:5,bigBlind:10,durationSeconds:600}]};
   const [{id:foreignEvent}]=await q("insert into poker_events_v1(name,format,status,created_by,config) values('Foreign event assignment','scheduled_mtt','registration',$1,$2::jsonb) returning id",[users[2],JSON.stringify(foreignConfig)]);
   for(const u of users.slice(18,20))await q('select poker_event_register_v1($1,$2)',[foreignEvent,u]);await q('select poker_event_start_v1($1,$2,0,$3)',[foreignEvent,users[2],randomUUID()]);const [{id:foreignTable}]=await q('select id from poker_tables_v1 where event_id=$1',[foreignEvent]);
   for(const n of [2,4,6,8,9]){
    const config={practiceOnly:true,realValueEnabled:false,buyInUnits:0,maxPlayers:2*n,seatsPerTable:n,tableCount:2,startingStack:1000,startAt:'2000-01-01T00:00:00Z',levels:[{smallBlind:5,bigBlind:10,durationSeconds:600}]};
    const [{id}]=await q("insert into poker_events_v1(name,format,status,created_by,config) values('Synthetic fixed tournament','scheduled_mtt','registration',$1,$2::jsonb) returning id",[users[2],JSON.stringify(config)]);
    for(const u of users.slice(0,2*n))await q('select poker_event_register_v1($1,$2)',[id,u]);const request=randomUUID();await q('select poker_event_start_v1($1,$2,0,$3)',[id,users[2],request]);const count=(await q('select count(*)::int n from ig_practice_audit.entries'))[0].n;await q('select poker_event_start_v1($1,$2,0,$3)',[id,users[2],request]);assert.equal((await q('select count(*)::int n from ig_practice_audit.entries'))[0].n,count);
    const tables=await q('select id,seat_capacity from poker_tables_v1 where event_id=$1 order by id',[id]);assert.equal(tables.length,2);assert.ok(tables.every(x=>x.seat_capacity===n));
    const [entry]=await q('select user_id,table_id,seat_no from poker_event_entries_v1 where event_id=$1 order by table_id,seat_no limit 1',[id]);
    const beforeBad=(await q('select count(*)::int n from ig_practice_audit.entries'))[0].n;
    for(const seat of [-1,n])await assert.rejects(q('update poker_event_entries_v1 set seat_no=$1 where event_id=$2 and user_id=$3',[seat,id,entry.user_id]),e=>e.code==='23514'&&/ENTRY_OUTSIDE_EVENT_TABLE_CAPACITY/.test(e.message));
    await assert.rejects(q('update poker_event_entries_v1 set table_id=$1 where event_id=$2 and user_id=$3',[foreignTable,id,entry.user_id]),/ENTRY_OUTSIDE_EVENT_TABLE_CAPACITY/);
    await assert.rejects(q('update poker_event_entries_v1 set event_id=$1 where event_id=$2 and user_id=$3',[foreignEvent,id,entry.user_id]),/ENTRY_OUTSIDE_EVENT_TABLE_CAPACITY/);
    await assert.rejects(q('update poker_event_entries_v1 set seat_no=$1 where event_id=$2 and user_id=$3',[(entry.seat_no+1)%n,id,entry.user_id]),/ENTRY_PLAYER_SEAT_MISMATCH/);
    await assert.rejects(q('update poker_event_entries_v1 set user_id=$1 where event_id=$2 and user_id=$3',[users[19],id,entry.user_id]),/ENTRY_PLAYER_SEAT_MISMATCH/);
    await assert.rejects(q('update poker_event_entries_v1 set table_id=null where event_id=$1 and user_id=$2',[id,entry.user_id]),/INVALID_EVENT_ENTRY_ASSIGNMENT/);
    await assert.rejects(q('update poker_event_entries_v1 set table_id=null,seat_no=null where event_id=$1 and user_id=$2',[id,entry.user_id]),/SEATED_ENTRY_REQUIRES_ASSIGNMENT/);
    await assert.rejects(q("update poker_event_entries_v1 set status='registered' where event_id=$1 and user_id=$2",[id,entry.user_id]),/INVALID_EVENT_ENTRY_ASSIGNMENT/);
    assert.equal((await q('select count(*)::int n from ig_practice_audit.entries'))[0].n,beforeBad);
    for(const [i,table]of tables.entries()){const keep=i===0?Math.floor(n/2):Math.ceil(n/2),total=n*1000,base=Math.floor(total/keep),extra=total%keep;await q('update poker_seats_v1 set stack=case when seat_no<$2 then $3+case when seat_no<$4 then 1 else 0 end else 0 end where table_id=$1',[table.id,keep,base,extra]);}
    await q('select poker_event_sync_v1($1)',[id]);
    assert.equal((await q("select count(*)::int n from poker_event_entries_v1 where event_id=$1 and status='eliminated' and table_id is null and seat_no is null",[id]))[0].n,n);
    assert.equal((await q("select count(*)::int n from poker_event_entries_v1 e join poker_seats_v1 s on s.table_id=e.table_id and s.user_id=e.user_id and s.seat_no=e.seat_no where e.event_id=$1 and e.status='seated'",[id]))[0].n,n);
    const [state]=await q('select count(*)::int players,count(distinct s.table_id)::int tables,max(seat_no)::int max_seat,sum(stack+committed)::int chips from poker_seats_v1 s join poker_tables_v1 t on t.id=s.table_id where t.event_id=$1',[id]);assert.deepEqual(state,{players:n,tables:1,max_seat:n-1,chips:2*n*1000});
    const [{id:target}]=await q('select distinct s.table_id id from poker_seats_v1 s join poker_tables_v1 t on t.id=s.table_id where t.event_id=$1',[id]);await assert.rejects(q('update poker_seats_v1 set seat_no=$1 where table_id=$2 and seat_no=0',[n,target]),/CAPACITY|check constraint/);await assert.rejects(q('update poker_event_entries_v1 set seat_no=9 where event_id=$1 and user_id=$2',[id,users[0]]),e=>e.code==='23514');await consistent();
   }
  });
 }finally{await db.close();}
});
