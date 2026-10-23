-- Disposable minimal-schema fixtures only. No Storage, comparison action or model.
-- Existing test rows are temporarily parked; the transaction restores them.
BEGIN;
DO $$
DECLARE
 actor uuid := '33333333-3333-4333-8333-333333333333';
 token text := repeat('c',64);
 sid uuid;
 first_id uuid := '33333333-3333-4333-8333-000000000001';
 ids uuid[] := ARRAY[]::uuid[];
 result jsonb;
 claim jsonb;
 first_attempt uuid;
 current_attempt uuid;
 deleted_at timestamptz;
 expected_minutes integer;
 i integer;
BEGIN
 UPDATE public.ig_kyc_submissions SET evidence_recheck_at=now()+interval '1 day';
 INSERT INTO auth.users VALUES(actor);
 INSERT INTO public.profiles(id,is_excluded,kyc_status) VALUES(actor,false,'not_started');
 INSERT INTO public.ig_kyc_workers(token_hash,name,expires_at)
 VALUES(token,'synthetic-fair-retention',now()+interval '1 day');
 FOR i IN 1..13 LOOP
  sid:=('33333333-3333-4333-8333-'||lpad(i::text,12,'0'))::uuid;
  ids:=array_append(ids,sid);
  INSERT INTO public.ig_kyc_submissions(id,user_id,status,full_name,birth_date,country,document_type,consent_version,face_consent,expires_at)
  VALUES(sid,actor,'cancelled','Synthetic Retry Fixture','1990-01-01','US','passport','2026-10-22',false,
   now()-case when i<=10 then interval '2 hours' else interval '1 hour' end);
 END LOOP;
 result:=public.ig_kyc_retention_action_v2(NULL,'worker_expired',jsonb_build_object('token_hash',token));
 IF jsonb_array_length(result)<>10 OR result->0->>'id'<>ids[1]::text OR result->9->>'id'<>ids[10]::text THEN
  RAISE EXCEPTION 'Initial bounded queue did not select oldest ten';
 END IF;
 -- A missing token must not match a never-reserved row whose attempt is NULL.
 BEGIN
  PERFORM public.ig_kyc_retention_action_v2(NULL,'worker_purged',jsonb_build_object('token_hash',token,'id',ids[11]));
  RAISE EXCEPTION 'Unreserved NULL attempt was accepted';
 EXCEPTION WHEN serialization_failure THEN NULL; END;
 -- Reserve before simulated failed/abandoned Storage work. No failure callback:
 -- a lost response or worker crash must still durably yield queue priority.
 FOR i IN 1..10 LOOP
  claim:=public.ig_kyc_retention_action_v2(NULL,'worker_attempt',jsonb_build_object('token_hash',token,'id',ids[i]));
  IF claim->>'id'<>ids[i]::text OR claim->>'user_id'<>actor::text OR claim->>'attempt' IS NULL THEN
   RAISE EXCEPTION 'Reservation is incomplete';
  END IF;
  IF i=1 THEN first_attempt:=(claim->>'attempt')::uuid; END IF;
  IF (SELECT cleanup_attempts FROM public.ig_kyc_submissions WHERE id=ids[i])<>1 OR
     (SELECT cleanup_retry_at FROM public.ig_kyc_submissions WHERE id=ids[i])<>now()+interval '5 minutes' THEN
   RAISE EXCEPTION 'First unfinished attempt did not reserve five-minute backoff';
  END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM public.ig_kyc_submissions WHERE id=ANY(ids[1:10]) AND
           (evidence_deleted_at IS NOT NULL OR full_name<>'Synthetic Retry Fixture')) OR
    EXISTS(SELECT 1 FROM public.ig_kyc_audit WHERE submission_id=ANY(ids[1:10]) AND action='evidence_deleted') THEN
  RAISE EXCEPTION 'Unfinished attempts claimed deletion';
 END IF;
 result:=public.ig_kyc_retention_action_v2(NULL,'worker_expired',jsonb_build_object('token_hash',token));
 IF jsonb_array_length(result)<>3 OR result->0->>'id'<>ids[11]::text THEN
  RAISE EXCEPTION 'Persistent early failures starved later eligible rows';
 END IF;
 -- Simulate a slow scheduler: all early retries are eligible again. Their
 -- refreshed effective due times must still sort behind the waiting later rows.
 UPDATE public.ig_kyc_submissions SET cleanup_retry_at=now()-interval '1 minute' WHERE id=ANY(ids[1:10]);
 result:=public.ig_kyc_retention_action_v2(NULL,'worker_expired',jsonb_build_object('token_hash',token));
 IF jsonb_array_length(result)<>10 THEN RAISE EXCEPTION 'Queue is not bounded to ten'; END IF;
 FOR i IN 11..13 LOOP
  IF result->(i-11)->>'id'<>ids[i]::text THEN RAISE EXCEPTION 'Elapsed retries jumped ahead of waiting work'; END IF;
  claim:=public.ig_kyc_retention_action_v2(NULL,'worker_attempt',jsonb_build_object('token_hash',token,'id',ids[i]));
  PERFORM public.ig_kyc_retention_action_v2(NULL,'worker_purged',jsonb_build_object('token_hash',token,'id',ids[i],'attempt',claim->>'attempt'));
  IF (SELECT evidence_deleted_at IS NULL OR cleanup_attempt IS NOT NULL OR cleanup_attempts<>0 OR cleanup_retry_at IS NOT NULL
      FROM public.ig_kyc_submissions WHERE id=ids[i]) THEN RAISE EXCEPTION 'Later successful row did not clear retry state'; END IF;
 END LOOP;
 -- Replacement reservation rejects both the previous finisher and a missing
 -- token, while current completion is allowed before its retry deadline.
 claim:=public.ig_kyc_retention_action_v2(NULL,'worker_attempt',jsonb_build_object('token_hash',token,'id',first_id));
 current_attempt:=(claim->>'attempt')::uuid;
 IF current_attempt=first_attempt OR
    (SELECT cleanup_retry_at FROM public.ig_kyc_submissions WHERE id=first_id)<>now()+interval '10 minutes' THEN
  RAISE EXCEPTION 'Second attempt did not rotate ownership and increase backoff';
 END IF;
 BEGIN
  PERFORM public.ig_kyc_retention_action_v2(NULL,'worker_purged',jsonb_build_object('token_hash',token,'id',first_id,'attempt',first_attempt));
  RAISE EXCEPTION 'Stale finisher accepted';
 EXCEPTION WHEN serialization_failure THEN NULL; END;
 BEGIN
  PERFORM public.ig_kyc_retention_action_v2(NULL,'worker_purged',jsonb_build_object('token_hash',token,'id',first_id));
  RAISE EXCEPTION 'Missing attempt accepted';
 EXCEPTION WHEN serialization_failure THEN NULL; END;
 FOR i IN 3..6 LOOP
  UPDATE public.ig_kyc_submissions SET cleanup_retry_at=now()-interval '1 second' WHERE id=first_id;
  claim:=public.ig_kyc_retention_action_v2(NULL,'worker_attempt',jsonb_build_object('token_hash',token,'id',first_id));
  current_attempt:=(claim->>'attempt')::uuid;
  expected_minutes:=(ARRAY[5,10,20,40,60,60])[i];
  IF (SELECT cleanup_retry_at FROM public.ig_kyc_submissions WHERE id=first_id)<>now()+make_interval(mins=>expected_minutes) OR
     (SELECT cleanup_attempts FROM public.ig_kyc_submissions WHERE id=first_id)<>least(i,5) THEN
   RAISE EXCEPTION 'Retry delay/counter failed bounded progression';
  END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM public.ig_kyc_audit WHERE submission_id=first_id AND action='evidence_deleted') THEN
  RAISE EXCEPTION 'Failed retries created a deletion audit';
 END IF;
 result:=public.ig_kyc_retention_action_v2(NULL,'worker_purged',jsonb_build_object('token_hash',token,'id',first_id,'attempt',current_attempt));
 IF result->'deleted' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'Recovery did not acknowledge deletion'; END IF;
 SELECT evidence_deleted_at INTO deleted_at FROM public.ig_kyc_submissions WHERE id=first_id;
 IF deleted_at IS NULL OR (SELECT cleanup_attempt IS NOT NULL OR cleanup_attempts<>0 OR cleanup_retry_at IS NOT NULL
    OR evidence_recheck_at<>now()+interval '1 hour' FROM public.ig_kyc_submissions WHERE id=first_id) THEN
  RAISE EXCEPTION 'Recovered item did not reset retries and retain reconciliation';
 END IF;
 BEGIN
  PERFORM public.ig_kyc_retention_action_v2(NULL,'worker_purged',jsonb_build_object('token_hash',token,'id',first_id,'attempt',current_attempt));
  RAISE EXCEPTION 'Repeated finisher accepted';
 EXCEPTION WHEN serialization_failure THEN NULL; END;
 UPDATE public.ig_kyc_submissions SET evidence_recheck_at=now()-interval '1 second' WHERE id=first_id;
 claim:=public.ig_kyc_retention_action_v2(NULL,'worker_attempt',jsonb_build_object('token_hash',token,'id',first_id));
 IF (SELECT cleanup_attempts FROM public.ig_kyc_submissions WHERE id=first_id)<>1 THEN RAISE EXCEPTION 'Fresh recheck retained failure escalation'; END IF;
 result:=public.ig_kyc_retention_action_v2(NULL,'worker_purged',jsonb_build_object('token_hash',token,'id',first_id,'attempt',claim->>'attempt'));
 IF result->'reconciled' IS DISTINCT FROM 'true'::jsonb OR
    (SELECT evidence_deleted_at FROM public.ig_kyc_submissions WHERE id=first_id) IS DISTINCT FROM deleted_at OR
    (SELECT count(*) FROM public.ig_kyc_audit WHERE submission_id=first_id AND action='evidence_deleted')<>1 THEN
  RAISE EXCEPTION 'Repeated reconciliation changed first deletion or audit idempotency';
 END IF;
 -- An old expiry is not permission to jump ahead when its upload fence only
 -- just elapsed. Nine earlier failed rows are due, leaving one slot for row15.
 INSERT INTO public.ig_kyc_submissions(id,user_id,status,full_name,birth_date,country,document_type,consent_version,face_consent,expires_at,upload_valid_until)
 VALUES
 ('33333333-3333-4333-8333-000000000014',actor,'cancelled','Synthetic Fence Order','1990-01-01','US','passport','2026-10-22',false,now()-interval '3 hours',now()-interval '10 seconds'),
 ('33333333-3333-4333-8333-000000000015',actor,'cancelled','Synthetic Fence Order','1990-01-01','US','passport','2026-10-22',false,now()-interval '2 hours',now()-interval '30 seconds');
 result:=public.ig_kyc_retention_action_v2(NULL,'worker_expired',jsonb_build_object('token_hash',token));
 IF jsonb_array_length(result)<>10 OR result->9->>'id'<>'33333333-3333-4333-8333-000000000015' OR
    EXISTS(SELECT 1 FROM jsonb_array_elements(result) x WHERE x->>'id'='33333333-3333-4333-8333-000000000014') THEN
  RAISE EXCEPTION 'Queue priority ignored the actual upload fence due time';
 END IF;
 IF has_function_privilege('authenticated','public.ig_kyc_retention_action_v2(uuid,text,jsonb)','EXECUTE') OR
    has_function_privilege('anon','public.ig_kyc_retention_action_v2(uuid,text,jsonb)','EXECUTE') OR
    NOT has_function_privilege('service_role','public.ig_kyc_retention_action_v2(uuid,text,jsonb)','EXECUTE') THEN
  RAISE EXCEPTION 'Fair retention RPC role boundary is wrong';
 END IF;
END $$;
ROLLBACK;
