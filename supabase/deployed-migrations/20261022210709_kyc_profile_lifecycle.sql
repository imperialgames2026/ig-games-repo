-- Keep the account badge consistent with the manual submission lifecycle.
-- Existing independent reviewer decisions remain authoritative. Draft creation
-- does not change status; withdrawal never manufactures a new approval.
create function public.ig_kyc_sync_profile_lifecycle()
returns trigger language plpgsql security invoker set search_path='' as $$
declare prior_status text; prior_submission text;
begin
 if current_user not in ('postgres','service_role') then
  raise exception 'Service only' using errcode='42501';
 end if;
 if new.status is not distinct from old.status then return new;end if;
 if new.status='submitted' then
  update public.profiles set kyc_status='pending_review' where id=new.user_id;
 elsif new.status in ('cancelled','expired') and old.status in ('submitted','escalated') then
  -- Serialize account updates and do not let cleanup of an older submission
  -- overwrite a newer open submission's status.
  perform 1 from public.profiles where id=new.user_id for update;
  if exists(select 1 from public.ig_kyc_submissions where user_id=new.user_id
    and id<>new.id and status in ('submitted','escalated')) then return new;end if;
  select status,external_session_id into prior_status,prior_submission
   from public.kyc_verifications where user_id=new.user_id;
  update public.profiles set kyc_status=case
   when prior_submission is distinct from new.id::text and prior_status='verified' then 'approved'
   when prior_submission is distinct from new.id::text and prior_status='rejected' then 'rejected'
   else 'not_started' end where id=new.user_id;
 end if;
 return new;
end $$;
revoke all on function public.ig_kyc_sync_profile_lifecycle() from public,anon,authenticated;
grant execute on function public.ig_kyc_sync_profile_lifecycle() to service_role;
create trigger ig_kyc_profile_lifecycle after update of status on public.ig_kyc_submissions
 for each row execute function public.ig_kyc_sync_profile_lifecycle();
-- Repair pending work already created by the previous handler. Terminal reviewer
-- decisions and drafts are deliberately outside this backfill.
update public.profiles p set kyc_status='pending_review'
 where exists(select 1 from public.ig_kyc_submissions s where s.user_id=p.id
  and s.status in ('submitted','escalated'));
