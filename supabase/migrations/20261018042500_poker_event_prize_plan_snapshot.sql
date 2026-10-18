-- Freeze the Superadmin prize ladder into a versioned event draft, never authorize disbursement.
CREATE OR REPLACE FUNCTION public.ig_poker_create_event_from_preset(p_actor uuid, p_preset uuid, p_request uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p public.ig_poker_tournament_presets%rowtype;
 v_role text; v_config jsonb; v_levels jsonb; v_result jsonb; v_event uuid;
 v_awards jsonb;v_hash text;
begin
 select ur.role::text into v_role from public.user_roles ur
 join public.profiles pr on pr.id=ur.user_id where ur.user_id=p_actor and pr.is_excluded=false;
 if v_role is distinct from 'superadmin' then raise exception 'SUPERADMIN_REQUIRED' using errcode='42501';end if;
 select * into p from public.ig_poker_tournament_presets where id=p_preset for update;
 if not found or p.status<>'draft' or p.variant<>'holdem' or p.currency<>'PRACTICE' or p.buy_in_units<>0
 then raise exception 'ONLY_FREE_PRACTICE_PRESETS_MAY_CREATE_EVENTS' using errcode='22023';end if;
 select jsonb_agg(jsonb_build_object('smallBlind',(x->>'small')::bigint,
  'bigBlind',(x->>'big')::bigint,'durationSeconds',(x->>'durationMinutes')::integer*60))
 into v_levels from jsonb_array_elements(p.blind_levels) x;
 if jsonb_array_length(v_levels)<1 then raise exception 'MISSING_LEVELS';end if;
 select coalesce(jsonb_agg(jsonb_build_object('position',place,'amount',amount::text,'asset',asset) order by place),'[]'::jsonb)
 into v_awards from public.ig_poker_tournament_awards where preset_id=p_preset;
 if jsonb_array_length(v_awards)<>p.paid_places then raise exception 'AWARD_SCHEDULE_MISMATCH';end if;
 v_hash:=encode(extensions.digest(v_awards::text,'sha256'),'hex');
 v_config:=jsonb_build_object('maxPlayers',p.seats_per_table*p.table_count,
 'seatsPerTable',p.seats_per_table,'tableCount',p.table_count,
 'startingStack',p.initial_stack,'levels',v_levels,
 'startAt',now()-interval '1 minute',
 'practiceOnly',true,'buyInUnits',0,'rakeCollected',false,
 'paidPlaces',p.paid_places,'awardSchedule',v_awards,'payoutAsset',p.payout_asset,
 'payoutDisplayAsset',p.payout_display_asset,'awardScheduleHash',v_hash,'payoutsActivated',false);
 v_result:=public.poker_event_create_v1(p_actor,p_request,p.name,p.format,v_config);
 v_event:=(v_result->>'eventId')::uuid;
 insert into public.ig_poker_preset_events(preset_id,event_id) values(p_preset,v_event)
 on conflict(event_id) do nothing;
 return v_result||jsonb_build_object('practiceOnly',true,'presetId',p_preset);
end $function$
;

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
 IF coalesce((e.config->>'paidPlaces')::integer,0)>registered THEN RAISE EXCEPTION 'PRIZE_PLACES_EXCEED_ENTRANTS';END IF;
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
;
