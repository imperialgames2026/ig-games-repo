-- Nonredeemable craps-table practice-chip refill; no financial wallet, transaction,
-- custody, purchasable token or any redeemable asset can be affected.
create table if not exists public.ig_mp_practice_refills(
 id uuid primary key default gen_random_uuid(),
 game text not null check(game='craps'),
 user_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null,
 amount integer not null check(amount=500),
 chips_before integer not null check(chips_before between 0 and 100),
 chips_after integer not null check(chips_after=chips_before+amount),
 granted_at timestamptz not null default clock_timestamp(),
 unique(game,user_id,request_id)
);
create index if not exists ig_mp_practice_refill_cooldown on public.ig_mp_practice_refills(user_id,game,granted_at desc);
alter table public.ig_mp_practice_refills enable row level security;
revoke all on public.ig_mp_practice_refills from public,anon,authenticated;
grant select,insert on public.ig_mp_practice_refills to service_role;

create or replace function public.ig_mp_craps_refill(
 p_actor uuid,p_request uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_player public.ig_mp_players%rowtype;v_role text;v_last timestamptz;
 v_old public.ig_mp_practice_refills%rowtype;v_new public.ig_mp_practice_refills%rowtype;
begin
 if p_request is null then raise exception 'REQUEST_REQUIRED' using errcode='22023';end if;
 select ur.role::text into v_role from public.user_roles ur
 join public.profiles pr on pr.id=ur.user_id
 where ur.user_id=p_actor and pr.is_excluded=false;
 if v_role not in ('player','admin','superadmin') or v_role is null then
  raise exception 'PLAYER_NOT_ELIGIBLE' using errcode='42501';end if;
 -- Serialize all player refills, including concurrent requests with different keys.
 select * into v_player from public.ig_mp_players
 where game='craps' and user_id=p_actor and seated for update;
 if not found then raise exception 'JOIN_CRAPS_TABLE_FIRST' using errcode='22023';end if;
 select * into v_old from public.ig_mp_practice_refills
 where game='craps' and user_id=p_actor and request_id=p_request;
 if found then return jsonb_build_object('replayed',true,'amount',v_old.amount,
   'balanceAfter',v_old.chips_after,'practiceOnly',true);end if;
 if v_player.chips>100 then raise exception 'BALANCE_ABOVE_REFILL_THRESHOLD' using errcode='22023';end if;
 select granted_at into v_last from public.ig_mp_practice_refills
 where game='craps' and user_id=p_actor order by granted_at desc limit 1;
 if v_last is not null and v_last>clock_timestamp()-interval '24 hours' then
   raise exception 'REFILL_COOLDOWN_24H' using errcode='22023';end if;
 update public.ig_mp_players set chips=chips+500
 where game='craps' and user_id=p_actor
 returning * into v_player;
 insert into public.ig_mp_practice_refills(game,user_id,request_id,amount,chips_before,chips_after)
 values('craps',p_actor,p_request,500,v_player.chips-500,v_player.chips) returning * into v_new;
 return jsonb_build_object('replayed',false,'amount',500,'balanceAfter',v_new.chips_after,
  'practiceOnly',true,'redeemable',false,'nextEligibleAt',v_new.granted_at+interval '24 hours');
end $$;
revoke all on function public.ig_mp_craps_refill(uuid,uuid) from public,anon,authenticated;
grant execute on function public.ig_mp_craps_refill(uuid,uuid) to service_role;


