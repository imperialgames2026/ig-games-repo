DO $$
DECLARE body text;old text;
BEGIN
 SELECT pg_get_functiondef('public.poker_start_v2(uuid,uuid,jsonb,text,text,integer)'::regprocedure) INTO body;
 old=body;
 body=replace(body,'order by (seat_no-t.button+6)%6 limit 1','order by (seat_no-t.button-1+6)%6 limit 1');
 IF body=old THEN RAISE EXCEPTION 'START_ROTATION_PATCH_FAILED';END IF;
 EXECUTE body;
 SELECT pg_get_functiondef('public.poker_advance_v1(uuid)'::regprocedure) INTO body;
 old=body;
 body=replace(body,'order by (seat_no-t.button+6)%6 limit 1','order by (seat_no-t.button-1+6)%6 limit 1');
 IF body=old THEN RAISE EXCEPTION 'ADVANCE_ROTATION_PATCH_FAILED';END IF;
 EXECUTE body;
END $$;

