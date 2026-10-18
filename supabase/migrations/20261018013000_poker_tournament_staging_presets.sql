-- Staging tournament presets; no wallet debits, fees, prizes, custody, or live rake.
create table if not exists public.ig_poker_tournament_presets (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(name) between 3 and 90),
 created_by uuid not null references auth.users(id),
 format text not null default 'scheduled_mtt' check(format in ('scheduled_mtt','sit_and_go','ring')),
 variant text not null default 'holdem' check(variant in ('holdem','omaha')),
 seats_per_table integer not null check(seats_per_table between 6 and 8),
 table_count integer not null check(table_count between 1 and 30),
 currency text not null check(currency in ('PRACTICE','IC','ID','IGD','IGN')),
 buy_in_units bigint not null check(buy_in_units>=0),
 rake_bps integer not null default 0 check(rake_bps between 0 and 1000),
 rake_cap_units bigint not null default 0 check(rake_cap_units>=0),
 rake_from_forced_bets boolean not null default false check(rake_from_forced_bets=false),
 no_flop_no_drop boolean not null default true,
 bomb_pots_enabled boolean not null default false,
 bomb_pot_every_hands integer not null default 0 check(bomb_pot_every_hands between 0 and 1000),
 ante_enabled boolean not null default false,
 ante_units bigint not null default 0 check(ante_units>=0),
 blind_levels jsonb not null default '[{"small":25,"big":50,"durationMinutes":10}]'::jsonb,
 initial_stack bigint not null default 5000 check(initial_stack between 100 and 10000000),
 max_open_tables integer not null default 3 check(max_open_tables between 1 and 3),
 status text not null default 'draft' check(status in ('draft','review_required')),
 real_money_enabled boolean not null default false check(real_money_enabled=false),
 fee_collection_enabled boolean not null default false check(fee_collection_enabled=false),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check (variant='holdem' or seats_per_table=6),
 check ((bomb_pots_enabled and bomb_pot_every_hands>=1) or (not bomb_pots_enabled and bomb_pot_every_hands=0)),
 check (currency='PRACTICE' or real_money_enabled=false)
);
alter table public.ig_poker_tournament_presets enable row level security;
revoke all on public.ig_poker_tournament_presets from public,anon,authenticated;
grant select,insert,update on public.ig_poker_tournament_presets to service_role;

create or replace function public.ig_poker_tournament_preset_save(
 p_actor uuid,p_config jsonb,p_id uuid default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_role text; v_id uuid; v_row public.ig_poker_tournament_presets%rowtype;
  v_variant text;v_seats integer;v_tables integer;v_currency text;v_rake integer;v_bomb boolean;
  v_frequency integer;v_blinds jsonb;v_name text;v_buy bigint;v_cap bigint;v_stack bigint;
  v_ante bigint;v_format text;
begin
 select ur.role::text into v_role from public.user_roles ur join public.profiles pr on pr.id=ur.user_id
 where ur.user_id=p_actor and pr.is_excluded=false;
 if v_role is distinct from 'superadmin' then raise exception 'SUPERADMIN_REQUIRED' using errcode='42501';end if;
 if jsonb_typeof(p_config)<>'object' then raise exception 'INVALID_CONFIG' using errcode='22023';end if;
 v_name:=trim(p_config->>'name');v_format:=coalesce(p_config->>'format','scheduled_mtt');
 v_variant:=coalesce(p_config->>'variant','holdem');v_currency:=coalesce(p_config->>'currency','PRACTICE');
 v_seats:=(p_config->>'seatsPerTable')::integer;v_tables:=(p_config->>'tableCount')::integer;
 v_rake:=(p_config->>'rakeBps')::integer;v_bomb:=coalesce((p_config->>'bombPotsEnabled')::boolean,false);
 v_frequency:=coalesce((p_config->>'bombPotEveryHands')::integer,0);
 v_blinds:=p_config->'blindLevels';v_buy:=(p_config->>'buyInUnits')::bigint;
 v_cap:=coalesce((p_config->>'rakeCapUnits')::bigint,0);
 v_stack:=coalesce((p_config->>'initialStack')::bigint,5000);
 v_ante:=coalesce((p_config->>'anteUnits')::bigint,0);
 if length(v_name) not between 3 and 90 or v_format not in ('scheduled_mtt','sit_and_go','ring')
 or v_variant not in ('holdem','omaha') or v_currency not in ('PRACTICE','IC','ID','IGD','IGN')
 or v_seats not between 6 and 8 or v_tables not between 1 and 30
 or (v_variant='omaha' and v_seats<>6) or v_rake not between 0 and 1000
 or v_buy is null or v_buy<0 or v_cap<0 or v_stack not between 100 and 10000000
 or v_ante<0 or v_frequency not between 0 and 1000
 or (v_bomb and v_frequency=0) or (not v_bomb and v_frequency<>0)
 or jsonb_typeof(v_blinds)<>'array' or jsonb_array_length(v_blinds) not between 1 and 40
 or (p_config ? 'rakeFromForcedBets' and (p_config->>'rakeFromForcedBets')::boolean)
 or (p_config ? 'realMoneyEnabled' and (p_config->>'realMoneyEnabled')::boolean)
 or (p_config ? 'feeCollectionEnabled' and (p_config->>'feeCollectionEnabled')::boolean)
 then raise exception 'INVALID_TOURNAMENT_CONFIG' using errcode='22023';end if;
 if p_id is null then
 insert into public.ig_poker_tournament_presets(name,created_by,format,variant,seats_per_table,table_count,currency,buy_in_units,rake_bps,rake_cap_units,no_flop_no_drop,bomb_pots_enabled,bomb_pot_every_hands,ante_enabled,ante_units,blind_levels,initial_stack)
 values(v_name,p_actor,v_format,v_variant,v_seats,v_tables,v_currency,v_buy,v_rake,v_cap,
 coalesce((p_config->>'noFlopNoDrop')::boolean,true),v_bomb,v_frequency,
 coalesce((p_config->>'anteEnabled')::boolean,false),v_ante,v_blinds,v_stack)
 returning * into v_row;
 else
 update public.ig_poker_tournament_presets set
 name=v_name,format=v_format,variant=v_variant,seats_per_table=v_seats,table_count=v_tables,
 currency=v_currency,buy_in_units=v_buy,rake_bps=v_rake,rake_cap_units=v_cap,
 no_flop_no_drop=coalesce((p_config->>'noFlopNoDrop')::boolean,true),
 bomb_pots_enabled=v_bomb,bomb_pot_every_hands=v_frequency,
 ante_enabled=coalesce((p_config->>'anteEnabled')::boolean,false),ante_units=v_ante,
 blind_levels=v_blinds,initial_stack=v_stack,updated_at=now()
 where id=p_id and status='draft' returning * into v_row;
 if not found then raise exception 'DRAFT_NOT_FOUND' using errcode='22023';end if;
 end if;
 return jsonb_build_object('id',v_row.id,'name',v_row.name,'status',v_row.status,
 'capacity',v_row.seats_per_table*v_row.table_count,'practiceOnly',true,
 'rakeConfiguredBps',v_row.rake_bps,'rakeCollected',false);
end $$;
revoke all on function public.ig_poker_tournament_preset_save(uuid,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.ig_poker_tournament_preset_save(uuid,jsonb,uuid) to service_role;
