-- REVIEW ONLY: followup AFTER exact e37cc16 consent SQL. No hosted application.
-- Approval includes Auth triggers/restoration restriction, FKs, private Definer cleanup.
-- Hard-deleted UUID recreation by privileged writers is UNSUPPORTED (no tombstone).
-- Take locks in same order as RPCs; installer must execute entire followup atomically.
lock table auth.users in share row exclusive mode;
lock table ig_sms_consent.events,ig_sms_consent.current_state in access exclusive mode;
alter table ig_sms_consent.events drop constraint events_actor_id_fkey;
alter table ig_sms_consent.events add constraint events_actor_id_fkey foreign key(actor_id) references auth.users(id) on delete cascade;
alter table ig_sms_consent.current_state drop constraint current_state_actor_id_fkey;
alter table ig_sms_consent.current_state add constraint current_state_actor_id_fkey foreign key(actor_id) references auth.users(id) on delete cascade;
alter table ig_sms_consent.current_state drop constraint current_state_event_id_fkey;
alter table ig_sms_consent.current_state add constraint current_state_event_id_fkey foreign key(event_id) references ig_sms_consent.events(id) on delete cascade;
drop trigger immutable_events on ig_sms_consent.events;
create trigger immutable_events before update or truncate on ig_sms_consent.events
for each statement execute function ig_sms_consent.reject_event_mutation();
create function ig_sms_consent.guard_event_delete() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from auth.users where id=old.actor_id and deleted_at is null) then
  raise exception 'CONSENT_EVENTS_IMMUTABLE' using errcode='42501'; end if;
 return old;
end $$;
alter function ig_sms_consent.guard_event_delete() owner to postgres;
revoke all on function ig_sms_consent.guard_event_delete() from public,anon,authenticated,service_role;
create trigger guarded_event_delete before delete on ig_sms_consent.events
for each row execute function ig_sms_consent.guard_event_delete();
create function ig_sms_consent.guard_auth_restore() returns trigger
language plpgsql set search_path='' as $$
begin
 if old.deleted_at is not null and (new.deleted_at is null or new.id is distinct from old.id) then
  raise exception 'CONSENT_AUTH_RESTORATION_UNSUPPORTED' using errcode='23514'; end if;
 return new;
end $$;
alter function ig_sms_consent.guard_auth_restore() owner to postgres;
revoke all on function ig_sms_consent.guard_auth_restore() from public,anon,authenticated,service_role;
create trigger consent_no_auth_restore before update of deleted_at,id on auth.users
for each row execute function ig_sms_consent.guard_auth_restore();
create function ig_sms_consent.cleanup_deleted_auth_actor() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.deleted_at is not null then
  delete from ig_sms_consent.current_state where actor_id=new.id;
  delete from ig_sms_consent.events where actor_id=new.id;
 end if;
 return new;
end $$;
alter function ig_sms_consent.cleanup_deleted_auth_actor() owner to postgres;
revoke all on function ig_sms_consent.cleanup_deleted_auth_actor() from public,anon,authenticated,service_role;
create trigger consent_auth_soft_delete after update of deleted_at on auth.users
for each row execute function ig_sms_consent.cleanup_deleted_auth_actor();
-- Explicit backfill of already deleted actors only; same approved transaction.
delete from ig_sms_consent.current_state s using auth.users u where s.actor_id=u.id and u.deleted_at is not null;
delete from ig_sms_consent.events e using auth.users u where e.actor_id=u.id and u.deleted_at is not null;
create or replace function public.practice_sms_consent_v1(p_actor uuid,p_request_id uuid,p_action text,p_phone text,p_policy_version text,p_expected_revision bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e ig_sms_consent.events%rowtype; s ig_sms_consent.current_state%rowtype; phone text;
begin
 if p_actor is null or p_request_id is null or p_action is null or p_action not in ('grant','revoke','change_number')
 or (p_action='grant' and (p_policy_version is distinct from '2026-10-27.v1' or p_expected_revision is null or p_expected_revision<0 or p_expected_revision>9007199254740990))
 or (p_action<>'grant' and p_expected_revision is not null) then
 raise exception 'INVALID_CONSENT_REQUEST' using errcode='22023'; end if;
 phone:=pg_catalog.btrim(p_phone);
 if (p_action in ('revoke','change_number') and p_phone is not null) or
 (p_action='grant' and (phone is null or phone !~ '^\+[1-9][0-9]{7,14}$')) then
 raise exception 'INVALID_CONSENT_PHONE' using errcode='22023'; end if;
 -- Row lock serializes all requests for this actual Auth actor, without hash collisions.
 perform 1 from auth.users where id=p_actor and deleted_at is null for update;
 if not found then raise exception 'CONSENT_NOT_AUTHORIZED' using errcode='42501'; end if;
 -- Withdrawal is always possible for an existing actor, including excluded accounts.
 if p_action='grant' and (not exists(select 1 from public.profiles where id=p_actor and is_excluded=false)
 or not exists(select 1 from public.user_roles where user_id=p_actor and role in ('player','admin','superadmin'))) then
 raise exception 'CONSENT_NOT_AUTHORIZED' using errcode='42501'; end if;
 select * into e from ig_sms_consent.events where actor_id=p_actor and request_id=p_request_id;
 if found then
  if e.action is distinct from p_action or e.phone is distinct from phone
  or e.expected_revision is distinct from p_expected_revision
  or e.requested_policy_version is distinct from p_policy_version or e.purpose<>'transactional_account'
  or e.affirmative is distinct from (p_action='grant') then
   raise exception 'CONSENT_REQUEST_CONFLICT' using errcode='23505'; end if;
 else
  select * into s from ig_sms_consent.current_state where actor_id=p_actor;
  if p_action='grant' and p_expected_revision<>coalesce(s.revision,0) then
   raise exception 'CONSENT_REVISION_CONFLICT' using errcode='23505'; end if;
  if coalesce(s.revision,0)>=9007199254740991 then
   raise exception 'CONSENT_REVISION_EXHAUSTED' using errcode='22003'; end if;
  insert into ig_sms_consent.events(actor_id,request_id,purpose,policy_version,requested_policy_version,expected_revision,action,phone,affirmative)
   values(p_actor,p_request_id,'transactional_account','2026-10-27.v1',p_policy_version,p_expected_revision,p_action,phone,p_action='grant') returning * into e;
  insert into ig_sms_consent.current_state(actor_id,purpose,policy_version,revision,status,phone,event_id,recorded_at)
   values(p_actor,'transactional_account','2026-10-27.v1',coalesce(s.revision,0)+1,case when p_action='grant' then 'granted' else 'revoked' end,
    case when p_action='grant' then phone else null end,e.id,e.recorded_at)
  on conflict(actor_id) do update set policy_version=excluded.policy_version,revision=excluded.revision,status=excluded.status,
   phone=excluded.phone,event_id=excluded.event_id,recorded_at=excluded.recorded_at;
 end if;
 select * into s from ig_sms_consent.current_state where actor_id=p_actor;
 return pg_catalog.jsonb_build_object('requestId',p_request_id,'eventId',e.id,'action',e.action,
 'policyVersion',s.policy_version,'revision',s.revision,'status',s.status,'recordedAt',e.recorded_at,'deliveryEnabled',false);
end $$;
alter function public.practice_sms_consent_v1(uuid,uuid,text,text,text,bigint) owner to postgres;
revoke all on function public.practice_sms_consent_v1(uuid,uuid,text,text,text,bigint) from public,anon,authenticated;
grant execute on function public.practice_sms_consent_v1(uuid,uuid,text,text,text,bigint) to service_role;
create or replace function public.practice_sms_consent_status_v1(p_actor uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s ig_sms_consent.current_state%rowtype;
begin
 if p_actor is null then raise exception 'CONSENT_NOT_AUTHORIZED' using errcode='42501'; end if;
 perform 1 from auth.users where id=p_actor and deleted_at is null for update;
 if not found then
 raise exception 'CONSENT_NOT_AUTHORIZED' using errcode='42501'; end if;
 select * into s from ig_sms_consent.current_state where actor_id=p_actor;
 return pg_catalog.jsonb_build_object('status',coalesce(s.status,'not_recorded'),'revision',coalesce(s.revision,0),'policyVersion',s.policy_version,
 'recordedAt',s.recorded_at,'phoneVerified',false,'deliveryEnabled',false);
end $$;
alter function public.practice_sms_consent_status_v1(uuid) owner to postgres;
revoke all on function public.practice_sms_consent_status_v1(uuid) from public,anon,authenticated;
grant execute on function public.practice_sms_consent_status_v1(uuid) to service_role;
