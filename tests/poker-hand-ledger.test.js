import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { shuffleCommittedDeck } from './fixtures/poker-fairness';
import { verifyReplay, verifyDealProof, rememberDealRoot, verifyPokerSnapshot } from '../lib/pokerReplayProof.js';
let db, users;
const query = async (sql, args = []) => (await db.query(sql, args)).rows;
async function createHand(count = 3) {
  const tableId = (await query('select poker_create_v1($1) id', [users[0]]))[0].id;
  for (const user of users.slice(1,count)) await query('select poker_join_v1($1,$2)', [tableId,user]);
  const seed = 'synthetic-cryptographic-test-seed';
  const { deck, commitment } = await shuffleCommittedDeck(seed, tableId+':1');
  await query('select poker_start_v2($1::uuid,$2::uuid,$3::jsonb,$4,$5,1)', [tableId,users[0],JSON.stringify(deck),commitment,seed]);
  return tableId;
}
async function replay(tableId, user = users[1], from = 0) {
  return (await query('select poker_hand_replay_v1($1,$2,1,$3::int) r', [user,tableId,from]))[0].r;
}
async function finish(tableId, foldFirst = false) {
  let folded = false;
  for (let i=0;i<80;i++) {
    const t = (await query('select * from poker_tables_v1 where id=$1',[tableId]))[0];
    if (t.status==='complete') return;
    if (t.status==='showdown') {
      if (t.street==='river') {
        const [s] = await query('select seat_no from poker_seats_v1 where table_id=$1 and not folded order by seat_no limit 1',[tableId]);
        const [{pot}] = await query('select sum(committed)::int pot from poker_seats_v1 where table_id=$1',[tableId]);
        await query('select poker_settle_v1($1,$2::bigint,$3::jsonb)',[tableId,t.version,JSON.stringify([{seat:s.seat_no,chips:pot}])]);
      } else await query('select poker_advance_v1($1)',[tableId]);
    } else {
      const [s] = await query('select * from poker_seats_v1 where table_id=$1 and seat_no=$2::int',[tableId,t.turn_index]);
      const move = foldFirst && !folded ? 'fold' : s.street_bet<t.current_bet?'call':'check';
      if (move==='fold') folded=true;
      await query('select poker_action_v3($1,$2,gen_random_uuid(),$3::bigint,$4,0,false)',[tableId,s.user_id,t.version,move]);
    }
  }
  throw Error('Hand did not finish');
}
beforeAll(async()=>{
  db=new PGlite();
  // Synthetic Auth only; native PostgreSQL SHA-256 matches the browser verifier.
  // pgcrypto is represented by equivalent test wrappers, not a hosted extension test.
  await db.exec(`create schema auth;create schema extensions;create role anon;create role authenticated;create role service_role;
   create table auth.users(id uuid primary key);
   create function extensions.digest(text,text) returns bytea language sql as 'select sha256(convert_to($1,''UTF8''))';
   create function extensions.gen_random_bytes(int) returns bytea language sql as 'select substring(sha256(convert_to(gen_random_uuid()::text,''UTF8'')) from 1 for $1)';`);
  for (const file of ["20261017120139_poker_transactional_freeplay_v1.sql", "20261017120212_poker_create_join_start_v1.sql", "20261017120245_poker_advance_settle_v1.sql", "20261017120300_poker_pin_initial_dealt_seat_count.sql", "20261017120317_poker_private_fairness_seed.sql", "20261017120555_poker_superadmin_tournament_drafts_v1.sql", "20261017124852_poker_event_registration_seating_v1.sql", "20261017124927_poker_fix_stable_event_seating.sql", "20261017125108_poker_atomic_committed_repeatable_hand_start.sql", "20261017125708_poker_fix_button_and_postflop_turn_order.sql", "20261017125804_poker_server_clock_blind_levels_v1.sql", "20261017125901_poker_tournament_elimination_and_balancing_v1.sql", "20261017133438_poker_turn_timebank_staging_v4.sql", "20261018002747_omaha_four_card_poker.sql", "20261018002944_poker_deck_offset_fix.sql", "20261018020156_nlhe_eight_seats.sql"]) await db.exec(readFileSync('supabase/deployed-migrations/'+file,'utf8'));
  await db.exec(readFileSync('supabase/migrations/20261024183347_committed_poker_replay_and_queue_limits.sql','utf8'));
  await db.exec(`create function public.test_plan_before_cards() returns trigger language plpgsql as $$
    begin if new.private_hole<>'[]'::jsonb and new.private_hole is distinct from old.private_hole and not exists(
      select 1 from public.poker_hand_ledger_v1 h join public.poker_tables_v1 t on t.id=h.table_id
      where t.id=new.table_id and h.hand_no=t.hand_no+1) then raise exception 'CARDS_ASSIGNED_BEFORE_COMMITMENT'; end if; return new; end $$;
    create trigger test_plan_before_cards before update on poker_seats_v1 for each row execute function test_plan_before_cards();`);
  users=(await query('insert into auth.users select gen_random_uuid() from generate_series(1,7) returning id')).map(r=>r.id);
},30000);
afterAll(async()=>{await db?.close();});

describe('committed poker deals and private hand ledger',()=>{
  it('keeps six interleaved tables and three successive hands isolated, including mixed variants',async()=>{
    const roster=(await query('insert into auth.users select gen_random_uuid() from generate_series(1,8) returning id')).map(r=>r.id);
    const tables=await Promise.all(Array.from({length:6},async(_,i)=>{
      const variant=i%2?'omaha':'holdem',count=variant==='omaha'?6:8;
      const [{id}]=await query(`select ${variant==='omaha'?'poker_create_omaha_v1':'poker_create_v1'}($1,1000) id`,[roster[0]]);
      for(const user of roster.slice(1,count))await query('select poker_join_v1($1,$2)',[id,user]);
      return {id,variant,count,proofs:[]};
    }));
    const pinned=new Map(),storage={getItem:k=>pinned.get(k),setItem:(k,v)=>pinned.set(k,v)};
    const roots=new Set(),cardHashes=new Set();
    for(let hand=1;hand<=3;hand++){
      await Promise.all(tables.map(async(table)=>{
        // Identical test seeds deliberately exercise the table/hand domain binding.
        const seed='synthetic-shared-seed-multitable';
        const {deck,commitment}=await shuffleCommittedDeck(seed,`${table.id}:${hand}`);table.expectedDeck=deck;
        await query(`select ${table.variant==='omaha'?'poker_start_omaha_v1':'poker_start_v2'}($1::uuid,$2::uuid,$3::jsonb,$4,$5,$6::int)`,[table.id,roster[0],JSON.stringify(deck),commitment,seed,hand]);
        const [{proof}]=await query('select poker_hand_replay_v1($1,$2,$3::int,0) proof',[roster[1],table.id,hand]);
        expect(await verifyDealProof(proof)).toBe(true);expect(rememberDealRoot(proof,storage)).toBe(false);
        expect(roots.has(proof.root)).toBe(false);roots.add(proof.root);
        proof.cardHashes.forEach(hash=>{expect(cardHashes.has(hash)).toBe(false);cardHashes.add(hash);});
        table.liveProof=proof;
      }));
      // All six hands are open together; independent finish loops issue overlapping requests.
      await Promise.all(tables.map((t,i)=>finish(t.id,i%2===0)));
      await Promise.all(tables.map(async table=>{
        const [{proof}]=await query('select poker_hand_replay_v1($1,$2,$3::int,0) proof',[roster[1],table.id,hand]);
        const frames=await verifyReplay(proof);expect(rememberDealRoot(proof,storage)).toBe(true);
        expect(proof.root).toBe(table.liveProof.root);expect(frames.every(f=>f.tableId===table.id&&f.handNo===hand)).toBe(true);
        expect(proof.openings.every(o=>o.card.rank===table.expectedDeck[o.position].rank&&o.card.suit===table.expectedDeck[o.position].suit)).toBe(true);
        const [{deck}]=await query('select private_deck deck from poker_tables_v1 where id=$1',[table.id]);expect(deck).toEqual(table.expectedDeck);
        for(const seat of frames.at(-1).seats.filter(s=>s.folded&&s.seatNo!==proof.mySeat)){
          const slots=proof.dealAssignments.find(a=>a.seatNo===seat.seatNo).holePositions;
          expect(proof.openings.some(o=>slots.includes(o.position))).toBe(false);
        }
        table.proofs.push(proof);
      }));
    }
    for(const table of tables){
      const [{history}]=await query('select poker_hand_history_v1($1,$2,null) history',[roster[1],table.id]);
      expect(history.hands.map(h=>h.handNo)).toEqual([3,2,1]);
      for(const proof of table.proofs){
        const [{archived}]=await query('select poker_hand_replay_v1($1,$2,$3::int,0) archived',[roster[1],table.id,proof.handNo]);
        expect(archived).toEqual(proof);expect(await verifyReplay(archived)).toHaveLength(proof.lastStep+1);
      }
    }
    const a=tables[0].proofs[0],b=tables[2].proofs[0],next=tables[0].proofs[1];
    await expect(verifyReplay({...a,openings:b.openings})).rejects.toThrow();
    await expect(verifyReplay({...a,steps:[a.steps[0],b.steps[1],...a.steps.slice(2)]})).rejects.toThrow();
    await expect(verifyReplay({...a,openings:next.openings})).rejects.toThrow();
    await expect(verifyReplay({...a,tableId:b.tableId})).rejects.toThrow();
    const head=JSON.parse(a.head.canonical);
    await expect(verifyPokerSnapshot({deckProof:b,seats:await query('select seat_no from poker_seats_v1 where table_id=$1',[a.tableId]),table:{variant:tables[0].variant,id:a.tableId,handNo:a.handNo,version:head.version,board:head.board},holeCards:[]})).rejects.toThrow('Wrong hand proof');
    expect(roots.size).toBe(18);expect(cardHashes.size).toBe(18*52);
    if(process.env.POKER_MULTITABLE_FIXTURE)writeFileSync(process.env.POKER_MULTITABLE_FIXTURE,JSON.stringify(tables.map(({id,variant,proofs})=>({id,variant,proofs}))));
  },30000);
  it('tops automatic Crash queues up to 25 only below five, keeping queued commitments',async()=>{
    await db.exec(`create table ig_crash_v2_runtime(singleton int primary key);insert into ig_crash_v2_runtime values(1);
      create table ig_crash_v2_queue(id bigint generated always as identity primary key,seed_secret text,crash_point numeric,duration_ms int,commitment text,status text default 'queued');`);
    await query('select ig_crash_v2_fill_queue()');
    expect((await query("select count(*)::int n from ig_crash_v2_queue where status='queued'"))[0].n).toBe(25);
    await query('select ig_crash_v2_fill_queue()');
    expect((await query('select count(*)::int n from ig_crash_v2_queue'))[0].n).toBe(25);
    const [pinned]=await query('select id,commitment from ig_crash_v2_queue order by id desc limit 1');
    await query("update ig_crash_v2_queue set status='complete' where id<=22");await query('select ig_crash_v2_fill_queue()');
    expect((await query("select count(*)::int n from ig_crash_v2_queue where status='queued'"))[0].n).toBe(25);
    expect((await query('select commitment from ig_crash_v2_queue where id=$1',[pinned.id]))[0].commitment).toBe(pinned.commitment);
  });
  it('checks displayed hole cards against the commitment and rejects mixed snapshot versions',async()=>{
    const id=await createHand();const proof=await replay(id);const head=JSON.parse(proof.head.canonical);
    const snapshot={deckProof:proof,seats:await query('select seat_no from poker_seats_v1 where table_id=$1',[id]),table:{variant:'holdem',id,handNo:1,version:head.version,board:[]},holeCards:proof.myPositions.map(p=>proof.openings.find(o=>o.position===p).card)};
    expect(await verifyPokerSnapshot(snapshot)).toBe(true);
    const swapped=structuredClone(snapshot);swapped.holeCards[0]={rank:99,suit:'c'};
    await expect(verifyPokerSnapshot(swapped)).rejects.toThrow('Visible cards');
    await expect(verifyPokerSnapshot({...snapshot,table:{...snapshot.table,version:999}})).rejects.toThrow('Table changed');
  });
  it('supports eight Holdem seats and four Omaha cards without overlapping the board',async()=>{
    const extra=(await query('insert into auth.users values(gen_random_uuid()) returning id'))[0].id;
    const [h]=await query('select poker_create_v1($1) id',[users[0]]);
    for(const user of [...users.slice(1),extra])await query('select poker_join_v1($1,$2)',[h.id,user]);
    const seed='synthetic-eight-seat-seed';const {deck,commitment}=await shuffleCommittedDeck(seed,h.id+':1');
    await query('select poker_start_v2($1::uuid,$2::uuid,$3::jsonb,$4,$5,1)',[h.id,users[0],JSON.stringify(deck),commitment,seed]);
    const hp=await replay(h.id);expect(hp.dealAssignments).toHaveLength(8);expect(hp.boardPositions[0]).toBe(17);expect(await verifyDealProof(hp)).toBe(true);
    await finish(h.id);expect((await verifyReplay(await replay(h.id))).at(-1).status).toBe('complete');
    const [o]=await query('select poker_create_omaha_v1($1,1000) id',[users[0]]);
    for(const user of users.slice(1,6))await query('select poker_join_v1($1,$2)',[o.id,user]);
    const omaha=await shuffleCommittedDeck(seed,o.id+':1');
    await query('select poker_start_omaha_v1($1::uuid,$2::uuid,$3::jsonb,$4,$5,1)',[o.id,users[0],JSON.stringify(omaha.deck),omaha.commitment,seed]);
    const op=await replay(o.id);expect(op.variant).toBe('omaha');expect(op.openings).toHaveLength(4);expect(op.boardPositions[0]).toBe(25);expect(await verifyDealProof(op)).toBe(true);
    await finish(o.id,true);const done=await replay(o.id);const frames=await verifyReplay(done);expect(frames.at(-1).status).toBe('complete');const folded=frames.at(-1).seats.find(s=>s.folded);expect(done.showdownPositions[folded.seatNo]).toBeUndefined();expect(done.showdownPositions['1']).toHaveLength(4);
  });

  it('locks 52 salted card commitments before betting and exposes only own live cards',async()=>{
    const id=await createHand();
    const proof=await replay(id);
    expect(proof.cardHashes).toHaveLength(52);
    expect(proof.openings).toHaveLength(2);
    expect(proof.complete).toBe(false);
    expect(await verifyDealProof(proof)).toBe(true);
    expect(proof.steps.map(s=>JSON.parse(s.canonical).kind)).toEqual(['deal']);
    expect(JSON.stringify(proof)).not.toContain('synthetic-cryptographic-test-seed');
    await expect(query("update poker_hand_ledger_v1 set deck_root=repeat('0',64) where table_id=$1",[id])).rejects.toThrow('APPEND_ONLY');
    await expect(query('delete from poker_hand_steps_v1 where table_id=$1',[id])).rejects.toThrow('APPEND_ONLY');
    await expect(query("update poker_tables_v1 set private_deck='[]' where id=$1",[id])).rejects.toThrow('IMMUTABLE');
  });
  it('replays every action while showing showdown cards and hiding a folded opponent',async()=>{
    const id=await createHand(); await finish(id,true);
    const proof=await replay(id);
    const states=await verifyReplay(proof);
    if (process.env.POKER_REPLAY_FIXTURE) writeFileSync(process.env.POKER_REPLAY_FIXTURE,JSON.stringify(proof));
    expect(states[0].kind).toBe('deal'); expect(states.at(-1).kind).toBe('showdown');
    expect(states.some(s=>s.action?.move==='fold')).toBe(true);
    expect(states.filter(s=>s.kind==='street')).toHaveLength(3);
    expect(proof.openings).toHaveLength(9); // own 2 + opponent showdown 2 + board 5
    expect(proof.showdownPositions['0']).toBeUndefined();
    expect(proof.showdownPositions['1']).toHaveLength(2);
    expect(proof.showdownPositions['2']).toHaveLength(2);
    const foldedViewer=await replay(id,users[0]);
    expect(foldedViewer.openings).toHaveLength(11); // own folded cards remain visible to owner
    await expect(replay(id,users[6])).rejects.toThrow('HAND_NOT_FOUND');
    const history=(await query('select poker_hand_history_v1($1,$2,null) h',[users[1],id]))[0].h;
    expect(history.hands.map(h=>h.handNo)).toEqual([1]);
    // Historical access uses the frozen roster, even after current seating disappears.
    await query('delete from poker_seats_v1 where table_id=$1 and user_id=$2',[id,users[1]]);
    expect((await replay(id)).root).toBe(proof.root);
  });
  it('does not expose unshown cards when a hand ends by folding',async()=>{
    const id=await createHand(2); await finish(id,true);
    const proof=await replay(id);
    expect(proof.openings).toHaveLength(2); expect(proof.showdownPositions).toEqual({});
    expect((await verifyReplay(proof)).at(-1).action.move).toBe('fold');
  });
  it('rejects swapped cards, another hand, edited events and truncated histories',async()=>{
    const id=await createHand(); await finish(id);
    const proof=await replay(id);
    const changedCard=structuredClone(proof);changedCard.openings[0].card.rank=99;
    await expect(verifyReplay(changedCard)).rejects.toThrow();
    const changedEvent=structuredClone(proof);changedEvent.steps[1].canonical+=' ';
    await expect(verifyReplay(changedEvent)).rejects.toThrow('hash mismatch');
    await expect(verifyReplay({...proof,handNo:2})).rejects.toThrow('commitment mismatch');
    await expect(verifyReplay({...proof,steps:proof.steps.slice(1)})).rejects.toThrow('Incomplete');
    const memory=new Map();const storage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)};
    expect(rememberDealRoot(proof,storage)).toBe(false);expect(rememberDealRoot(proof,storage)).toBe(true);
    expect(()=>rememberDealRoot({...proof,root:'f'.repeat(64)},storage)).toThrow('changed');
  });
  it('keeps timeout actions in the same verifiable sequence',async()=>{
    const id=await createHand(2);
    await query("update poker_tables_v1 set turn_deadline_at=clock_timestamp()-interval '1 second' where id=$1",[id]);
    await query('select poker_timeout_turn_v1($1)',[id]);
    const states=await verifyReplay(await replay(id));
    expect(states.at(-1).action).toMatchObject({move:'fold',timeout:true});
  });
  it('denies direct client access to the archive and actor-selecting RPCs',async()=>{
    const [permissions]=await query(`select has_table_privilege('authenticated','public.poker_hand_ledger_v1','SELECT') readable,
      has_function_privilege('authenticated','public.poker_hand_replay_v1(uuid,uuid,integer,integer)','EXECUTE') callable`);
    expect(permissions).toEqual({readable:false,callable:false});
  });
  it('returns bounded replay pages without losing the complete hash chain',async()=>{
    const id=await createHand(6); const raises={preflop:40,flop:40,turn:10,river:0};
    for(let i=0;i<180;i++){
      const [t]=await query('select * from poker_tables_v1 where id=$1',[id]);
      if(t.status==='complete')break;
      if(t.status==='showdown'){
        if(t.street==='river'){
          const [{pot}]=await query('select sum(committed)::int pot from poker_seats_v1 where table_id=$1',[id]);
          await query('select poker_settle_v1($1,$2::bigint,$3::jsonb)',[id,t.version,JSON.stringify([{seat:0,chips:pot}])]);
        }else await query('select poker_advance_v1($1)',[id]);
      }else{
        const [s]=await query('select * from poker_seats_v1 where table_id=$1 and seat_no=$2::int',[id,t.turn_index]);
        const raise=raises[t.street]-->0;
        const move=raise?(t.current_bet?'raise':'bet'):(s.street_bet<t.current_bet?'call':'check');
        await query('select poker_action_v3($1,$2,gen_random_uuid(),$3::bigint,$4,$5::bigint,false)',[id,s.user_id,t.version,move,raise?t.current_bet+t.min_raise:0]);
      }
    }
    const first=await replay(id);expect(first.steps).toHaveLength(100);expect(first.lastStep).toBeGreaterThan(99);
    const next=await replay(id,users[1],100);const combined={...first,steps:[...first.steps,...next.steps]};
    expect((await verifyReplay(combined)).at(-1).status).toBe('complete');
  });
  it('binds HTTP replay requests to the authenticated actor and denies outsiders',async()=>{
    const id=await createHand();await finish(id,true);let handler;
    const client={
      auth:{getUser:async token=>({data:{user:users.includes(token)?{id:token}:null},error:null})},
      from:table=>({select(){return this;},eq(){return this;},maybeSingle:async()=>({data:table==='profiles'?{is_excluded:false}:{role:'player'},error:null})}),
      rpc:async(name,params)=>{
        try {
          const args=Object.keys(params).map((key,i)=>`${key} => $${i+1}`).join(',');
          const [row]=await query(`select public.${name}(${args}) result`,Object.values(params));
          return {data:row.result,error:null};
        }catch(error){return {data:null,error:{message:error.message}};}
      },
    };
    const source=readFileSync('supabase/functions/poker-table-v1/index.ts','utf8').replace(/^import .*\n/,'');
    vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText,{
      createClient:()=>client,Response,Deno:{serve:fn=>{handler=fn;},env:{get:()=> 'synthetic'}},
    });
    const request=(user,body)=>handler(new Request('https://example.test',{method:'POST',headers:{authorization:'Bearer '+user},body:JSON.stringify(body)}));
    const own=await request(users[1],{action:'replay',tableId:id,handNo:1});expect(own.status).toBe(200);
    expect((await own.json()).openings).toHaveLength(9);
    const outsider=await request(users[6],{action:'replay',tableId:id,handNo:1,userId:users[1]});expect(outsider.status).toBe(404);
    expect(await outsider.json()).not.toHaveProperty('openings');
    const list=await request(users[6],{action:'history',tableId:id});expect((await list.json()).hands).toEqual([]);
    expect((await request('invalid',{action:'replay',tableId:id,handNo:1})).status).toBe(401);
  });
  it('locks a fresh correct deal after tournament tables consolidate',async()=>{
    const [event]=await query(`insert into poker_events_v1(name,format,created_by,status,config)
      values('Synthetic tournament','scheduled_mtt',$1,'registration',
      '{"maxPlayers":7,"seatsPerTable":6,"startingStack":1000,"startAt":"2020-01-01","levels":[{"smallBlind":5,"bigBlind":10,"durationSeconds":1000}]}') returning id`,[users[0]]);
    for(const user of users)await query('select poker_event_register_v1($1,$2)',[event.id,user]);
    await query('select poker_event_start_v1($1,$2,0,gen_random_uuid())',[event.id,users[0]]);
    const tables=await query('select t.id,t.owner_id,count(*) n from poker_tables_v1 t join poker_seats_v1 s on s.table_id=t.id where t.event_id=$1 group by t.id order by n desc',[event.id]);
    const start=async(t,hand)=>{
      const seed='synthetic-tournament-seed';const {deck,commitment}=await shuffleCommittedDeck(seed,`${t.id}:${hand}`);
      await query('select poker_start_v2($1::uuid,$2::uuid,$3::jsonb,$4,$5,$6::int)',[t.id,t.owner_id,JSON.stringify(deck),commitment,seed,hand]);
    };
    for(const t of tables)await start(t,1);
    // Synthetic post-hand checkpoint: one elimination, all 7,000 chips retained.
    await query("update poker_tables_v1 set status='complete' where event_id=$1",[event.id]);
    for(const t of tables)await query('update poker_seats_v1 set stack=1000,committed=0,street_bet=0 where table_id=$1',[t.id]);
    await query('update poker_seats_v1 set stack=0 where table_id=$1 and seat_no=0',[tables[1].id]);
    await query('update poker_seats_v1 set stack=2000 where table_id=$1 and seat_no=0',[tables[0].id]);
    await query('select poker_event_sync_v1($1)',[event.id]);await start(tables[0],2);
    const [table]=await query('select dealt_count from poker_tables_v1 where id=$1',[tables[0].id]);expect(table.dealt_count).toBe(6);
    await query("update poker_tables_v1 set status='showdown' where id=$1",[tables[0].id]);await query('select poker_advance_v1($1)',[tables[0].id]);
    const duplicates=await query(`select b.card from poker_tables_v1 t cross join lateral jsonb_array_elements(t.board) b(card)
      join poker_seats_v1 s on s.table_id=t.id cross join lateral jsonb_array_elements(s.private_hole) h(card)
      where t.id=$1 and b.card=h.card`,[tables[0].id]);expect(duplicates).toEqual([]);
    const [proof]=await query('select poker_hand_replay_v1($1,$2,2,0) r',[tables[0].owner_id,tables[0].id]);
    expect(proof.r.dealAssignments).toHaveLength(6);expect(await verifyDealProof(proof.r)).toBe(true);
  });
  it('can run out a committed hand when blind posting leaves no acting seat',async()=>{
    const [table]=await query('select poker_create_v1($1) id',[users[0]]);
    await query('select poker_join_v1($1,$2)',[table.id,users[1]]);
    await query('update poker_seats_v1 set stack=case when seat_no=0 then 5 else 1995 end where table_id=$1',[table.id]);
    const seed='synthetic-short-blind-seed';const {deck,commitment}=await shuffleCommittedDeck(seed,table.id+':1');
    await query('select poker_start_v2($1::uuid,$2::uuid,$3::jsonb,$4,$5,1)',[table.id,users[0],JSON.stringify(deck),commitment,seed]);
    const [started]=await query('select status,turn_index from poker_tables_v1 where id=$1',[table.id]);
    expect(started).toEqual({status:'showdown',turn_index:null});await finish(table.id);
    expect((await verifyReplay(await replay(table.id))).at(-1).status).toBe('complete');
  });
});
