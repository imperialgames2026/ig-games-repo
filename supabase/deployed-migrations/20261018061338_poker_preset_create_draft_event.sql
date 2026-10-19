-- Link a Superadmin staging preset to the existing versioned tournament event engine.
-- This creates DRAFT events only. Publishing/registration never charges real funds.
create table if not exists public.ig_poker_preset_events(
 preset_id uuid not null references public.ig_poker_tournament_presets(id),
 event_id uuid primary key references public.poker_events_v1(id),
 created_at timestamptz not null default now()
);
alter table public.ig_poker_preset_events enable row level security;
revoke all on public.ig_poker_preset_events from public,anon,authenticated;
grant select,insert on public.ig_poker_preset_events to service_role;

create or replace function public.ig_poker_create_event_from_preset(
 p_actor uuid,p_preset uuid,p_request uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.ig_poker_tournament_presets%rowtype;
 v_role text; v_config jsonb; v_levels jsonb; v_result jsonb; v_event uuid;
begin
 select ur.role::text into v_role from public.user_roles ur
 join public.profiles pr on pr.id=ur.user_id where ur.user_id=p_actor and pr.is_excluded=false;
 if v_role is distinct from 'superadmin' then raise exception 'SUPERADMIN_REQUIRED' using errcode='42501';end if;
 select * into p from public.ig_poker_tournament_presets where id=p_preset for update;
 if not found or p.status<>'draft' or p.variant<>'holdem' or p.currency<>'PRACTICE' or p.buy_in_units<>0
 then raise exception 'ONLY_FREE_PRACTICE_PRESETS_MAY_CREATE_EVENTS' using errcode='22023';end if;
 select jsonb_agg(jsonb_build_object('smallBlind',(x->>'small')::bigint,
  'bigBlind',(x->>'big')::bigint,'durationSeconds',(x->>'durationMinutes')::integer*60))
 into v_levels from jsonb_array_elements(p.blind_levels) x;
 if jsonb_array_length(v_levels)<1 then raise exception 'MISSING_LEVELS';end if;
 v_config:=jsonb_build_object('maxPlayers',p.seats_per_table*p.table_count,
 'seatsPerTable',p.seats_per_table,'tableCount',p.table_count,
 'startingStack',p.initial_stack,'levels',v_levels,
 'startAt',now()-interval '1 minute',
 'practiceOnly',true,'buyInUnits',0,'rakeCollected',false);
 v_result:=public.poker_event_create_v1(p_actor,p_request,p.name,p.format,v_config);
 v_event:=(v_result->>'eventId')::uuid;
 insert into public.ig_poker_preset_events(preset_id,event_id) values(p_preset,v_event)
 on conflict(event_id) do nothing;
 return v_result||jsonb_build_object('practiceOnly',true,'presetId',p_preset);
end $$;
revoke all on function public.ig_poker_create_event_from_preset(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.ig_poker_create_event_from_preset(uuid,uuid,uuid) to service_role;


