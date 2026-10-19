-- Staging-only; apply once to a fresh project.
create table if not exists public.ign_accounts(user_id uuid primary key references auth.users(id) on delete cascade,available numeric(28,8) not null default 0 check(available>=0),staked numeric(28,8) not null default 0 check(staked>=0),claimable numeric(28,8) not null default 0 check(claimable>=0),total_claimed numeric(28,8) not null default 0 check(total_claimed>=0),auto_stake boolean not null default false,demo_granted boolean not null default false,updated_at timestamptz not null default now());
create table if not exists public.ign_entries(id bigint generated always as identity primary key,user_id uuid not null references auth.users(id) on delete cascade,operation_id uuid not null,kind text not null check(kind in ('demo_grant','stake','unstake','claim','reward','auto_stake')),amount numeric(28,8) not null check(amount>=0),available_after numeric(28,8) not null,staked_after numeric(28,8) not null,claimable_after numeric(28,8) not null,created_at timestamptz not null default now(),unique(user_id,operation_id));
create index if not exists ign_entries_owner_time on public.ign_entries(user_id,created_at desc);
create table if not exists public.ign_settings(singleton boolean primary key default true check(singleton),max_supply numeric(28,8) not null default 1000000000,demo_grant numeric(28,8) not null default 1000,hourly_rewards_enabled boolean not null default false,onchain_enabled boolean not null default false,updated_at timestamptz not null default now());
insert into public.ign_settings(singleton) values(true) on conflict do nothing;
alter table public.ign_accounts enable row level security;
alter table public.ign_entries enable row level security;
alter table public.ign_settings enable row level security;
revoke all on public.ign_accounts,public.ign_entries,public.ign_settings from anon,authenticated;
grant select on public.ign_accounts,public.ign_entries,public.ign_settings to authenticated;
create policy ign_account_owner_select on public.ign_accounts for select to authenticated using(user_id=(select auth.uid()));
create policy ign_entry_owner_select on public.ign_entries for select to authenticated using(user_id=(select auth.uid()));
create policy ign_settings_read on public.ign_settings for select to authenticated using(true);
CREATE OR REPLACE FUNCTION public.ign_action(p_action text, p_amount numeric DEFAULT NULL::numeric, p_operation_id uuid DEFAULT NULL::uuid, p_auto_stake boolean DEFAULT NULL::boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_user uuid := auth.uid(); v_account public.ign_accounts%rowtype; v_kind text; v_amount numeric(28,8); v_result jsonb;
begin
 if v_user is null then raise exception 'authentication required' using errcode='28000'; end if;
 if not exists (select 1 from public.profiles where id=v_user and is_excluded=false) then
  raise exception 'account unavailable' using errcode='42501';
 end if;
 if p_action not in ('demo_grant','stake','unstake','claim','auto_stake') then raise exception 'invalid operation'; end if;
 if p_action in ('stake','unstake') and (p_amount is null or p_amount<=0 or p_amount>1000000000 or p_amount<>trunc(p_amount,8)) then
   raise exception 'invalid amount';
 end if;
 if p_operation_id is null then raise exception 'operation id required'; end if;
 insert into public.ign_accounts(user_id) values (v_user) on conflict do nothing;
 select * into v_account from public.ign_accounts where user_id=v_user for update;
 if exists(select 1 from public.ign_entries where user_id=v_user and operation_id=p_operation_id) then
   return jsonb_build_object('status','duplicate','available',v_account.available,'staked',v_account.staked,'claimable',v_account.claimable,'auto_stake',v_account.auto_stake);
 end if;
 v_kind:=p_action; v_amount:=0;
 if p_action='demo_grant' then
   if v_account.demo_granted then raise exception 'demo grant already used'; end if;
   select demo_grant into v_amount from public.ign_settings where singleton=true;
   v_account.available:=v_account.available+v_amount;v_account.demo_granted:=true;
 elsif p_action='stake' then
   v_amount:=p_amount;
   if v_account.available<v_amount then raise exception 'insufficient demo IGN'; end if;
   v_account.available:=v_account.available-v_amount;v_account.staked:=v_account.staked+v_amount;
 elsif p_action='unstake' then
   v_amount:=p_amount;
   if v_account.staked<v_amount then raise exception 'insufficient stake'; end if;
   v_account.staked:=v_account.staked-v_amount;v_account.available:=v_account.available+v_amount;
 elsif p_action='claim' then
   v_amount:=v_account.claimable;
   v_account.claimable:=0;v_account.total_claimed:=v_account.total_claimed+v_amount;
   if v_account.auto_stake then v_account.staked:=v_account.staked+v_amount; else v_account.available:=v_account.available+v_amount; end if;
 elsif p_action='auto_stake' then
   if p_auto_stake is null then raise exception 'boolean required';end if;
   v_account.auto_stake:=p_auto_stake;
 end if;
 update public.ign_accounts set available=v_account.available,staked=v_account.staked,claimable=v_account.claimable,total_claimed=v_account.total_claimed,auto_stake=v_account.auto_stake,demo_granted=v_account.demo_granted,updated_at=now() where user_id=v_user;
 insert into public.ign_entries(user_id,operation_id,kind,amount,available_after,staked_after,claimable_after) values(v_user,p_operation_id,v_kind,v_amount,v_account.available,v_account.staked,v_account.claimable);
 return jsonb_build_object('status','ok','available',v_account.available,'staked',v_account.staked,'claimable',v_account.claimable,'auto_stake',v_account.auto_stake,'total_claimed',v_account.total_claimed);
end $function$
;
revoke all on function public.ign_action(text,numeric,uuid,boolean) from public,anon;
grant execute on function public.ign_action(text,numeric,uuid,boolean) to authenticated;
