-- Poker timer regression; run in Supabase staging SQL editor.
-- Requires two existing Auth users. All mutations are rolled back.
BEGIN;
DO $test$
DECLARE
  users uuid[];tid uuid;owner uuid;deck jsonb;seed text:=repeat('9',32);
  commitment text;actor uuid;baseline timestamptz;extended timestamptz;
  version_no bigint;seat_number int;idempotency uuid:=gen_random_uuid();
  response jsonb;again jsonb;actions int;receipts int;chips bigint;
BEGIN
  IF has_function_privilege('authenticated','public.poker_action_v3(uuid,uuid,uuid,bigint,text,bigint,boolean)','EXECUTE')
   OR has_function_privilege('authenticated','public.poker_buy_time_v1(uuid,uuid,uuid,bigint,text)','EXECUTE')
  THEN RAISE EXCEPTION 'CLIENT_HAS_PRIVILEGED_POKER_PERMISSION'; END IF;
  SELECT array_agg(id ORDER BY id) INTO users FROM (SELECT id FROM auth.users ORDER BY id LIMIT 2)a;
  IF array_length(users,1)<>2 THEN RAISE EXCEPTION 'NEED_TWO_STAGING_ACCOUNTS';END IF;
  tid=public.poker_create_v1(users[1],1000);
  PERFORM public.poker_join_v1(tid,users[2]);
  SELECT owner_id INTO owner FROM public.poker_tables_v1 WHERE id=tid;
  SELECT jsonb_agg(jsonb_build_object('rank',rank,'suit',suit) ORDER BY suit,rank)
    INTO deck FROM unnest(array['c','d','h','s'])suit CROSS JOIN generate_series(2,14)rank;
  commitment=encode(extensions.digest(seed||':'||tid::text||':1','sha256'),'hex');
  PERFORM public.poker_start_v2(tid,owner,deck,commitment,seed,1);
  SELECT t.version,t.turn_index,t.turn_deadline_at INTO version_no,seat_number,baseline
    FROM public.poker_tables_v1 t WHERE t.id=tid;
  SELECT user_id INTO actor FROM public.poker_seats_v1
    WHERE table_id=tid AND seat_no=seat_number;
  IF abs(extract(epoch FROM (baseline-clock_timestamp()))-10)>1 THEN RAISE EXCEPTION 'TURN_MUST_START_WITH_10_SECONDS';END IF;

  response=public.poker_buy_time_v1(tid,actor,idempotency,version_no,'PRACTICE');
  again=public.poker_buy_time_v1(tid,actor,idempotency,version_no,'PRACTICE');
  IF response IS DISTINCT FROM again OR (response->>'charged')::boolean<>false THEN
    RAISE EXCEPTION 'IDEMPOTENT_EXTENSION_FAILED';END IF;
  SELECT turn_deadline_at INTO extended FROM public.poker_tables_v1 WHERE id=tid;
  IF extract(epoch FROM (extended-baseline))<>30 THEN RAISE EXCEPTION 'EXTENSION_MUST_BE_30_SECONDS';END IF;
  SELECT count(*) INTO receipts FROM public.poker_timebank_receipts_v1 WHERE table_id=tid;
  IF receipts<>1 THEN RAISE EXCEPTION 'DOUBLE_EXTENSION_RECEIPT';END IF;
  BEGIN
    PERFORM public.poker_buy_time_v1(tid,actor,gen_random_uuid(),version_no+1,'PRACTICE');
    RAISE EXCEPTION 'SECOND_EXTENSION_GRANTED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM<>'TIMEBANK_NOT_AVAILABLE' THEN RAISE;END IF;
  END;
  UPDATE public.poker_tables_v1 SET turn_deadline_at=clock_timestamp()-interval '1 second' WHERE id=tid;
  BEGIN
    PERFORM public.poker_action_v3(tid,actor,gen_random_uuid(),version_no+1,'call',0,false);
    RAISE EXCEPTION 'LATE_BET_ACCEPTED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM<>'TURN_DEADLINE_EXPIRED' THEN RAISE;END IF;
  END;
  response=public.poker_timeout_turn_v1(tid);
  IF response->>'autoAction'<>'fold' OR (response->>'timedOut')::boolean<>true THEN
    RAISE EXCEPTION 'SERVER_MUST_FOLD_FACING_BET';END IF;
  SELECT count(*) INTO actions FROM public.poker_actions_v1 WHERE table_id=tid;
  SELECT sum(stack+committed) INTO chips FROM public.poker_seats_v1 WHERE table_id=tid;
  IF actions<>1 OR chips<>2000 THEN RAISE EXCEPTION 'DOUBLE_ACTION_OR_CHIP_LOSS';END IF;
END $test$;
ROLLBACK;
