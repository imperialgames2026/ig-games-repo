DO $$
DECLARE definition text; original text;
BEGIN
 SELECT pg_get_functiondef('public.poker_event_start_v1(uuid,uuid,bigint,uuid)'::regprocedure) INTO definition;
 original=definition;
 definition=replace(definition,
 'FOR participant IN SELECT user_id FROM public.poker_event_entries_v1 WHERE event_id=p_event ORDER BY registered_at,user_id LOOP',
 'FOR participant IN SELECT user_id,(row_number() over (order by registered_at,user_id)-1)::int AS position FROM public.poker_event_entries_v1 WHERE event_id=p_event LOOP');
 definition=replace(definition,
 'SELECT count(*) INTO idx FROM public.poker_event_entries_v1 WHERE event_id=p_event AND table_id IS NOT NULL;',
 '-- Using stable registration position to allocate seats.');
 definition=replace(definition,'IF (idx%table_count)=table_index THEN','IF (participant.position%table_count)=table_index THEN');
 IF definition=original OR position('participant.position%table_count' in definition)=0 THEN RAISE EXCEPTION 'PATCH_FAILED';END IF;
 EXECUTE definition;
END $$;

