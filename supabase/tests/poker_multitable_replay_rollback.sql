-- Four independent tables, three hands each, interleaved under one rollback.
-- Run several copies concurrently for overlapping independent transactions.
-- Existing Auth identities are read only as FK-backed fixture seats; no test rows remain.
begin;
set local statement_timeout='20000ms';
set local lock_timeout='3000ms';
do $qa$
declare
 qa_users uuid[]; qa_tables uuid[]:='{}'; qa_decks jsonb[]:='{}';
 qa_variants text[]:=array['holdem','omaha','holdem','omaha'];
 qa_counts integer[]:=array[8,6,3,3]; qa_roots text[]:='{}';
 qa_folded boolean[]; qa_hand integer; qa_index integer; qa_seat integer; qa_tick integer;
 qa_table uuid; qa_seed text; qa_deck jsonb; qa_commitment text; qa_proof jsonb; qa_history jsonb;
 qa_t record; qa_s record; qa_pot bigint; qa_winner integer; qa_active boolean; qa_request uuid;
 qa_event jsonb; qa_frame jsonb; qa_opening jsonb; qa_participant jsonb; qa_card record;
 qa_prev text; qa_hash text; qa_expected jsonb; qa_actual jsonb; qa_allowed jsonb;
 qa_step integer; qa_version bigint; qa_denied boolean;
begin
 select array_agg(id order by id) into qa_users from (select id from auth.users order by id limit 8) u;
 if coalesce(array_length(qa_users,1),0)<>8 then raise exception 'QA_REQUIRES_EIGHT_ACCOUNTS';end if;
 for qa_index in 1..4 loop
  if qa_variants[qa_index]='omaha' then qa_table:=public.poker_create_omaha_v1(qa_users[1],1000);
  else qa_table:=public.poker_create_v1(qa_users[1],1000);end if;
  qa_tables:=array_append(qa_tables,qa_table);
  for qa_seat in 2..qa_counts[qa_index] loop perform public.poker_join_v1(qa_table,qa_users[qa_seat]);end loop;
 end loop;
 for qa_hand in 1..3 loop
  qa_folded:=array[false,false,false,false];
  for qa_index in 1..4 loop
   qa_table:=qa_tables[qa_index];
   select jsonb_agg(jsonb_build_object('rank',rank,'suit',suit) order by random_order) into qa_deck
    from (select rank,suit,gen_random_uuid() random_order from generate_series(2,14) rank cross join unnest(array['c','d','h','s']) suit) cards;
   qa_decks[qa_index]:=qa_deck;
   qa_seed:=encode(extensions.gen_random_bytes(32),'hex');
   qa_commitment:=encode(extensions.digest(qa_seed||':'||qa_table::text||':'||qa_hand::text,'sha256'),'hex');
   if qa_variants[qa_index]='omaha' then perform public.poker_start_omaha_v1(qa_table,qa_users[1],qa_deck,qa_commitment,qa_seed,qa_hand);
   else perform public.poker_start_v2(qa_table,qa_users[1],qa_deck,qa_commitment,qa_seed,qa_hand);end if;
   qa_proof:=public.poker_hand_replay_v1(qa_users[2],qa_table,qa_hand,0);
   if jsonb_array_length(qa_proof->'cardHashes')<>52 or jsonb_array_length(qa_proof->'openings')<>(case when qa_variants[qa_index]='omaha' then 4 else 2 end)
    or jsonb_array_length(qa_proof->'steps')<>1 or (qa_proof->>'root')=any(qa_roots) or position(qa_seed in qa_proof::text)>0 then raise exception 'LIVE_DECK_ISOLATION_FAILED';end if;
   qa_roots:=array_append(qa_roots,qa_proof->>'root');
  end loop;
  -- Every table is playing before this loop starts. One action per table per tick.
  for qa_tick in 1..100 loop
   qa_active:=false;qa_request:=gen_random_uuid();
   for qa_index in 1..4 loop
    qa_table:=qa_tables[qa_index];select * into qa_t from public.poker_tables_v1 where id=qa_table;
    if qa_t.status='complete' then continue;end if;qa_active:=true;
    if qa_t.status='showdown' then
     if qa_t.street='river' then
      select sum(committed) into qa_pot from public.poker_seats_v1 where table_id=qa_table;
      select seat_no into qa_winner from public.poker_seats_v1 where table_id=qa_table and not folded order by seat_no limit 1;
      perform public.poker_settle_v1(qa_table,qa_t.version,jsonb_build_array(jsonb_build_object('seat',qa_winner,'chips',qa_pot)));
     else perform public.poker_advance_v1(qa_table);end if;
    else
     select * into qa_s from public.poker_seats_v1 where table_id=qa_table and seat_no=qa_t.turn_index;
     if qa_index%2=1 and not qa_folded[qa_index] then
      qa_folded[qa_index]:=true;perform public.poker_action_v3(qa_table,qa_s.user_id,qa_request,qa_t.version,'fold',0,false);
     else perform public.poker_action_v3(qa_table,qa_s.user_id,qa_request,qa_t.version,case when qa_s.street_bet<qa_t.current_bet then 'call' else 'check' end,0,false);end if;
    end if;
   end loop;
   exit when not qa_active;
  end loop;
  for qa_index in 1..4 loop
   qa_table:=qa_tables[qa_index];qa_deck:=qa_decks[qa_index];
   qa_proof:=public.poker_hand_replay_v1(qa_users[2],qa_table,qa_hand,0);
   if not (qa_proof->>'complete')::boolean or jsonb_array_length(qa_proof->'steps')<>(qa_proof->>'lastStep')::int+1 then raise exception 'LIVE_MULTITABLE_HAND_NOT_COMPLETE';end if;
   select private_deck into qa_actual from public.poker_tables_v1 where id=qa_table;
   if qa_actual<>qa_deck then raise exception 'LIVE_TABLE_DECK_CHANGED';end if;
   select encode(extensions.digest('poker-deck-v1|'||qa_table::text||'|'||qa_hand::text||'|'||string_agg(value#>>'{}','' order by ord)||'|'||(qa_proof->>'dealLayout'),'sha256'),'hex') into qa_hash
    from jsonb_array_elements(qa_proof->'cardHashes') with ordinality h(value,ord);
   if qa_hash<>qa_proof->>'root' then raise exception 'LIVE_ROOT_VERIFICATION_FAILED';end if;
   qa_prev:=qa_hash;qa_step:=0;qa_version:=-1;
   for qa_event in select value from jsonb_array_elements(qa_proof->'steps') loop
    qa_frame:=(qa_event->>'canonical')::jsonb;
    qa_hash:=encode(extensions.digest('poker-step-v1|'||qa_prev||'|'||(qa_event->>'canonical'),'sha256'),'hex');
    if qa_event->>'previousHash'<>qa_prev or qa_event->>'hash'<>qa_hash or qa_frame->>'tableId'<>qa_table::text
     or (qa_frame->>'handNo')::int<>qa_hand or (qa_frame->>'step')::int<>qa_step or (qa_frame->>'version')::bigint<=qa_version then raise exception 'LIVE_MULTITABLE_CHAIN_FAILED';end if;
    for qa_card in select value,ord from jsonb_array_elements(qa_frame->'board') with ordinality b(value,ord) loop
     if qa_card.value<>qa_deck->((qa_proof->'boardPositions'->>(qa_card.ord-1)::int)::int) then raise exception 'LIVE_BOARD_DECK_MIXED';end if;
    end loop;
    qa_prev:=qa_hash;qa_step:=qa_step+1;qa_version:=(qa_frame->>'version')::bigint;
   end loop;
   if qa_prev<>qa_proof->'head'->>'hash' then raise exception 'LIVE_REPLAY_HEAD_MIXED';end if;
   qa_allowed:=(qa_proof->'myPositions')||(qa_proof->'boardPositions');
   for qa_participant in select value from jsonb_array_elements(qa_proof->'dealAssignments') loop
    select jsonb_agg(qa_deck->(value#>>'{}')::int order by ord) into qa_expected from jsonb_array_elements(qa_participant->'holePositions') with ordinality p(value,ord);
    select private_hole into qa_actual from public.poker_seats_v1 where table_id=qa_table and seat_no=(qa_participant->>'seatNo')::int;
    if qa_actual<>qa_expected then raise exception 'LIVE_PRIVATE_CARDS_MIXED';end if;
    if exists(select 1 from jsonb_array_elements(qa_frame->'seats') s where s->>'seatNo'=qa_participant->>'seatNo' and (s->>'folded')::boolean=false)
     then qa_allowed:=qa_allowed||(qa_participant->'holePositions');end if;
   end loop;
   for qa_opening in select value from jsonb_array_elements(qa_proof->'openings') loop
    qa_seat:=(qa_opening->>'position')::int;
    qa_hash:=encode(extensions.digest('poker-card-v1|'||qa_table::text||'|'||qa_hand::text||'|'||qa_seat::text||'|'||(qa_opening->'card'->>'rank')||'|'||(qa_opening->'card'->>'suit')||'|'||(qa_opening->>'salt'),'sha256'),'hex');
    if qa_opening->'card'<>qa_deck->qa_seat or qa_hash<>qa_opening->>'hash' or qa_hash<>qa_proof->'cardHashes'->>qa_seat
     or not qa_allowed @> jsonb_build_array(qa_seat) then raise exception 'LIVE_CARD_PROOF_OR_PRIVACY_FAILED';end if;
   end loop;
  end loop;
 end loop;
 for qa_index in 1..4 loop
  qa_history:=public.poker_hand_history_v1(qa_users[2],qa_tables[qa_index],null);
  if jsonb_array_length(qa_history->'hands')<>3 then raise exception 'LIVE_HISTORY_TABLE_MIXED';end if;
  for qa_hand in 1..3 loop
   qa_proof:=public.poker_hand_replay_v1(qa_users[2],qa_tables[qa_index],qa_hand,0);
   if qa_proof->>'tableId'<>qa_tables[qa_index]::text or (qa_proof->>'handNo')::int<>qa_hand or not (qa_proof->>'complete')::boolean or qa_proof->>'root'<>qa_roots[(qa_hand-1)*4+qa_index] then raise exception 'LIVE_OLD_HAND_CHANGED';end if;
  end loop;
 end loop;
 qa_denied:=false;
 begin perform public.poker_hand_replay_v1(qa_users[8],qa_tables[4],1,0);
 exception when others then if sqlerrm='HAND_NOT_FOUND' then qa_denied:=true;else raise;end if;end;
 if not qa_denied then raise exception 'LIVE_CROSS_TABLE_ACCESS_ALLOWED';end if;
end $qa$;
rollback;
select jsonb_build_object('tables',4,'hands',12,'deck_and_card_isolation','passed','full_replay_hash_chains','passed','folded_privacy','passed','historical_hands','passed','cross_table_access_denied','passed','test_rows','rolled_back') verification;
