create table if not exists public.ig_slot_practice_accounts(
 user_id uuid primary key references auth.users(id) on delete cascade,
 chips bigint not null default 10000 check(chips between 0 and 1000000000),
 updated_at timestamptz not null default clock_timestamp()
);
create table if not exists public.ig_slot_practice_spins(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null,
 game text not null check(game in ('mystic-forest','diamond-dynasty','sapphire-storm','emerald-empire','phoenix-fire','aztec-treasure','ocean-treasure','farmageddon','neon-nights','cosmic-crown','golden-dragon','lucky-fortune','royal-ruby')),
 bet_units integer not null check(bet_units between 1 and 100),
 lines integer not null check(lines between 1 and 20),
 cost_units bigint not null check(cost_units>0),
 paid_units bigint not null check(paid_units>=0 and paid_units<=100000000),
 grid jsonb not null,
 winning_cells jsonb not null default '[]'::jsonb,
 scatter_count integer not null default 0 check(scatter_count between 0 and 16),
 balance_after bigint not null check(balance_after between 0 and 1000000000),
 created_at timestamptz not null default clock_timestamp(),
 unique(user_id,request_id)
);
create index if not exists ig_slot_practice_spins_user_recent on public.ig_slot_practice_spins(user_id,created_at desc);
alter table public.ig_slot_practice_accounts enable row level security;
alter table public.ig_slot_practice_spins enable row level security;
revoke all on public.ig_slot_practice_accounts,public.ig_slot_practice_spins from public,anon,authenticated;
grant select,insert,update on public.ig_slot_practice_accounts to service_role;
grant select,insert on public.ig_slot_practice_spins to service_role;

create or replace function public.ig_slot_practice_spin_v1(
 p_actor uuid,p_request uuid,p_game text,p_bet_units integer,p_lines integer,
 p_grid jsonb,p_winning_cells jsonb,p_scatter_count integer,p_paid_units bigint
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.ig_slot_practice_accounts%rowtype; existing public.ig_slot_practice_spins%rowtype;
 cost bigint; after_balance bigint;
begin
 if p_actor is null or p_request is null then raise exception 'Missing identity or request'; end if;
 if p_game not in ('mystic-forest','diamond-dynasty','sapphire-storm','emerald-empire','phoenix-fire','aztec-treasure','ocean-treasure','farmageddon','neon-nights','cosmic-crown','golden-dragon','lucky-fortune','royal-ruby') then raise exception 'Unsupported slot'; end if;
 if p_bet_units not between 1 and 100 or p_lines not between 1 and 20 then raise exception 'Invalid practice stake'; end if;
 if p_paid_units<0 or p_paid_units>100000000 or p_scatter_count not between 0 and 16 or jsonb_typeof(p_grid)<>'array' or jsonb_typeof(p_winning_cells)<>'array' then raise exception 'Invalid slot outcome'; end if;
 select * into existing from public.ig_slot_practice_spins where user_id=p_actor and request_id=p_request;
 if found then
  return jsonb_build_object('spinId',existing.id,'chips',existing.balance_after,'paidUnits',existing.paid_units,'grid',existing.grid,'winningCells',existing.winning_cells,'scatterCount',existing.scatter_count,'replayed',true);
 end if;
 insert into public.ig_slot_practice_accounts(user_id) values(p_actor) on conflict(user_id) do nothing;
 select * into a from public.ig_slot_practice_accounts where user_id=p_actor for update;
 cost:=p_bet_units::bigint*p_lines::bigint;
 if a.chips<cost then raise exception 'Not enough practice chips'; end if;
 after_balance:=a.chips-cost+p_paid_units;
 if after_balance<0 or after_balance>1000000000 then raise exception 'Practice balance out of range'; end if;
 update public.ig_slot_practice_accounts set chips=after_balance,updated_at=clock_timestamp() where user_id=p_actor;
 insert into public.ig_slot_practice_spins(user_id,request_id,game,bet_units,lines,cost_units,paid_units,grid,winning_cells,scatter_count,balance_after)
 values(p_actor,p_request,p_game,p_bet_units,p_lines,cost,p_paid_units,p_grid,p_winning_cells,p_scatter_count,after_balance)
 returning * into existing;
 return jsonb_build_object('spinId',existing.id,'chips',after_balance,'paidUnits',p_paid_units,'grid',p_grid,'winningCells',p_winning_cells,'scatterCount',p_scatter_count,'replayed',false);
end $$;
revoke all on function public.ig_slot_practice_spin_v1(uuid,uuid,text,integer,integer,jsonb,jsonb,integer,bigint) from public,anon,authenticated;
grant execute on function public.ig_slot_practice_spin_v1(uuid,uuid,text,integer,integer,jsonb,jsonb,integer,bigint) to service_role;

create or replace function public.ig_slot_practice_refill_v1(p_actor uuid) returns bigint
language plpgsql security definer set search_path=public,pg_temp as $$
declare current_chips bigint;
begin
 insert into public.ig_slot_practice_accounts(user_id) values(p_actor) on conflict(user_id) do nothing;
 select chips into current_chips from public.ig_slot_practice_accounts where user_id=p_actor for update;
 if current_chips>=100 then raise exception 'Practice refill is available below 100 chips'; end if;
 update public.ig_slot_practice_accounts set chips=10000,updated_at=clock_timestamp() where user_id=p_actor;
 return 10000;
end $$;
revoke all on function public.ig_slot_practice_refill_v1(uuid) from public,anon,authenticated;
grant execute on function public.ig_slot_practice_refill_v1(uuid) to service_role;

comment on table public.ig_slot_practice_accounts is 'Nonredeemable slot-practice chips only; never financial wallet balances.';
comment on table public.ig_slot_practice_spins is 'Server-authoritative practice slot outcomes and idempotent chip accounting; no monetary settlement.';
