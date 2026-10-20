-- Non-destructive regression smoke: all created records are rolled back.
-- Requires two existing auth.users accounts in this staging project.
BEGIN;
DO $test$
DECLARE users uuid[];ev uuid;v_table uuid;v_owner uuid;reply jsonb;deck jsonb;seed text;commitment text;actor uuid;action_id uuid;button_before integer;total bigint;
BEGIN
 IF has_function_privilege('authenticated','public.poker_event_start_v1(uuid,uuid,bigint,uuid)','EXECUTE') THEN
  RAISE EXCEPTION 'AUTHENTICATED_ROLE_HAS_INTERNAL_EVENT_START_PERMISSION';
 END IF;
 SELECT array_agg(id ORDER BY id) INTO users FROM (SELECT id FROM auth.users ORDER BY id LIMIT 2) x;
 IF coalesce(array_length(users,1),0)<2 THEN RAISE EXCEPTION 'REQUIRES_TWO_TEST_ACCOUNTS';END IF;
 reply=public.poker_event_create_v1(users[1],gen_random_uuid(),'Smoke SNG event','sit_and_go',
 '{"maxPlayers":2,"seatsPerTable":6,"tableCount":1,"startingStack":1000,"levels":[{"level":1,"smallBlind":5,"bigBlind":10,"ante":0,"durationSeconds":600},{"level":2,"smallBlind":10,"bigBlind":20,"ante":0,"durationSeconds":600}]}'::jsonb);
 ev=(reply->>'eventId')::uuid;
 PERFORM public.poker_event_publish_v1(ev,users[1],0,gen_random_uuid());
 PERFORM public.poker_event_register_v1(ev,users[1]);
 PERFORM public.poker_event_register_v1(ev,users[2]);
 PERFORM public.poker_event_register_v1(ev,users[2]);
 reply=public.poker_event_start_v1(ev,users[1],1,gen_random_uuid());
 IF (reply->>'tables')::int<>1 OR (reply->>'players')::int<>2 THEN RAISE EXCEPTION 'WRONG_EVENT_START %',reply;END IF;
 SELECT id,owner_id INTO v_table,v_owner FROM public.poker_tables_v1 WHERE event_id=ev;
 SELECT jsonb_agg(jsonb_build_object('rank',rank,'suit',suit) ORDER BY suit,rank)
 INTO deck FROM unnest(array['c','d','h','s']) suit CROSS JOIN generate_series(2,14) rank;
 seed=repeat('a',32);
 commitment=encode(extensions.digest(seed||':'||v_table::text||':1','sha256'),'hex');
 PERFORM public.poker_start_v2(v_table,v_owner,deck,commitment,seed,1);
 SELECT button INTO button_before FROM public.poker_tables_v1 WHERE id=v_table;
 SELECT user_id INTO actor FROM public.poker_seats_v1
 WHERE table_id=v_table AND seat_no=(SELECT turn_index FROM public.poker_tables_v1 WHERE id=v_table);
 action_id=gen_random_uuid();
 reply=public.poker_action_v1(v_table,actor,action_id,1,'fold',0);
 IF reply IS DISTINCT FROM public.poker_action_v1(v_table,actor,action_id,1,'fold',0) THEN RAISE EXCEPTION 'IDEMPOTENCY_FAILED';END IF;
 SELECT sum(stack+committed) INTO total FROM public.poker_seats_v1 WHERE table_id=v_table;
 IF total<>2000 THEN RAISE EXCEPTION 'CHIP_CONSERVATION_FAILED';END IF;
 seed=repeat('b',32);commitment=encode(extensions.digest(seed||':'||v_table::text||':2','sha256'),'hex');
 PERFORM public.poker_start_v2(v_table,v_owner,deck,commitment,seed,2);
 IF (SELECT button FROM public.poker_tables_v1 WHERE id=v_table)=button_before THEN RAISE EXCEPTION 'BUTTON_DID_NOT_ROTATE';END IF;
END $test$;
ROLLBACK;
