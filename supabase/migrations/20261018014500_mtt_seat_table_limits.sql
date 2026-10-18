-- Respect Superadmin seat and table caps for NLHE. Functions remain service-only.
CREATE OR REPLACE FUNCTION public.poker_event_start_v1(p_event uuid, p_actor uuid, p_version bigint, p_request uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE e public.poker_events_v1%rowtype;registered int;capacity int;max_seats int;table_count int;idx int:=0;table_index int;seat_idx int;tid uuid;owner uuid;participant record;level0 jsonb;existing record;
BEGIN
 SELECT * INTO e FROM public.poker_events_v1 WHERE id=p_event FOR UPDATE;
 IF NOT FOUND OR e.created_by<>p_actor THEN RAISE EXCEPTION 'EVENT_NOT_FOUND_OR_FORBIDDEN';END IF;
 SELECT operation,after_version INTO existing FROM public.poker_event_audit_v1 WHERE request_id=p_request AND event_id=p_event;
 IF FOUND THEN RETURN jsonb_build_object('eventId',p_event,'status','running','version',existing.after_version);END IF;
 IF e.status<>'registration' OR e.version<>p_version THEN RAISE EXCEPTION 'EVENT_STALE_OR_NOT_OPEN';END IF;
 SELECT count(*) INTO registered FROM public.poker_event_entries_v1 WHERE event_id=p_event;
 capacity=(e.config->>'maxPlayers')::int;max_seats=(e.config->>'seatsPerTable')::int;
 IF registered<2 OR (e.format='sit_and_go' AND registered<>capacity) THEN RAISE EXCEPTION 'NOT_ENOUGH_REGISTRATIONS';END IF;
 IF e.format='scheduled_mtt' AND now()<(e.config->>'startAt')::timestamptz THEN RAISE EXCEPTION 'START_TIME_NOT_REACHED';END IF;
 IF max_seats<6 OR max_seats>8 OR registered>capacity OR e.game<>'nl_holdem' THEN RAISE EXCEPTION 'BAD_SEAT_CONFIGURATION';END IF;
 table_count=ceil(registered::numeric/max_seats)::int;
 IF (e.config->>'tableCount')::integer NOT BETWEEN 1 AND 30 OR table_count>(e.config->>'tableCount')::integer THEN RAISE EXCEPTION 'CONFIGURED_TABLE_LIMIT'; END IF;
 IF registered<table_count*2 THEN RAISE EXCEPTION 'TABLE_NEEDS_TWO_PLAYERS';END IF;
 level0=e.config->'levels'->0;
 FOR table_index IN 0..table_count-1 LOOP
   SELECT user_id INTO owner FROM public.poker_event_entries_v1 WHERE event_id=p_event ORDER BY registered_at,user_id OFFSET table_index LIMIT 1;
   INSERT INTO public.poker_tables_v1(owner_id,event_id,small_blind,big_blind,min_raise)
   VALUES(owner,p_event,(level0->>'smallBlind')::bigint,(level0->>'bigBlind')::bigint,(level0->>'bigBlind')::bigint)
   RETURNING id INTO tid;
   -- Deal registrations round-robin, keeping each table >=2 when possible.
   seat_idx=0;
   FOR participant IN SELECT user_id,(row_number() over (order by registered_at,user_id)-1)::int AS position FROM public.poker_event_entries_v1 WHERE event_id=p_event LOOP
      -- Using stable registration position to allocate seats.
      IF (participant.position%table_count)=table_index THEN
        INSERT INTO public.poker_seats_v1(table_id,seat_no,user_id,stack)
        VALUES(tid,seat_idx,participant.user_id,(e.config->>'startingStack')::bigint);
        UPDATE public.poker_event_entries_v1 SET table_id=tid,seat_no=seat_idx,status='seated' WHERE event_id=p_event AND user_id=participant.user_id;
        seat_idx=seat_idx+1;
      END IF;
   END LOOP;
 END LOOP;
 UPDATE public.poker_events_v1 SET status='running',level_started_at=now(),current_level=1,version=version+1,updated_at=now() WHERE id=p_event;
 INSERT INTO public.poker_event_audit_v1(event_id,actor_id,operation,request_id,before_version,after_version,details)
 VALUES(p_event,p_actor,'start',p_request,e.version,e.version+1,jsonb_build_object('tables',table_count,'players',registered));
 RETURN jsonb_build_object('eventId',p_event,'status','running','version',e.version+1,'tables',table_count,'players',registered);
END $function$

CREATE OR REPLACE FUNCTION public.poker_event_sync_v1(p_event uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE e public.poker_events_v1%rowtype;alive int;tid uuid;from_table uuid;to_table uuid;player record;new_seat int;max_count int;min_count int;move_count int:=0;total_chips numeric;expected_chips numeric;champion uuid;old_version bigint;
BEGIN
 SELECT * INTO e FROM public.poker_events_v1 WHERE id=p_event FOR UPDATE;
 IF NOT FOUND OR e.status<>'running' THEN RAISE EXCEPTION 'EVENT_NOT_RUNNING';END IF;
 IF e.format='ring' THEN RETURN jsonb_build_object('eventId',p_event,'ring',true,'moved',0);END IF;
 PERFORM t.id FROM public.poker_tables_v1 t WHERE t.event_id=p_event ORDER BY t.id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.poker_tables_v1 WHERE event_id=p_event AND status IN ('playing','showdown')) THEN
  RETURN jsonb_build_object('eventId',p_event,'pendingHands',true);
 END IF;
 -- Busted tournament seats have zero chips and no active hand; release seats between hands.
 UPDATE public.poker_event_entries_v1 x SET status='eliminated',table_id=null,seat_no=null
 WHERE x.event_id=p_event AND EXISTS(SELECT 1 FROM public.poker_seats_v1 s WHERE s.table_id=x.table_id AND s.user_id=x.user_id AND s.stack=0 AND s.committed=0);
 DELETE FROM public.poker_seats_v1 s USING public.poker_tables_v1 t
 WHERE s.table_id=t.id AND t.event_id=p_event AND s.stack=0 AND s.committed=0;
 SELECT count(*) INTO alive FROM public.poker_seats_v1 s JOIN public.poker_tables_v1 t ON t.id=s.table_id WHERE t.event_id=p_event AND s.stack>0;
 IF alive>1 THEN
  IF alive<=greatest(6,least(8,(e.config->>'seatsPerTable')::int)) THEN
   SELECT t.id INTO tid FROM public.poker_tables_v1 t LEFT JOIN public.poker_seats_v1 s ON s.table_id=t.id AND s.stack>0
    WHERE t.event_id=p_event GROUP BY t.id ORDER BY count(s.user_id) DESC,t.id LIMIT 1;
   FOR player IN SELECT s.table_id,s.user_id,s.stack FROM public.poker_seats_v1 s
     JOIN public.poker_tables_v1 t ON t.id=s.table_id WHERE t.event_id=p_event AND s.stack>0 AND s.table_id<>tid ORDER BY s.table_id,s.seat_no LOOP
    SELECT i INTO new_seat FROM generate_series(0,greatest(6,least(8,(e.config->>'seatsPerTable')::int))-1)i WHERE NOT EXISTS(SELECT 1 FROM public.poker_seats_v1 WHERE table_id=tid AND seat_no=i) ORDER BY i LIMIT 1;
    IF new_seat IS NULL THEN RAISE EXCEPTION 'TARGET_TABLE_FULL';END IF;
    INSERT INTO public.poker_seats_v1(table_id,seat_no,user_id,stack) VALUES(tid,new_seat,player.user_id,player.stack);
    DELETE FROM public.poker_seats_v1 WHERE table_id=player.table_id AND user_id=player.user_id;
    UPDATE public.poker_event_entries_v1 SET table_id=tid,seat_no=new_seat WHERE event_id=p_event AND user_id=player.user_id;
    move_count=move_count+1;
   END LOOP;
  ELSE
   -- Keep multi-table field within one player per table, only between hands.
   FOR move_count IN 0..1000 LOOP
    SELECT t.id,count(s.user_id) INTO from_table,max_count FROM public.poker_tables_v1 t
      LEFT JOIN public.poker_seats_v1 s ON s.table_id=t.id AND s.stack>0
      WHERE t.event_id=p_event GROUP BY t.id ORDER BY count(s.user_id) DESC,t.id LIMIT 1;
    SELECT t.id,count(s.user_id) INTO to_table,min_count FROM public.poker_tables_v1 t
      LEFT JOIN public.poker_seats_v1 s ON s.table_id=t.id AND s.stack>0
      WHERE t.event_id=p_event GROUP BY t.id ORDER BY count(s.user_id),t.id LIMIT 1;
    EXIT WHEN max_count-min_count<=1;
    SELECT s.user_id,s.stack INTO player FROM public.poker_seats_v1 s WHERE s.table_id=from_table AND s.stack>0 ORDER BY s.seat_no DESC LIMIT 1;
    SELECT i INTO new_seat FROM generate_series(0,greatest(6,least(8,(e.config->>'seatsPerTable')::int))-1)i WHERE NOT EXISTS(SELECT 1 FROM public.poker_seats_v1 WHERE table_id=to_table AND seat_no=i) ORDER BY i LIMIT 1;
    IF new_seat IS NULL THEN RAISE EXCEPTION 'NO_BALANCE_SEAT';END IF;
    INSERT INTO public.poker_seats_v1(table_id,seat_no,user_id,stack) VALUES(to_table,new_seat,player.user_id,player.stack);
    DELETE FROM public.poker_seats_v1 WHERE table_id=from_table AND user_id=player.user_id;
    UPDATE public.poker_event_entries_v1 SET table_id=to_table,seat_no=new_seat WHERE event_id=p_event AND user_id=player.user_id;
   END LOOP;
  END IF;
 END IF;
 -- A table owner eliminated or moved between hands cannot keep sole authority to start.
 UPDATE public.poker_tables_v1 t SET owner_id=(SELECT s.user_id FROM public.poker_seats_v1 s WHERE s.table_id=t.id AND s.stack>0 ORDER BY s.seat_no LIMIT 1)
 WHERE t.event_id=p_event AND EXISTS(SELECT 1 FROM public.poker_seats_v1 s WHERE s.table_id=t.id AND s.stack>0);
 SELECT coalesce(sum(s.stack+s.committed),0) INTO total_chips FROM public.poker_seats_v1 s JOIN public.poker_tables_v1 t ON t.id=s.table_id WHERE t.event_id=p_event;
 SELECT count(*)*(e.config->>'startingStack')::bigint INTO expected_chips FROM public.poker_event_entries_v1 WHERE event_id=p_event;
 IF total_chips<>expected_chips THEN RAISE EXCEPTION 'TOURNAMENT_CHIP_CONSERVATION_FAILED: % versus %',total_chips,expected_chips;END IF;
 IF alive=1 THEN
   SELECT s.user_id INTO champion FROM public.poker_seats_v1 s JOIN public.poker_tables_v1 t ON t.id=s.table_id WHERE t.event_id=p_event AND s.stack>0;
   old_version=e.version;
   UPDATE public.poker_events_v1 SET status='finished',version=version+1,updated_at=now() WHERE id=p_event;
   INSERT INTO public.poker_event_audit_v1(event_id,actor_id,operation,request_id,before_version,after_version,details)
   VALUES(p_event,e.created_by,'system_finish',gen_random_uuid(),old_version,old_version+1,jsonb_build_object('winner',champion,'chips',total_chips));
 END IF;
 RETURN jsonb_build_object('eventId',p_event,'remaining',alive,'finished',alive=1,'moved',move_count,'chips',total_chips);
END $function$

