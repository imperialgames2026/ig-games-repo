-- Self-exclusion: player-initiated one-way security restriction.
-- Not a withdrawal, prize claim, gambling approval, age check, or KYC flow.
-- Server-only Edge JWT validation is required before this RPC is called.
create table if not exists public.ig_self_exclusion_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  event_type text not null default 'self_exclusion_activated'
    check (event_type='self_exclusion_activated'),
  created_at timestamptz not null default now(),
  unique (user_id,request_id)
);
alter table public.ig_self_exclusion_events enable row level security;
revoke all on public.ig_self_exclusion_events from public,anon,authenticated;
grant select on public.ig_self_exclusion_events to authenticated;
drop policy if exists "own self exclusion audit" on public.ig_self_exclusion_events;
create policy "own self exclusion audit" on public.ig_self_exclusion_events
  for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.ig_activate_self_exclusion(
 p_user uuid,p_request uuid
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
 v_excluded boolean;
begin
 if p_user is null or p_request is null then
    raise exception 'Invalid exclusion request' using errcode='22023';
 end if;
 select is_excluded into v_excluded
 from public.profiles
 where id=p_user
 for update;
 if not found or v_excluded is null then
    raise exception 'Account unavailable' using errcode='42501';
 end if;
 if v_excluded = false then
    update public.profiles
       set is_excluded=true,updated_at=now()
     where id=p_user and is_excluded=false;
 end if;
 insert into public.ig_self_exclusion_events(user_id,request_id)
   values(p_user,p_request)
   on conflict(user_id,request_id) do nothing;
 return pg_catalog.jsonb_build_object(
  'excluded',true,'requires_manual_reinstatement',true,
  'active',true,'already_excluded',v_excluded
 );
end $$;

revoke all on function public.ig_activate_self_exclusion(uuid,uuid)
 from public,anon,authenticated;
grant execute on function public.ig_activate_self_exclusion(uuid,uuid)
 to service_role;
comment on table public.ig_self_exclusion_events is
'Permanent audit of player-initiated account exclusion. No player-facing reversal. Manual legal/compliance review required to consider reinstatement.';


