-- REVIEW ONLY. Not a recorded migration or deployed API. SMS delivery remains disabled.
-- Execute atomically only after review. Edge authenticates actor; body actor is forbidden.
create schema ig_sms_consent;
revoke all on schema ig_sms_consent from public,anon,authenticated,service_role;
create table ig_sms_consent.events (
 id uuid primary key default pg_catalog.gen_random_uuid(),
 actor_id uuid not null references auth.users(id), request_id uuid not null,
 purpose text not null check(purpose='transactional_account'),
 policy_version text not null check(policy_version='2026-10-27.v1'),
 requested_policy_version text,
 action text not null check(action in ('grant','revoke','change_number')),
 phone text, affirmative boolean not null,
 recorded_at timestamptz not null default pg_catalog.clock_timestamp(),
 unique(actor_id,request_id),
 check ((action in ('revoke','change_number') and phone is null and not affirmative) or
 (action='grant' and phone ~ '^\+[1-9][0-9]{7,14}$' and affirmative))
);
create table ig_sms_consent.current_state (
 actor_id uuid primary key references auth.users(id),
 purpose text not null check(purpose='transactional_account'),
 policy_version text not null check(policy_version='2026-10-27.v1'),
 status text not null check(status in ('granted','revoked')),
 phone text, event_id uuid not null references ig_sms_consent.events(id),
 recorded_at timestamptz not null,
 check((status='granted' and phone is not null) or (status='revoked' and phone is null))
);
alter table ig_sms_consent.events enable row level security;
alter table ig_sms_consent.current_state enable row level security;
revoke all on all tables in schema ig_sms_consent from public,anon,authenticated,service_role;
create function ig_sms_consent.reject_event_mutation() returns trigger
language plpgsql set search_path='' as $$ begin
 raise exception 'CONSENT_EVENTS_IMMUTABLE' using errcode='42501'; end $$;
revoke all on function ig_sms_consent.reject_event_mutation() from public,anon,authenticated,service_role;
create trigger immutable_events before update or delete or truncate on ig_sms_consent.events
for each statement execute function ig_sms_consent.reject_event_mutation();

-- Privileged atomic audit write: definer deliberately avoids direct service table grants.
-- Fixed postgres owner, fully qualified references, empty path and service-only execute.
create function public.practice_sms_consent_v1(p_actor uuid,p_request_id uuid,p_action text,p_phone text,p_policy_version text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e ig_sms_consent.events%rowtype; s ig_sms_consent.current_state%rowtype; phone text;
begin
 if p_actor is null or p_request_id is null or p_action is null or p_action not in ('grant','revoke','change_number')
 or (p_action='grant' and p_policy_version is distinct from '2026-10-27.v1') then
 raise exception 'INVALID_CONSENT_REQUEST' using errcode='22023'; end if;
 phone:=pg_catalog.btrim(p_phone);
 if (p_action in ('revoke','change_number') and p_phone is not null) or
 (p_action='grant' and (phone is null or phone !~ '^\+[1-9][0-9]{7,14}$')) then
 raise exception 'INVALID_CONSENT_PHONE' using errcode='22023'; end if;
 -- Row lock serializes all requests for this actual Auth actor, without hash collisions.
 perform 1 from auth.users where id=p_actor for update;
 if not found then raise exception 'CONSENT_NOT_AUTHORIZED' using errcode='42501'; end if;
 -- Withdrawal is always possible for an existing actor, including excluded accounts.
 if p_action='grant' and (not exists(select 1 from public.profiles where id=p_actor and is_excluded=false)
 or not exists(select 1 from public.user_roles where user_id=p_actor and role in ('player','admin','superadmin'))) then
 raise exception 'CONSENT_NOT_AUTHORIZED' using errcode='42501'; end if;
 select * into e from ig_sms_consent.events where actor_id=p_actor and request_id=p_request_id;
 if found then
  if e.action is distinct from p_action or e.phone is distinct from phone
  or e.requested_policy_version is distinct from p_policy_version or e.purpose<>'transactional_account'
  or e.affirmative is distinct from (p_action='grant') then
   raise exception 'CONSENT_REQUEST_CONFLICT' using errcode='23505'; end if;
 else
  insert into ig_sms_consent.events(actor_id,request_id,purpose,policy_version,requested_policy_version,action,phone,affirmative)
   values(p_actor,p_request_id,'transactional_account','2026-10-27.v1',p_policy_version,p_action,phone,p_action='grant') returning * into e;
  insert into ig_sms_consent.current_state(actor_id,purpose,policy_version,status,phone,event_id,recorded_at)
   values(p_actor,'transactional_account','2026-10-27.v1',case when p_action='grant' then 'granted' else 'revoked' end,
    case when p_action='grant' then phone else null end,e.id,e.recorded_at)
  on conflict(actor_id) do update set policy_version=excluded.policy_version,status=excluded.status,
   phone=excluded.phone,event_id=excluded.event_id,recorded_at=excluded.recorded_at;
 end if;
 select * into s from ig_sms_consent.current_state where actor_id=p_actor;
 return pg_catalog.jsonb_build_object('requestId',p_request_id,'eventId',e.id,'action',e.action,
 'policyVersion',s.policy_version,'status',s.status,'recordedAt',e.recorded_at,'deliveryEnabled',false);
end $$;
alter function public.practice_sms_consent_v1(uuid,uuid,text,text,text) owner to postgres;
revoke all on function public.practice_sms_consent_v1(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.practice_sms_consent_v1(uuid,uuid,text,text,text) to service_role;
create function public.practice_sms_consent_status_v1(p_actor uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s ig_sms_consent.current_state%rowtype;
begin
 if p_actor is null or not exists(select 1 from auth.users where id=p_actor) then
 raise exception 'CONSENT_NOT_AUTHORIZED' using errcode='42501'; end if;
 select * into s from ig_sms_consent.current_state where actor_id=p_actor;
 return pg_catalog.jsonb_build_object('status',coalesce(s.status,'not_recorded'),'policyVersion',s.policy_version,
 'recordedAt',s.recorded_at,'phoneVerified',false,'deliveryEnabled',false);
end $$;
alter function public.practice_sms_consent_status_v1(uuid) owner to postgres;
revoke all on function public.practice_sms_consent_status_v1(uuid) from public,anon,authenticated;
grant execute on function public.practice_sms_consent_status_v1(uuid) to service_role;
