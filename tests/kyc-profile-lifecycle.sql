DO $$
DECLARE actor uuid := '22222222-2222-4222-8222-222222222222'; sid uuid; result jsonb;
BEGIN
 INSERT INTO auth.users VALUES(actor);
 INSERT INTO public.profiles(id,is_excluded,kyc_status) VALUES(actor,false,'not_started');
 INSERT INTO public.user_roles VALUES(actor,'player');
 result:=public.ig_kyc_action(actor,'begin','{"full_name":"Synthetic Lifecycle","birth_date":"1990-01-01","country":"US","document_type":"passport","consent":true,"consent_version":"2026-10-22","face_consent":false}');sid:=(result->>'id')::uuid;
 IF (SELECT kyc_status FROM public.profiles WHERE id=actor)<>'not_started' THEN RAISE EXCEPTION 'Draft changed status'; END IF;
 PERFORM public.ig_kyc_action(actor,'submit',jsonb_build_object('id',sid,'evidence','{"id_front":{},"selfie":{}}'::jsonb));
 IF (SELECT kyc_status FROM public.profiles WHERE id=actor)<>'pending_review' THEN RAISE EXCEPTION 'Submit did not synchronize profile'; END IF;
 PERFORM public.ig_kyc_action(actor,'cancel',jsonb_build_object('id',sid));
 IF (SELECT kyc_status FROM public.profiles WHERE id=actor)<>'not_started' THEN RAISE EXCEPTION 'Cancel left pending profile'; END IF;
 -- An independently recorded previous rejection is restored on withdrawal.
 INSERT INTO public.kyc_verifications(user_id,status,external_session_id) VALUES(actor,'rejected',gen_random_uuid()::text);
 result:=public.ig_kyc_action(actor,'begin','{"full_name":"Synthetic Lifecycle","birth_date":"1990-01-01","country":"US","document_type":"passport","consent":true,"consent_version":"2026-10-22","face_consent":false}');sid:=(result->>'id')::uuid;
 PERFORM public.ig_kyc_action(actor,'submit',jsonb_build_object('id',sid,'evidence','{"id_front":{},"selfie":{}}'::jsonb));
 IF (SELECT kyc_status FROM public.profiles WHERE id=actor)<>'pending_review' THEN RAISE EXCEPTION 'Resubmit left rejection'; END IF;
 PERFORM public.ig_kyc_action(actor,'cancel',jsonb_build_object('id',sid));
 IF (SELECT kyc_status FROM public.profiles WHERE id=actor)<>'rejected' THEN RAISE EXCEPTION 'Lost independent rejection'; END IF;
 -- Existing approval is not erased by a cancelled draft or a later withdrawal.
 UPDATE public.kyc_verifications SET status='verified',document_verified=true,selfie_verified=true WHERE user_id=actor;
 UPDATE public.profiles SET kyc_status='approved' WHERE id=actor;
 result:=public.ig_kyc_action(actor,'begin','{"full_name":"Synthetic Lifecycle","birth_date":"1990-01-01","country":"US","document_type":"passport","consent":true,"consent_version":"2026-10-22","face_consent":false}');sid:=(result->>'id')::uuid;
 PERFORM public.ig_kyc_action(actor,'cancel',jsonb_build_object('id',sid));
 IF (SELECT kyc_status FROM public.profiles WHERE id=actor)<>'approved' THEN RAISE EXCEPTION 'Draft cancellation erased approval'; END IF;
 -- Direct synthetic transitions avoid the daily submission limit, never any
 -- comparison or biometric endpoint. Expiry of unresolved review resets status.
 UPDATE public.ig_kyc_submissions SET status='submitted' WHERE id=sid;
 UPDATE public.kyc_verifications SET status='needs_review',external_session_id=sid::text WHERE user_id=actor;
 UPDATE public.ig_kyc_submissions SET status='expired' WHERE id=sid;
 IF (SELECT kyc_status FROM public.profiles WHERE id=actor)<>'not_started' THEN RAISE EXCEPTION 'Expired review left pending profile'; END IF;
END $$;
