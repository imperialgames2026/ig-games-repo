-- Local regression fixtures, all rolled back. No staging/production credentials.
BEGIN;
DO $test$
DECLARE
 users uuid[]:=array[gen_random_uuid(),gen_random_uuid(),gen_random_uuid()];
 tid uuid;deck jsonb;seed text:=repeat('c',32);commitment text;t public.poker_tables_v1%rowtype;
 n integer;chips bigint;variant_name text;joined integer;
BEGIN
 FOREACH tid IN ARRAY users LOOP
  insert into auth.users(id,email,role,aud,is_anonymous)
  values(tid,'poker-lifecycle-'||tid::text||'@example.invalid','authenticated','authenticated',false);
 END LOOP;
 SELECT jsonb_agg(jsonb_build_object('rank',rank,'suit',suit) order by suit,rank)
 INTO deck FROM unnest(array['c','d','h','s'])suit CROSS JOIN generate_series(2,14)rank;

 -- Sparse eight-seat table: first to the left of dealer 6 is seat 7, then
 -- clockwise wrapping past dealer 7 starts at seat 0. A six-seat modulus fails.
 tid=public.poker_create_v1(users[1],1000);
 perform public.poker_join_v1(tid,users[2]);
 perform public.poker_join_v1(tid,users[3]);
 update public.poker_seats_v1 set seat_no=6 where table_id=tid and user_id=users[1];
 update public.poker_seats_v1 set seat_no=0 where table_id=tid and user_id=users[2];
 update public.poker_seats_v1 set seat_no=7 where table_id=tid and user_id=users[3];
 update public.poker_tables_v1 set status='showdown',button=6,street='preflop',
  private_deck=deck,dealt_count=3 where id=tid;
 perform public.poker_advance_v1(tid);
 select * into t from public.poker_tables_v1 where id=tid;
 if t.turn_index<>7 or t.status<>'playing' or jsonb_array_length(t.board)<>3 then
  raise exception 'EIGHT_SEAT_POSTFLOP_ORDER_FAILED';end if;
 update public.poker_tables_v1 set status='showdown',button=7 where id=tid;
 perform public.poker_advance_v1(tid);
 select * into t from public.poker_tables_v1 where id=tid;
 if t.turn_index<>0 or jsonb_array_length(t.board)<>4 then
  raise exception 'EIGHT_SEAT_BUTTON_WRAP_FAILED';end if;

 -- For both games, posting both stacks as blinds must immediately allow board
 -- runout, with no impossible pending actor or artificial ten-second deadline.
 FOREACH variant_name IN ARRAY array['holdem','omaha'] LOOP
  if variant_name='holdem' then tid=public.poker_create_v1(users[1],1000);
  else tid=public.poker_create_omaha_v1(users[1],1000);end if;
  perform public.poker_join_v1(tid,users[2]);
  update public.poker_seats_v1 set stack=case when user_id=users[1] then 5 else 10 end where table_id=tid;
  commitment=encode(extensions.digest(seed||':'||tid::text||':1','sha256'),'hex');
  if variant_name='holdem' then perform public.poker_start_v2(tid,users[1],deck,commitment,seed,1);
  else perform public.poker_start_omaha_v1(tid,users[1],deck,commitment,seed,1);end if;
  select * into t from public.poker_tables_v1 where id=tid;
  if t.status<>'showdown' or t.turn_index is not null or t.turn_deadline_at is not null then
   raise exception 'ALL_IN_BLINDS_STALLED_%',variant_name;end if;
  for n in 1..3 loop perform public.poker_advance_v1(tid);end loop;
  select * into t from public.poker_tables_v1 where id=tid;
  select sum(stack+committed) into chips from public.poker_seats_v1 where table_id=tid;
  if t.street<>'river' or jsonb_array_length(t.board)<>5 or t.status<>'showdown' or chips<>15 then
   raise exception 'ALL_IN_RUNOUT_OR_CHIP_CONSERVATION_FAILED_%',variant_name;end if;
 END LOOP;

 -- Multiway short big blind: unlike a lone funded opponent, two funded
 -- players must complete the nominal ten-chip bring-in, not only five.
 FOREACH variant_name IN ARRAY array['holdem','omaha'] LOOP
  if variant_name='holdem' then tid=public.poker_create_v1(users[1],1000);
  else tid=public.poker_create_omaha_v1(users[1],1000);end if;
  perform public.poker_join_v1(tid,users[2]);
  perform public.poker_join_v1(tid,users[3]);
  update public.poker_seats_v1 set stack=3 where table_id=tid and user_id=users[3];
  commitment=encode(extensions.digest(seed||':'||tid::text||':1','sha256'),'hex');
  if variant_name='holdem' then perform public.poker_start_v2(tid,users[1],deck,commitment,seed,1);
  else perform public.poker_start_omaha_v1(tid,users[1],deck,commitment,seed,1);end if;
  select * into t from public.poker_tables_v1 where id=tid;
  if t.current_bet<>10 or t.status<>'playing' or t.turn_index<>0 then
   raise exception 'SHORT_BIG_BLIND_NOMINAL_BRING_IN_FAILED_%',variant_name;end if;
 END LOOP;

 -- A sole remaining funded blind owes only an actual posted bet, never the
 -- nominal big blind. A one-player betting round must not follow the flop.
 tid=public.poker_create_v1(users[1],1000);
 perform public.poker_join_v1(tid,users[2]);
 update public.poker_seats_v1 set stack=case when user_id=users[1] then 1000 else 3 end where table_id=tid;
 commitment=encode(extensions.digest(seed||':'||tid::text||':1','sha256'),'hex');
 perform public.poker_start_v2(tid,users[1],deck,commitment,seed,1);
 select * into t from public.poker_tables_v1 where id=tid;
 if t.current_bet<>5 or t.status<>'showdown' then raise exception 'SHORT_BLIND_CREATED_PHANTOM_BET';end if;
 perform public.poker_advance_v1(tid);
 select * into t from public.poker_tables_v1 where id=tid;
 if t.status<>'showdown' or t.turn_index is not null then raise exception 'SOLO_BETTING_ROUND_CREATED';end if;

 -- Joining between completed hands is permitted, but replaying the same join
 -- must preserve the existing stack and never create a second allocation.
 update public.poker_tables_v1 set status='complete' where id=tid;
 joined=public.poker_join_v1(tid,users[3]);
 update public.poker_seats_v1 set stack=17 where table_id=tid and user_id=users[3];
 if public.poker_join_v1(tid,users[3])<>joined then raise exception 'DUPLICATE_JOIN_CHANGED_SEAT';end if;
 select stack into chips from public.poker_seats_v1 where table_id=tid and user_id=users[3];
 if chips<>17 then raise exception 'JOIN_REPLAY_RESET_STACK';end if;
 if has_function_privilege('authenticated','public.poker_start_v2(uuid,uuid,jsonb,text,text,integer)','EXECUTE')
  or has_function_privilege('authenticated','public.poker_advance_v1(uuid)','EXECUTE') then
  raise exception 'CLIENT_CAN_EXECUTE_PRIVILEGED_POKER_RPC';end if;
END $test$;
ROLLBACK;
