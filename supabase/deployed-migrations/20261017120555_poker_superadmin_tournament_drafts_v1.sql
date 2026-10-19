create table if not exists public.poker_events_v1 (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(name) between 3 and 90),
 format text not null check(format in ('scheduled_mtt','sit_and_go','ring')),
 game text not null default 'nl_holdem' check(game='nl_holdem'),
 status text not null default 'draft' check(status in ('draft','registration','seating','running','paused','finished','cancelled')),
 created_by uuid not null references auth.users(id),
 config jsonb not null,
 version bigint not null default 0,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.poker_event_audit_v1 (
 id bigint generated always as identity primary key,
 event_id uuid not null references public.poker_events_v1(id),
 actor_id uuid not null references auth.users(id),
 operation text not null,
 request_id uuid not null unique,
 before_version bigint,
 after_version bigint not null,
 occurred_at timestamptz not null default now(),
 details jsonb not null default '{}'::jsonb
);
alter table public.poker_events_v1 enable row level security;
alter table public.poker_event_audit_v1 enable row level security;
revoke all on public.poker_events_v1, public.poker_event_audit_v1 from anon,authenticated;
create or replace function public.poker_event_create_v1(p_actor uuid,p_request uuid,p_name text,p_format text,p_config jsonb) returns jsonb
 language plpgsql security invoker set search_path='' as $$
declare eid uuid; old_id uuid; v jsonb;
begin
 if p_actor is null or p_request is null then raise exception 'INVALID_REQUEST';end if;
 select event_id into old_id from public.poker_event_audit_v1 where request_id=p_request;
 if found then
  select jsonb_build_object('eventId',id,'version',version,'status',status) into v from public.poker_events_v1 where id=old_id;
  return v;
 end if;
 if p_name is null or length(p_name) not between 3 and 90 or p_format not in ('scheduled_mtt','sit_and_go','ring') or jsonb_typeof(p_config)<>'object' then raise exception 'INVALID_CONFIG';end if;
 insert into public.poker_events_v1(name,format,created_by,config) values(p_name,p_format,p_actor,p_config) returning id into eid;
 insert into public.poker_event_audit_v1(event_id,actor_id,operation,request_id,before_version,after_version) values(eid,p_actor,'create',p_request,null,0);
 return jsonb_build_object('eventId',eid,'version',0,'status','draft');
end $$;
revoke all on function public.poker_event_create_v1(uuid,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.poker_event_create_v1(uuid,uuid,text,text,jsonb) to service_role;


