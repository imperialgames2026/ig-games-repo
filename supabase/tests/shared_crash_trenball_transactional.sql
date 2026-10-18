-- Crash + Trenball share one immutable server-generated round and practice ledger.
-- Execute against the Imperial Games staging Supabase project ONLY. All changes roll back.
BEGIN;
DO $test$
DECLARE
  dealer uuid;
  other uuid;
  readonly_user uuid;
  id_auto uuid := gen_random_uuid();
  id_red uuid := gen_random_uuid();
  id_green uuid := gen_random_uuid();
  id_moon uuid := gen_random_uuid();
  id_round uuid := gen_random_uuid();
  result jsonb;
  replay jsonb;
  snap jsonb;
  multiplier_x100 integer;
  actual integer;
  expected integer;
BEGIN
  SELECT ur.user_id INTO dealer FROM public.user_roles ur
    JOIN public.profiles pr ON pr.id=ur.user_id
    WHERE ur.role::text='superadmin' AND pr.is_excluded=false LIMIT 1;
  SELECT ur.user_id INTO other FROM public.user_roles ur
    JOIN public.profiles pr ON pr.id=ur.user_id
    WHERE ur.role::text='admin' AND pr.is_excluded=false LIMIT 1;
  SELECT ur.user_id INTO readonly_user FROM public.user_roles ur
    JOIN public.profiles pr ON pr.id=ur.user_id
    WHERE ur.role::text='tester' AND pr.is_excluded=false LIMIT 1;
  IF dealer IS NULL OR other IS NULL OR readonly_user IS NULL THEN
    RAISE EXCEPTION 'Staging role fixtures required';
  END IF;

  PERFORM public.ig_event_action(dealer,'crash','join');
  PERFORM public.ig_event_action(other,'crash','join');
  PERFORM public.ig_event_action(dealer,'crash','bet',id_auto,'auto_200',10);
  PERFORM public.ig_event_action(other,'crash','bet',id_red,'tren_red',10);
  PERFORM public.ig_event_action(other,'crash','bet',id_green,'tren_green',10);
  PERFORM public.ig_event_action(other,'crash','bet',id_moon,'tren_moon',10);
  snap:=public.ig_event_state(other,'crash');
  IF (snap->>'chips')::integer<>970 OR jsonb_array_length(snap->'publicBets')<>4
    OR snap->>'betsOpen'<>'true' THEN RAISE EXCEPTION 'Shared side-bet state wrong'; END IF;

  BEGIN
    PERFORM public.ig_event_action(other,'crash','resolve',gen_random_uuid(),null,null,1);
    RAISE EXCEPTION 'Non-dealer resolved the round';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;
  BEGIN
    PERFORM public.ig_event_action(dealer,'crash','resolve',gen_random_uuid(),null,null,1);
    RAISE EXCEPTION 'Early resolve accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;

  UPDATE public.ig_event_tables SET betting_closes_at=now()-interval '1 second'
    WHERE game='crash';
  BEGIN
    PERFORM public.ig_event_action(other,'crash','bet',gen_random_uuid(),'tren_red',1);
    RAISE EXCEPTION 'Late bet accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;

  result:=public.ig_event_action(dealer,'crash','resolve',id_round,null,null,1);
  multiplier_x100:=(result->'result'->>'crashX100')::integer;
  IF multiplier_x100<100 OR multiplier_x100>10000 OR
    result->'result'->>'game'<>'crash' THEN RAISE EXCEPTION 'Invalid crash result'; END IF;

  replay:=public.ig_event_action(dealer,'crash','resolve',id_round,null,null,1);
  IF replay->>'replayed'<>'true' OR replay->'result'<>result->'result' THEN
    RAISE EXCEPTION 'Idempotent replay failed';
  END IF;
  SELECT paid_units INTO actual FROM public.ig_event_bets WHERE request_id=id_auto;
  expected:=CASE WHEN multiplier_x100>=200 THEN 20 ELSE 0 END;
  IF actual<>expected THEN RAISE EXCEPTION 'Classic 2x auto cashout mismatch'; END IF;
  SELECT paid_units INTO actual FROM public.ig_event_bets WHERE request_id=id_red;
  expected:=CASE WHEN multiplier_x100<200 THEN 19 ELSE 0 END;
  IF actual<>expected THEN RAISE EXCEPTION 'Trenball red payout mismatch'; END IF;
  SELECT paid_units INTO actual FROM public.ig_event_bets WHERE request_id=id_green;
  expected:=CASE WHEN multiplier_x100>=200 THEN 20 ELSE 0 END;
  IF actual<>expected THEN RAISE EXCEPTION 'Trenball green payout mismatch'; END IF;
  SELECT paid_units INTO actual FROM public.ig_event_bets WHERE request_id=id_moon;
  expected:=CASE WHEN multiplier_x100>=1000 THEN 100 ELSE 0 END;
  IF actual<>expected THEN RAISE EXCEPTION 'Trenball moon payout mismatch'; END IF;

  snap:=public.ig_event_state(other,'crash');
  IF (snap->>'round')::integer<>2 OR
    jsonb_array_length(snap->'myRecent')<>3 OR snap->>'betsOpen'<>'true' OR
    snap->>'realMoneyEnabled'<>'false' THEN
    RAISE EXCEPTION 'Settlement/new round/staging boundary failed';
  END IF;
  BEGIN
    PERFORM public.ig_event_action(readonly_user,'crash','join');
    RAISE EXCEPTION 'Tester entered paid simulation';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;
END
$test$;
ROLLBACK;
