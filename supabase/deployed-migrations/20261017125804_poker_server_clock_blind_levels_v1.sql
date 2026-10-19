CREATE OR REPLACE FUNCTION public.poker_event_tick_v1(p_event uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE e public.poker_events_v1%rowtype;num_levels int;level_no int;level_data jsonb;started timestamptz;duration int;changed boolean:=false;
BEGIN
 SELECT * INTO e FROM public.poker_events_v1 WHERE id=p_event FOR UPDATE;
 IF NOT FOUND OR e.status<>'running' THEN RAISE EXCEPTION 'EVENT_NOT_RUNNING';END IF;
 IF e.format='ring' THEN RETURN jsonb_build_object('eventId',p_event,'level',1,'ring',true);END IF;
 num_levels=jsonb_array_length(e.config->'levels');
 level_no=e.current_level;started=e.level_started_at;
 IF started IS NULL OR num_levels<1 THEN RAISE EXCEPTION 'INVALID_LEVEL_CLOCK';END IF;
 WHILE level_no<num_levels LOOP
   level_data=e.config->'levels'->(level_no-1);
   duration=(level_data->>'durationSeconds')::int;
   EXIT WHEN started+make_interval(secs=>duration)>clock_timestamp();
   started=started+make_interval(secs=>duration);
   level_no=level_no+1;changed=true;
 END LOOP;
 IF changed THEN
   level_data=e.config->'levels'->(level_no-1);
   UPDATE public.poker_events_v1 SET current_level=level_no,level_started_at=started,version=version+1,updated_at=clock_timestamp() WHERE id=p_event;
 END IF;
 level_data=e.config->'levels'->(level_no-1);
 UPDATE public.poker_tables_v1 SET small_blind=(level_data->>'smallBlind')::bigint,big_blind=(level_data->>'bigBlind')::bigint,
 min_raise=(level_data->>'bigBlind')::bigint
 WHERE event_id=p_event AND status IN ('waiting','complete') AND (small_blind IS DISTINCT FROM (level_data->>'smallBlind')::bigint OR big_blind IS DISTINCT FROM (level_data->>'bigBlind')::bigint);
 RETURN jsonb_build_object('eventId',p_event,'level',level_no,'changed',changed);
END $$;
REVOKE ALL ON FUNCTION public.poker_event_tick_v1(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.poker_event_tick_v1(uuid) TO service_role;

