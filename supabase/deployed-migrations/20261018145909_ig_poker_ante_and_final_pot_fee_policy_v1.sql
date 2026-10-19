-- Staging-only poker fees. Never activates charges against practice chips by itself.
create table if not exists public.ig_poker_fee_policy (
  singleton boolean primary key default true check(singleton),
  ante_fee_bps integer not null default 100 check(ante_fee_bps between 0 and 10000),
  final_pot_fee_bps integer not null default 200 check(final_pot_fee_bps between 0 and 10000),
  fees_enabled boolean not null default false,
  currency_unit text not null default 'practice_chip' check(currency_unit='practice_chip'),
  updated_at timestamptz not null default now()
);
insert into public.ig_poker_fee_policy(singleton) values(true) on conflict (singleton) do update set
  ante_fee_bps=100,final_pot_fee_bps=200,fees_enabled=false,updated_at=now();
alter table public.ig_poker_fee_policy enable row level security;
revoke all on public.ig_poker_fee_policy from anon,authenticated;
grant select on public.ig_poker_fee_policy to authenticated;
create policy "read_poker_fee_policy" on public.ig_poker_fee_policy for select to authenticated using(true);
comment on table public.ig_poker_fee_policy is 'Planned 1% player ante fee plus 2% pot fee; disabled until integrated, disclosed and tested in hand-start and settlement functions.';
-- Pure preview: initial gross pot includes all posted antes. Fee 1 is per
-- participant, fee 2 is charged on final pot AFTER ante fee deduction.
-- Whole-chip amounts round DOWN (never overcharge).
create or replace function public.ig_poker_fee_preview(
  p_ante_per_player bigint,
  p_players integer,
  p_gross_final_pot bigint
)
returns table(ante_fee_per_player bigint,total_ante_fees bigint,pot_after_ante_fees bigint,final_pot_fee bigint,winner_pot bigint)
language plpgsql stable security invoker set search_path=public,pg_temp as $$
declare v_policy public.ig_poker_fee_policy%rowtype; v_ante_fee bigint; v_total bigint;v_remain bigint;v_rake bigint;
begin
 if p_ante_per_player < 0 or p_players < 2 or p_players > 10
   or p_gross_final_pot < 0 or p_gross_final_pot < p_ante_per_player::numeric*p_players then
   raise exception 'invalid poker fee preview inputs';
 end if;
 select * into v_policy from public.ig_poker_fee_policy where singleton=true;
 if not found then raise exception 'poker policy unavailable'; end if;
 v_ante_fee:=floor(p_ante_per_player::numeric * v_policy.ante_fee_bps / 10000)::bigint;
 v_total:=v_ante_fee * p_players;
 v_remain:=p_gross_final_pot-v_total;
 v_rake:=floor(v_remain::numeric * v_policy.final_pot_fee_bps / 10000)::bigint;
 return query select v_ante_fee,v_total,v_remain,v_rake,v_remain-v_rake;
end $$;
revoke all on function public.ig_poker_fee_preview(bigint,integer,bigint) from public,anon;
grant execute on function public.ig_poker_fee_preview(bigint,integer,bigint) to authenticated;


