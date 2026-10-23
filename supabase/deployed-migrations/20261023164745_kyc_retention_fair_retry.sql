-- Reserve retry eligibility before Storage I/O. Abandoned or failed attempts
-- yield to later due rows even when a whole cycle takes longer than the delay.
alter table public.ig_kyc_submissions
 add column cleanup_attempt uuid,
 add column cleanup_attempts integer not null default 0 check(cleanup_attempts between 0 and 5),
 add column cleanup_retry_at timestamptz;
create index ig_kyc_retention_fair_due on public.ig_kyc_submissions
 (greatest(expires_at,upload_valid_until,evidence_recheck_at,cleanup_retry_at),id);
create function public.ig_kyc_retention_action_v2(p_actor uuid,p_action text,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.ig_kyc_submissions; attempt uuid; attempts integer;
begin
 if current_user not in ('service_role','postgres') then raise exception 'Service only' using errcode='42501';end if;
 if p_action not in ('worker_expired','worker_attempt','worker_purged') then raise exception 'Retention actions only' using errcode='22023';end if;
 if not exists(select 1 from public.ig_kyc_workers where token_hash=p_payload->>'token_hash' and enabled and expires_at>now()) then
  raise exception 'Worker denied' using errcode='42501';end if;
 update public.ig_kyc_workers set last_seen_at=now() where token_hash=p_payload->>'token_hash';
 if p_action='worker_expired' then
  return coalesce((select jsonb_agg(jsonb_build_object('id',id)) from
   (select id from public.ig_kyc_submissions where expires_at<=now()
    and (upload_valid_until is null or upload_valid_until<=now())
    and (evidence_recheck_at is null or evidence_recheck_at<=now())
    and (cleanup_retry_at is null or cleanup_retry_at<=now())
    order by greatest(expires_at,upload_valid_until,evidence_recheck_at,cleanup_retry_at),id limit 10) due),'[]');
 end if;
 select * into s from public.ig_kyc_submissions where id=(p_payload->>'id')::uuid
  and expires_at<=now() and (upload_valid_until is null or upload_valid_until<=now())
  and (evidence_recheck_at is null or evidence_recheck_at<=now()) for update;
 if not found then raise exception 'Deletion not due' using errcode='40001';end if;
 if p_action='worker_attempt' then
  if s.cleanup_retry_at>now() then raise exception 'Retry not due' using errcode='40001';end if;
  attempt:=gen_random_uuid();attempts:=least(s.cleanup_attempts+1,5);
  update public.ig_kyc_submissions set cleanup_attempt=attempt,cleanup_attempts=attempts,
   cleanup_retry_at=now()+make_interval(mins=>least(5*(1<<(attempts-1)),60)) where id=s.id;
  return jsonb_build_object('id',s.id,'user_id',s.user_id,'attempt',attempt);
 end if;
 -- Completion can occur before the retry deadline, but only for the exact
 -- current non-null attempt. A later reservation invalidates stale completions.
 if s.cleanup_attempt is null or p_payload->>'attempt' is null
  or s.cleanup_attempt<>(p_payload->>'attempt')::uuid then
  raise exception 'Stale cleanup attempt' using errcode='40001';end if;
 if s.evidence_deleted_at is null then
  update public.ig_kyc_submissions set evidence='{}',face_result=null,full_name='Deleted',birth_date='1900-01-01',
   review_reason=null,customer_message=null,evidence_deleted_at=now(),face_lease=null,face_lease_until=null,
   status=case when status in ('draft','submitted','escalated') then 'expired' else status end,
   evidence_recheck_at=now()+interval '1 hour',updated_at=now(),
   cleanup_attempt=null,cleanup_attempts=0,cleanup_retry_at=null where id=s.id;
  insert into public.ig_kyc_audit(submission_id,action) values(s.id,'evidence_deleted');
 else
  update public.ig_kyc_submissions set evidence_recheck_at=now()+interval '1 hour',
   cleanup_attempt=null,cleanup_attempts=0,cleanup_retry_at=null where id=s.id;
 end if;
 return jsonb_build_object('deleted',true,'reconciled',s.evidence_deleted_at is not null);
end $$;
revoke all on function public.ig_kyc_retention_action_v2(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.ig_kyc_retention_action_v2(uuid,text,jsonb) to service_role;
