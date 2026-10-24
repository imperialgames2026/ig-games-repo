begin;
do $qa$
declare qa_users uuid[]; qa_table uuid; qa_game text; qa_seed text; qa_deck jsonb; qa_commitment text; qa_t record; qa_s record; qa_proof jsonb; qa_folded_seat integer; qa_pot bigint; qa_winner integer; qa_i integer; qa_denied boolean;
begin
 select array_agg(id) into qa_users from (select id from auth.users order by id limit 3) users;
 if array_length(qa_users,1)<3 then raise exception 'QA_REQUIRES_THREE_EXISTING_ACCOUNTS';end if;
 select jsonb_agg(jsonb_build_object('rank',rank,'suit',suit) order by suit,rank) into qa_deck from generate_series(2,14) rank cross join unnest(array['c','d','h','s']) suit;
 foreach qa_game in array array['holdem','omaha'] loop
  if qa_game='holdem' then qa_table:=public.poker_create_v1(qa_users[1]);else qa_table:=public.poker_create_omaha_v1(qa_users[1],1000);end if;
  perform public.poker_join_v1(qa_table,qa_users[2]);perform public.poker_join_v1(qa_table,qa_users[3]);
  qa_seed:='rollback-only-deployment-check-'||gen_random_uuid()::text;
  qa_commitment:=encode(extensions.digest(qa_seed||':'||qa_table::text||':1','sha256'),'hex');
  if qa_game='holdem' then perform public.poker_start_v2(qa_table,qa_users[1],qa_deck,qa_commitment,qa_seed,1);else perform public.poker_start_omaha_v1(qa_table,qa_users[1],qa_deck,qa_commitment,qa_seed,1);end if;
  qa_proof:=public.poker_hand_replay_v1(qa_users[2],qa_table,1,0);
  if jsonb_array_length(qa_proof->'cardHashes')<>52 or jsonb_array_length(qa_proof->'openings')<>(case when qa_game='omaha' then 4 else 2 end) then raise exception 'LIVE_CARD_PROOF_FAILED';end if;
  for qa_i in 1..80 loop
   select * into qa_t from public.poker_tables_v1 where id=qa_table;
   exit when qa_t.status='complete';
   if qa_t.status='showdown' then
    if qa_t.street='river' then
     select sum(committed) into qa_pot from public.poker_seats_v1 where table_id=qa_table;
     select seat_no into qa_winner from public.poker_seats_v1 where table_id=qa_table and not folded order by seat_no limit 1;
     perform public.poker_settle_v1(qa_table,qa_t.version,jsonb_build_array(jsonb_build_object('seat',qa_winner,'chips',qa_pot)));
    else perform public.poker_advance_v1(qa_table);end if;
   else
    select * into qa_s from public.poker_seats_v1 where table_id=qa_table and seat_no=qa_t.turn_index;
    if qa_folded_seat is null then qa_folded_seat:=qa_s.seat_no;perform public.poker_action_v3(qa_table,qa_s.user_id,gen_random_uuid(),qa_t.version,'fold',0,false);
    else perform public.poker_action_v3(qa_table,qa_s.user_id,gen_random_uuid(),qa_t.version,case when qa_s.street_bet<qa_t.current_bet then 'call' else 'check' end,0,false);end if;
   end if;
  end loop;
  qa_proof:=public.poker_hand_replay_v1(qa_users[2],qa_table,1,0);
  if not (qa_proof->>'complete')::boolean or (qa_proof->'showdownPositions') ? qa_folded_seat::text then raise exception 'LIVE_REPLAY_PRIVACY_FAILED';end if;
  if jsonb_array_length(public.poker_hand_history_v1(qa_users[2],qa_table,null)->'hands')<>1 then raise exception 'LIVE_HISTORY_FAILED';end if;
  qa_denied:=false;
  begin perform public.poker_hand_replay_v1(gen_random_uuid(),qa_table,1,0);
  exception when others then if sqlerrm='HAND_NOT_FOUND' then qa_denied:=true;else raise;end if;end;
  if not qa_denied then raise exception 'LIVE_OUTSIDER_ACCESS_FAILED';end if;
  qa_folded_seat:=null;
 end loop;
 if has_table_privilege('authenticated','public.poker_hand_ledger_v1','SELECT') or has_function_privilege('authenticated','public.poker_hand_replay_v1(uuid,uuid,integer,integer)','EXECUTE') then raise exception 'LIVE_CLIENT_GRANTS_FAILED';end if;
end $qa$;
rollback;
select jsonb_build_object('holdem_and_omaha','passed','folded_privacy','passed','outsider_denial','passed','client_grants','passed','test_rows','rolled_back') as verification;
