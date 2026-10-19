CREATE OR REPLACE FUNCTION public.poker_event_sync_v1(p_event uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
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
  IF alive<=6 THEN
   SELECT t.id INTO tid FROM public.poker_tables_v1 t LEFT JOIN public.poker_seats_v1 s ON s.table_id=t.id AND s.stack>0
    WHERE t.event_id=p_event GROUP BY t.id ORDER BY count(s.user_id) DESC,t.id LIMIT 1;
   FOR player IN SELECT s.table_id,s.user_id,s.stack FROM public.poker_seats_v1 s
     JOIN public.poker_tables_v1 t ON t.id=s.table_id WHERE t.event_id=p_event AND s.stack>0 AND s.table_id<>tid ORDER BY s.table_id,s.seat_no LOOP
    SELECT i INTO new_seat FROM generate_series(0,5)i WHERE NOT EXISTS(SELECT 1 FROM public.poker_seats_v1 WHERE table_id=tid AND seat_no=i) ORDER BY i LIMIT 1;
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
    SELECT i INTO new_seat FROM generate_series(0,5)i WHERE NOT EXISTS(SELECT 1 FROM public.poker_seats_v1 WHERE table_id=to_table AND seat_no=i) ORDER BY i LIMIT 1;
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
END $$;
REVOKE ALL ON FUNCTION public.poker_event_sync_v1(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.poker_event_sync_v1(uuid) TO service_role;

