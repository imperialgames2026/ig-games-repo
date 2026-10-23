-- Signed upload authorization is checked before the request body finishes.
-- Keep minimal tombstones eligible for periodic reconciliation indefinitely:
-- no finite token fence proves that every already-started stream has finished.
alter table public.ig_kyc_submissions add column evidence_recheck_at timestamptz;
create index ig_kyc_retention_recheck on public.ig_kyc_submissions
 (coalesce(evidence_recheck_at,expires_at),id);
create function public.ig_kyc_retention_action(p_actor uuid,p_action text,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.ig_kyc_submissions;
begin
 if current_user not in ('service_role','postgres') then raise exception 'Service only' using errcode='42501';end if;
 if p_action not in ('worker_expired','worker_purged') then raise exception 'Retention actions only' using errcode='22023';end if;
 if not exists(select 1 from public.ig_kyc_workers where token_hash=p_payload->>'token_hash' and enabled and expires_at>now()) then
  raise exception 'Worker denied' using errcode='42501';end if;
 update public.ig_kyc_workers set last_seen_at=now() where token_hash=p_payload->>'token_hash';
 if p_action='worker_expired' then
  return coalesce((select jsonb_agg(jsonb_build_object('id',id)) from
   (select id from public.ig_kyc_submissions where expires_at<=now()
    and (upload_valid_until is null or upload_valid_until<=now())
    and (evidence_recheck_at is null or evidence_recheck_at<=now())
    order by coalesce(evidence_recheck_at,expires_at),id limit 10) due),'[]');
 end if;
 select * into s from public.ig_kyc_submissions where id=(p_payload->>'id')::uuid
  and expires_at<=now() and (upload_valid_until is null or upload_valid_until<=now())
  and (evidence_recheck_at is null or evidence_recheck_at<=now()) for update;
 if not found then raise exception 'Deletion not due' using errcode='40001';end if;
 if s.evidence_deleted_at is null then
  update public.ig_kyc_submissions set evidence='{}',face_result=null,full_name='Deleted',birth_date='1900-01-01',
   review_reason=null,customer_message=null,evidence_deleted_at=now(),face_lease=null,face_lease_until=null,
   status=case when status in ('draft','submitted','escalated') then 'expired' else status end,
   evidence_recheck_at=now()+interval '1 hour',updated_at=now() where id=s.id;
  insert into public.ig_kyc_audit(submission_id,action) values(s.id,'evidence_deleted');
 else
  -- Repeated sweeps neither revive data nor replace the original deletion audit.
  update public.ig_kyc_submissions set evidence_recheck_at=now()+interval '1 hour' where id=s.id;
 end if;
 return jsonb_build_object('deleted',true,'reconciled',s.evidence_deleted_at is not null);
end $$;
revoke all on function public.ig_kyc_retention_action(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.ig_kyc_retention_action(uuid,text,jsonb) to service_role;
