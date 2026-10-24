-- Integrity guards for the existing server-known practice deck.
-- This migration does not implement dealer-blind encryption or shuffle proofs.
create or replace function public.poker_capture_dealt_count_v1()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare card jsonb; distinct_cards integer;
begin
  if new.hand_no is distinct from old.hand_no then
    if new.hand_no <> old.hand_no + 1 or old.status not in ('waiting','complete') then
      raise exception 'INVALID_HAND_TRANSITION';
    end if;
    if jsonb_typeof(new.private_deck) is distinct from 'array' then
      raise exception 'INVALID_POKER_DECK';
    end if;
    if jsonb_array_length(new.private_deck) <> 52 then
      raise exception 'INVALID_POKER_DECK';
    end if;
    for card in select value from jsonb_array_elements(new.private_deck) loop
      if jsonb_typeof(card) is distinct from 'object' then
        raise exception 'INVALID_POKER_CARD';
      end if;
      if (select count(*) from jsonb_object_keys(card)) <> 2
         or not (card ? 'rank' and card ? 'suit')
         or jsonb_typeof(card->'rank') is distinct from 'number'
         or (card->>'rank') !~ '^(2|3|4|5|6|7|8|9|10|11|12|13|14)$'
         or jsonb_typeof(card->'suit') is distinct from 'string'
         or (card->>'suit') not in ('c','d','h','s') then
        raise exception 'INVALID_POKER_CARD';
      end if;
    end loop;
    -- Identity is rank+suit, never arbitrary JSON metadata on a card object.
    select count(distinct ((value->>'rank') || ':' || (value->>'suit')))
      into distinct_cards from jsonb_array_elements(new.private_deck);
    if distinct_cards <> 52 then raise exception 'DUPLICATE_POKER_CARD'; end if;
    -- Recalculate on EVERY new hand, including after tournament consolidation.
    select count(*) into new.dealt_count from public.poker_seats_v1
      where table_id = new.id and not folded;
    if new.dealt_count not between 2 and (case when new.variant='omaha' then 6 else 8 end) then raise exception 'INVALID_PLAYER_COUNT'; end if;
  elsif new.private_deck is distinct from old.private_deck
     or new.seed_secret is distinct from old.seed_secret
     or new.deck_commitment is distinct from old.deck_commitment
     or new.dealt_count is distinct from old.dealt_count
     or new.variant is distinct from old.variant then
    raise exception 'POKER_DECK_IMMUTABLE_DURING_HAND';
  end if;
  return new;
end $$;

-- Server-known, committed practice-poker deals and owner-scoped replay.
-- Commitments are recorded before hole cards are assigned and before betting opens.
-- They detect changes relative to an observed commitment, not a malicious operator
-- selecting a deck before publishing it. Hidden/folded opponent cards stay private.
create table public.poker_hand_ledger_v1 (
 table_id uuid not null references public.poker_tables_v1(id),
 hand_no integer not null check(hand_no>0),
 created_at timestamptz not null default clock_timestamp(),
 algorithm text not null default 'poker-deck-v1',
 seed_commitment text not null,
 deck_root text not null check(length(deck_root)=64),
 deal_layout text not null,
 card_hashes jsonb not null,
 private_openings jsonb not null,
 participants jsonb not null,
 board_positions jsonb not null,
 primary key(table_id,hand_no)
);
create table public.poker_hand_steps_v1 (
 table_id uuid not null, hand_no integer not null,
 step integer not null, version bigint not null,
 canonical_payload text not null,
 previous_hash text not null, event_hash text not null,
 primary key(table_id,hand_no,step), unique(table_id,hand_no,version),
 foreign key(table_id,hand_no) references public.poker_hand_ledger_v1(table_id,hand_no)
);
alter table public.poker_hand_ledger_v1 enable row level security;
alter table public.poker_hand_steps_v1 enable row level security;
revoke all on public.poker_hand_ledger_v1,public.poker_hand_steps_v1 from public,anon,authenticated;
grant select,insert on public.poker_hand_ledger_v1,public.poker_hand_steps_v1 to service_role;

create function public.poker_ledger_immutable_v1() returns trigger
language plpgsql security invoker set search_path='' as $$
begin raise exception 'POKER_LEDGER_APPEND_ONLY'; end $$;
create trigger poker_ledger_immutable before update or delete on public.poker_hand_ledger_v1
 for each row execute function public.poker_ledger_immutable_v1();
create trigger poker_steps_immutable before update or delete on public.poker_hand_steps_v1
 for each row execute function public.poker_ledger_immutable_v1();

create function public.poker_commit_plan_v1(p_table uuid,p_hand integer,p_deck jsonb,p_commitment text,p_button integer)
returns void language plpgsql security invoker set search_path='' as $$
declare hashes jsonb:='[]'; openings jsonb:='[]'; people jsonb:='[]';
 salt text; hash text; card jsonb; person record; n integer; idx integer:=0; i integer; root text; layout text; board_slots jsonb; hole_count integer; seat_limit integer; slots jsonb;
begin
 -- Caller holds the table lock. A second plan for the same hand cannot replace it.
 select case when variant='omaha' then 4 else 2 end,case when variant='omaha' then 6 else 8 end into hole_count,seat_limit from public.poker_tables_v1 where id=p_table;
 select count(*) into n from public.poker_seats_v1 where table_id=p_table and stack>0;
 for i in 0..51 loop
  card:=p_deck->i;
  salt:=encode(extensions.gen_random_bytes(32),'hex');
  hash:=encode(extensions.digest('poker-card-v1|'||p_table::text||'|'||p_hand::text||'|'||i::text||'|'||
   (card->>'rank')||'|'||(card->>'suit')||'|'||salt,'sha256'),'hex');
  hashes:=hashes||jsonb_build_array(hash);
  openings:=openings||jsonb_build_array(jsonb_build_object('position',i,'card',card,'salt',salt,'hash',hash));
 end loop;
 for person in select seat_no,user_id from public.poker_seats_v1 where table_id=p_table and stack>0
  order by (seat_no-p_button+seat_limit)%seat_limit loop
  select jsonb_agg(idx+k*n order by k) into slots from generate_series(0,hole_count-1) k;
  people:=people||jsonb_build_array(jsonb_build_object('seatNo',person.seat_no,'userId',person.user_id,
   'holePositions',slots));
  idx:=idx+1;
 end loop;
 board_slots:=jsonb_build_array(hole_count*n+1,hole_count*n+2,hole_count*n+3,hole_count*n+5,hole_count*n+7);
 select 'poker-layout-v1|'||p_button::text||'|'||string_agg((value->>'seatNo')||':'||(select string_agg(v#>>'{}',',' order by o) from jsonb_array_elements(value->'holePositions') with ordinality h(v,o)),';' order by ord)
  ||'|'||(hole_count*n+1)::text||','||(hole_count*n+2)::text||','||(hole_count*n+3)::text||','||(hole_count*n+5)::text||','||(hole_count*n+7)::text into layout
  from jsonb_array_elements(people) with ordinality a(value,ord);
 select encode(extensions.digest('poker-deck-v1|'||p_table::text||'|'||p_hand::text||'|'||
  string_agg(value#>>'{}','' order by ord)||'|'||layout,'sha256'),'hex') into root
  from jsonb_array_elements(hashes) with ordinality a(value,ord);
 insert into public.poker_hand_ledger_v1(table_id,hand_no,seed_commitment,deck_root,deal_layout,card_hashes,private_openings,participants,board_positions)
 values(p_table,p_hand,p_commitment,root,layout,hashes,openings,people,board_slots);
end $$;

-- Keep the existing atomic start and action code, adding hooks inside the same transaction.
do $$
declare definition text; old_fragment text; fn text;
begin
 foreach fn in array array['public.poker_start_v2(uuid,uuid,jsonb,text,text,integer)','public.poker_start_omaha_v1(uuid,uuid,jsonb,text,text,integer)'] loop
 select pg_get_functiondef(fn::regprocedure) into definition;
 old_fragment:=' for entry in select seat_no from public.poker_seats_v1';
 if position(old_fragment in definition)=0 or position('poker_commit_plan_v1' in definition)>0 then raise exception 'POKER_START_LEDGER_PATCH_MISMATCH'; end if;
 definition:=replace(definition,old_fragment,
  ' perform public.poker_commit_plan_v1(p_table,p_hand_no,p_deck,p_commitment,button_no);'||chr(10)||old_fragment);
 old_fragment:='set status=''playing'',version=version+1,button=button_no,turn_index=actor';
 if position(old_fragment in definition)=0 then raise exception 'POKER_START_STATUS_PATCH_MISMATCH'; end if;
 definition:=replace(definition,old_fragment,
  'set status=case when actor is null then ''showdown'' else ''playing'' end,version=version+1,button=button_no,turn_index=actor');
 execute definition;
 end loop;
 select pg_get_functiondef('public.poker_action_v3(uuid,uuid,uuid,bigint,text,bigint,boolean)'::regprocedure) into definition;
 old_fragment:=' UPDATE public.poker_tables_v1 SET version=version+1,last_action_at=clock_timestamp()';
 if position(old_fragment in definition)=0 then raise exception 'POKER_ACTION_LEDGER_PATCH_MISMATCH'; end if;
 definition:=replace(definition,old_fragment,
  ' PERFORM pg_catalog.set_config(''ig.poker_action'',jsonb_build_object(''move'',p_action,''seatNo'',s.seat_no,''chipsCommitted'',paid,''timeout'',p_system_timeout)::text,true);'||chr(10)||old_fragment);
 execute definition;
end $$;

create function public.poker_capture_step_v1() returns trigger
language plpgsql security invoker set search_path='' as $$
declare h public.poker_hand_ledger_v1%rowtype; prev text; step_no integer;
 payload jsonb; prev_state jsonb; seat_state jsonb; payouts jsonb; kind text; action jsonb; settings text;
begin
 if new.version=old.version or new.hand_no<1 then return new; end if;
 select * into h from public.poker_hand_ledger_v1 where table_id=new.id and hand_no=new.hand_no;
 if not found then
  -- Hands already running at rollout are not retroactively certified.
  if new.hand_no<>old.hand_no then raise exception 'LOCKED_DEAL_REQUIRED'; end if;
  return new;
 end if;
 select step+1,event_hash,canonical_payload::jsonb into step_no,prev,prev_state from public.poker_hand_steps_v1
  where table_id=new.id and hand_no=new.hand_no order by step desc limit 1;
 if new.hand_no<>old.hand_no then kind:='deal';
 elsif prev_state->>'street'<>new.street then kind:='street';
 elsif new.status='complete' and old.status='showdown' then kind:='showdown';
 elsif new.turn_deadline_at is distinct from old.turn_deadline_at and new.turn_extension_used then kind:='time_extension';
 else kind:='action'; end if;
 settings:=current_setting('ig.poker_action',true);
 if kind='action' and nullif(settings,'') is not null then action:=settings::jsonb; end if;
 perform pg_catalog.set_config('ig.poker_action','',true);
 select coalesce(jsonb_agg(jsonb_build_object('seatNo',seat_no,'stack',stack,'committed',committed,
  'streetBet',street_bet,'folded',folded,'allIn',all_in) order by seat_no),'[]') into seat_state
  from public.poker_seats_v1 where table_id=new.id;
 if new.status='complete' then
  select coalesce(jsonb_agg(jsonb_build_object('seatNo',s->'seatNo','chips',(s->>'stack')::bigint-(p->>'stack')::bigint)),'[]') into payouts
   from jsonb_array_elements(seat_state) s join jsonb_array_elements(prev_state->'seats') p on s->>'seatNo'=p->>'seatNo'
   where (s->>'stack')::bigint>(p->>'stack')::bigint;
 end if;
 step_no:=coalesce(step_no,0); prev:=coalesce(prev,h.deck_root);
 payload:=jsonb_build_object('tableId',new.id,'handNo',new.hand_no,'step',step_no,'version',new.version,
  'kind',kind,'action',action,'recordedAt',clock_timestamp(),'status',new.status,'street',new.street,
  'button',new.button,'turnIndex',new.turn_index,'smallBlind',new.small_blind,'bigBlind',new.big_blind,
  'board',new.board,'seats',seat_state,'payouts',coalesce(payouts,'[]'::jsonb));
 insert into public.poker_hand_steps_v1 values(new.id,new.hand_no,step_no,new.version,payload::text,prev,
  encode(extensions.digest('poker-step-v1|'||prev||'|'||payload::text,'sha256'),'hex'));
 return new;
end $$;
create trigger poker_capture_step after update on public.poker_tables_v1
 for each row execute function public.poker_capture_step_v1();

create function public.poker_hand_history_v1(p_actor uuid,p_table uuid,p_before integer default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 select coalesce(jsonb_agg(item order by hand_no desc),'[]') into result from (
  select h.hand_no,jsonb_build_object('handNo',h.hand_no,'createdAt',h.created_at,'root',h.deck_root) item
  from public.poker_hand_ledger_v1 h
  where h.table_id=p_table and (p_before is null or h.hand_no<p_before)
   and exists(select 1 from jsonb_array_elements(h.participants) p where p->>'userId'=p_actor::text)
   and exists(select 1 from public.poker_hand_steps_v1 s where s.table_id=h.table_id and s.hand_no=h.hand_no
    and (s.canonical_payload::jsonb)->>'status'='complete')
  order by h.hand_no desc limit 21
 ) page;
 return jsonb_build_object('hands',result);
end $$;

create function public.poker_hand_replay_v1(p_actor uuid,p_table uuid,p_hand integer,p_from integer default 0)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare h public.poker_hand_ledger_v1%rowtype; me jsonb; frames jsonb; last_frame jsonb;
 head jsonb; positions jsonb; visible jsonb; showdown_positions jsonb:='{}'; other jsonb; s jsonb; last_step integer; complete boolean;
begin
 if p_from<0 then raise exception 'INVALID_REPLAY_OFFSET'; end if;
 select * into h from public.poker_hand_ledger_v1 where table_id=p_table and hand_no=p_hand;
 if not found then raise exception 'HAND_NOT_FOUND'; end if;
 select value into me from jsonb_array_elements(h.participants) where value->>'userId'=p_actor::text;
 if me is null then raise exception 'HAND_NOT_FOUND'; end if;
 select canonical_payload::jsonb,step into last_frame,last_step from public.poker_hand_steps_v1
  where table_id=p_table and hand_no=p_hand order by step desc limit 1;
 select jsonb_build_object('canonical',canonical_payload,'previousHash',previous_hash,'hash',event_hash) into head
  from public.poker_hand_steps_v1 where table_id=p_table and hand_no=p_hand order by step desc limit 1;
 complete:=last_frame->>'status'='complete';
 -- During live play this returns proofs for the currently visible cards only.
 positions:=me->'holePositions';
 for s in select value from jsonb_array_elements(h.board_positions) with ordinality x(value,ord)
  where ord<=jsonb_array_length(last_frame->'board') loop positions:=positions||jsonb_build_array(s); end loop;
 if complete and last_frame->>'kind'='showdown' then
  for other in select value from jsonb_array_elements(h.participants) loop
   if exists(select 1 from jsonb_array_elements(last_frame->'seats') seat
    where seat->>'seatNo'=other->>'seatNo' and seat->>'folded'='false') then
    positions:=positions||(other->'holePositions');
    showdown_positions:=showdown_positions||jsonb_build_object(other->>'seatNo',other->'holePositions');
   end if;
  end loop;
 end if;
 select coalesce(jsonb_agg(o order by (o->>'position')::int),'[]') into visible
  from jsonb_array_elements(h.private_openings) o where positions @> jsonb_build_array((o->>'position')::int);
 select coalesce(jsonb_agg(item order by step),'[]') into frames from (
  select step,jsonb_build_object('canonical',canonical_payload,'previousHash',previous_hash,'hash',event_hash) item
  from public.poker_hand_steps_v1 where table_id=p_table and hand_no=p_hand and step>=p_from
  order by step limit 100
 ) page;
 return jsonb_build_object('tableId',p_table,'handNo',p_hand,'algorithm',h.algorithm,'root',h.deck_root,
  'variant',case when jsonb_array_length(me->'holePositions')=4 then 'omaha' else 'holdem' end,'seedCommitment',h.seed_commitment,'dealLayout',h.deal_layout,
  'dealAssignments',(select jsonb_agg(jsonb_build_object('seatNo',p->'seatNo','holePositions',p->'holePositions') order by ord) from jsonb_array_elements(h.participants) with ordinality a(p,ord)),'cardHashes',h.card_hashes,'openings',visible,'mySeat',me->'seatNo',
  'myPositions',me->'holePositions','showdownPositions',showdown_positions,'boardPositions',h.board_positions,'steps',frames,'head',head,'lastStep',last_step,'complete',complete);
end $$;

revoke all on function public.poker_ledger_immutable_v1() from public,anon,authenticated;
revoke all on function public.poker_commit_plan_v1(uuid,integer,jsonb,text,integer) from public,anon,authenticated;
revoke all on function public.poker_capture_step_v1() from public,anon,authenticated;
revoke all on function public.poker_hand_history_v1(uuid,uuid,integer) from public,anon,authenticated;
revoke all on function public.poker_hand_replay_v1(uuid,uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.poker_commit_plan_v1(uuid,integer,jsonb,text,integer) to service_role;
grant execute on function public.poker_capture_step_v1() to service_role;
grant execute on function public.poker_hand_history_v1(uuid,uuid,integer) to service_role;
grant execute on function public.poker_hand_replay_v1(uuid,uuid,integer,integer) to service_role;

do $$
declare definition text; old_fragment text:='order by (seat_no-t.button-1+6)%6 limit 1';
begin
 select pg_get_functiondef('public.poker_advance_v1(uuid)'::regprocedure) into definition;
 if position(old_fragment in definition)=0 then raise exception 'POKER_ADVANCE_ROTATION_PATCH_MISMATCH'; end if;
 execute replace(definition,old_fragment,'order by (seat_no-t.button-1+(case when t.variant=''omaha'' then 6 else 8 end))%(case when t.variant=''omaha'' then 6 else 8 end) limit 1');
end $$;

-- Automatic Crash refills top up to 25 queued rounds when fewer than five remain.
-- Existing queues drain naturally; no queued commitments are deleted or changed.
CREATE OR REPLACE FUNCTION public.ig_crash_v2_fill_queue()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare k integer; bytes bytea; r numeric; point numeric; duration integer; seed text; batch_count integer;
begin
 -- Use the same lock as round advancement, including standalone service calls.
 perform 1 from public.ig_crash_v2_runtime where singleton=1 for update;
 select count(*) into batch_count from public.ig_crash_v2_queue where status='queued';
 if batch_count >= 5 then return; end if;
 for k in 1..(25-batch_count) loop
  bytes:=extensions.gen_random_bytes(4);
  r:=(get_byte(bytes,0)::numeric*16777216 + get_byte(bytes,1)::numeric*65536
      + get_byte(bytes,2)::numeric*256+get_byte(bytes,3)::numeric)/4294967296.0;
  if r < 0.01 then point:=0;
  else point:=least(12000,round(0.99/(1-(r-0.01)/0.99),2)); end if;
  duration:=greatest(500,least(40000,round(40000*ln(1+point)/ln(12001))::integer));
  seed:=encode(extensions.gen_random_bytes(32),'hex');
  insert into public.ig_crash_v2_queue(seed_secret,crash_point,duration_ms,commitment)
   values(seed,point,duration,encode(extensions.digest(seed||':'||point::text||':'||duration::text,'sha256'),'hex'));
 end loop;
end $function$;
