-- Staging-only poker tournament registration and seating. No redeemable chips.
ALTER TABLE public.poker_events_v1 ADD COLUMN IF NOT EXISTS current_level integer NOT NULL DEFAULT 1;
ALTER TABLE public.poker_events_v1 ADD COLUMN IF NOT EXISTS level_started_at timestamptz;
ALTER TABLE public.poker_tables_v1 ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.poker_events_v1(id);
ALTER TABLE public.poker_tables_v1 ADD COLUMN IF NOT EXISTS hand_no integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS poker_tables_event_idx ON public.poker_tables_v1(event_id);
CREATE TABLE IF NOT EXISTS public.poker_event_entries_v1 (
 event_id uuid NOT NULL REFERENCES public.poker_events_v1(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id),
 status text NOT NULL DEFAULT 'registered' CHECK(status IN ('registered','seated','eliminated')),
 table_id uuid REFERENCES public.poker_tables_v1(id),
 seat_no integer CHECK(seat_no BETWEEN 0 AND 5),
 registered_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(event_id,user_id), UNIQUE(table_id,seat_no)
);
ALTER TABLE public.poker_event_entries_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.poker_event_entries_v1 FROM anon,authenticated;
CREATE OR REPLACE FUNCTION public.poker_event_publish_v1(p_event uuid,p_actor uuid,p_version bigint,p_request uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE e public.poker_events_v1%rowtype;existing record;result jsonb;
BEGIN
 SELECT * INTO e FROM public.poker_events_v1 WHERE id=p_event FOR UPDATE;
 IF NOT FOUND OR e.created_by<>p_actor THEN RAISE EXCEPTION 'EVENT_NOT_FOUND_OR_FORBIDDEN';END IF;
 SELECT operation,after_version INTO existing FROM public.poker_event_audit_v1 WHERE request_id=p_request AND event_id=p_event;
 IF FOUND THEN RETURN jsonb_build_object('eventId',p_event,'version',existing.after_version,'status','registration');END IF;
 IF e.status<>'draft' OR e.version<>p_version THEN RAISE EXCEPTION 'EVENT_STALE_OR_NOT_DRAFT';END IF;
 UPDATE public.poker_events_v1 SET status='registration',version=version+1,updated_at=now() WHERE id=p_event;
 INSERT INTO public.poker_event_audit_v1(event_id,actor_id,operation,request_id,before_version,after_version)
 VALUES(p_event,p_actor,'publish',p_request,e.version,e.version+1);
 RETURN jsonb_build_object('eventId',p_event,'version',e.version+1,'status','registration');
END $$;
CREATE OR REPLACE FUNCTION public.poker_event_register_v1(p_event uuid,p_actor uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE e public.poker_events_v1%rowtype;registered int;max_players int;
BEGIN
 SELECT * INTO e FROM public.poker_events_v1 WHERE id=p_event FOR UPDATE;
 IF NOT FOUND OR e.status<>'registration' THEN RAISE EXCEPTION 'REGISTRATION_CLOSED';END IF;
 IF EXISTS(SELECT 1 FROM public.poker_event_entries_v1 WHERE event_id=p_event AND user_id=p_actor) THEN
   RETURN jsonb_build_object('eventId',p_event,'registered',true,'alreadyRegistered',true);
 END IF;
 max_players=(e.config->>'maxPlayers')::int;
 SELECT count(*) INTO registered FROM public.poker_event_entries_v1 WHERE event_id=p_event;
 IF registered>=max_players THEN RAISE EXCEPTION 'EVENT_FULL';END IF;
 INSERT INTO public.poker_event_entries_v1(event_id,user_id) VALUES(p_event,p_actor);
 RETURN jsonb_build_object('eventId',p_event,'registered',true,'count',registered+1,'capacity',max_players);
END $$;
CREATE OR REPLACE FUNCTION public.poker_event_start_v1(p_event uuid,p_actor uuid,p_version bigint,p_request uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE e public.poker_events_v1%rowtype;registered int;capacity int;max_seats int;table_count int;idx int:=0;table_index int;seat_idx int;tid uuid;owner uuid;participant record;level0 jsonb;existing record;
BEGIN
 SELECT * INTO e FROM public.poker_events_v1 WHERE id=p_event FOR UPDATE;
 IF NOT FOUND OR e.created_by<>p_actor THEN RAISE EXCEPTION 'EVENT_NOT_FOUND_OR_FORBIDDEN';END IF;
 SELECT operation,after_version INTO existing FROM public.poker_event_audit_v1 WHERE request_id=p_request AND event_id=p_event;
 IF FOUND THEN RETURN jsonb_build_object('eventId',p_event,'status','running','version',existing.after_version);END IF;
 IF e.status<>'registration' OR e.version<>p_version THEN RAISE EXCEPTION 'EVENT_STALE_OR_NOT_OPEN';END IF;
 SELECT count(*) INTO registered FROM public.poker_event_entries_v1 WHERE event_id=p_event;
 capacity=(e.config->>'maxPlayers')::int;max_seats=least(6,(e.config->>'seatsPerTable')::int);
 IF registered<2 OR (e.format='sit_and_go' AND registered<>capacity) THEN RAISE EXCEPTION 'NOT_ENOUGH_REGISTRATIONS';END IF;
 IF e.format='scheduled_mtt' AND now()<(e.config->>'startAt')::timestamptz THEN RAISE EXCEPTION 'START_TIME_NOT_REACHED';END IF;
 IF max_seats<2 OR max_seats>6 OR registered>capacity THEN RAISE EXCEPTION 'BAD_SEAT_CONFIGURATION';END IF;
 table_count=ceil(registered::numeric/max_seats)::int;
 IF registered<table_count*2 THEN RAISE EXCEPTION 'TABLE_NEEDS_TWO_PLAYERS';END IF;
 level0=e.config->'levels'->0;
 FOR table_index IN 0..table_count-1 LOOP
   SELECT user_id INTO owner FROM public.poker_event_entries_v1 WHERE event_id=p_event ORDER BY registered_at,user_id OFFSET table_index LIMIT 1;
   INSERT INTO public.poker_tables_v1(owner_id,event_id,small_blind,big_blind,min_raise)
   VALUES(owner,p_event,(level0->>'smallBlind')::bigint,(level0->>'bigBlind')::bigint,(level0->>'bigBlind')::bigint)
   RETURNING id INTO tid;
   -- Deal registrations round-robin, keeping each table >=2 when possible.
   seat_idx=0;
   FOR participant IN SELECT user_id FROM public.poker_event_entries_v1 WHERE event_id=p_event ORDER BY registered_at,user_id LOOP
      SELECT count(*) INTO idx FROM public.poker_event_entries_v1 WHERE event_id=p_event AND table_id IS NOT NULL;
      IF (idx%table_count)=table_index THEN
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
END $$;
REVOKE ALL ON FUNCTION public.poker_event_publish_v1(uuid,uuid,bigint,uuid),public.poker_event_register_v1(uuid,uuid),public.poker_event_start_v1(uuid,uuid,bigint,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.poker_event_publish_v1(uuid,uuid,bigint,uuid),public.poker_event_register_v1(uuid,uuid),public.poker_event_start_v1(uuid,uuid,bigint,uuid) TO service_role;

