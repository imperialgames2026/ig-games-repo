DO $$
DECLARE
 actor uuid := '11111111-1111-4111-8111-111111111111';
 sid uuid;
 result jsonb;
 token text := repeat('a',64);
 fence timestamptz;
BEGIN
 INSERT INTO auth.users VALUES(actor);
 INSERT INTO public.profiles(id,is_excluded) VALUES(actor,false);
 INSERT INTO public.user_roles VALUES(actor,'player');
 INSERT INTO public.ig_kyc_workers(token_hash,name,expires_at) VALUES(token,'synthetic-retention',now()+interval '1 hour');
 result := public.ig_kyc_action(actor,'begin','{"full_name":"Synthetic Fixture","birth_date":"1990-01-01","country":"US","document_type":"passport","consent":true,"consent_version":"2026-10-22","face_consent":false}');
 sid := (result->>'id')::uuid;
 PERFORM public.ig_kyc_action(actor,'upload',jsonb_build_object('id',sid));
 SELECT upload_valid_until INTO fence FROM public.ig_kyc_submissions WHERE id=sid;
 IF fence < now()+interval '120 minutes' THEN RAISE EXCEPTION 'Upload fence too short'; END IF;
 -- A second authorization extends a stale reservation from an earlier request.
 UPDATE public.ig_kyc_submissions SET upload_valid_until=now()+interval '1 minute' WHERE id=sid;
 PERFORM public.ig_kyc_action(actor,'upload',jsonb_build_object('id',sid));
 IF (SELECT upload_valid_until FROM public.ig_kyc_submissions WHERE id=sid)<fence THEN RAISE EXCEPTION 'Fence shortened'; END IF;
 UPDATE public.profiles SET is_excluded=true WHERE id=actor;
 BEGIN
  PERFORM public.ig_kyc_action(actor,'upload',jsonb_build_object('id',sid));
  RAISE EXCEPTION 'Excluded user obtained grant';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 UPDATE public.profiles SET is_excluded=false WHERE id=actor;
 PERFORM public.ig_kyc_action(actor,'cancel',jsonb_build_object('id',sid));
 BEGIN
  PERFORM public.ig_kyc_action(actor,'upload',jsonb_build_object('id',sid));
  RAISE EXCEPTION 'Cancelled submission obtained grant';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 result := public.ig_kyc_action(NULL,'worker_expired',jsonb_build_object('token_hash',token));
 IF jsonb_array_length(result)<>0 THEN RAISE EXCEPTION 'Cleanup preceded token expiry'; END IF;
 -- Simulate time after the outstanding late-upload grant expires; no image bytes.
 UPDATE public.ig_kyc_submissions SET upload_valid_until=now()-interval '1 minute' WHERE id=sid;
 result := public.ig_kyc_action(NULL,'worker_expired',jsonb_build_object('token_hash',token));
 IF jsonb_array_length(result)<>1 THEN RAISE EXCEPTION 'Cancelled draft omitted'; END IF;
 PERFORM public.ig_kyc_action(NULL,'worker_purged',jsonb_build_object('token_hash',token,'id',sid));
 result := public.ig_kyc_action(NULL,'worker_expired',jsonb_build_object('token_hash',token));
 IF jsonb_array_length(result)<>0 THEN RAISE EXCEPTION 'Repeat batch returned purged item'; END IF;
 IF (SELECT full_name FROM public.ig_kyc_submissions WHERE id=sid)<>'Deleted' THEN RAISE EXCEPTION 'Details retained'; END IF;
 IF has_function_privilege('authenticated','public.ig_kyc_action(uuid,text,jsonb)','EXECUTE') OR has_function_privilege('anon','public.ig_kyc_action(uuid,text,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Browser RPC access'; END IF;
END $$;
