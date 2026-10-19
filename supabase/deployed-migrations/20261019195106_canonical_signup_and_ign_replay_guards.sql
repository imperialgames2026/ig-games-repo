-- Canonical signup role and exact replay protection for nonredeemable IGN simulation.
-- No existing privileged role is changed; user metadata cannot grant privileges.
create schema if not exists ig_internal;
revoke all on schema ig_internal from public,anon,authenticated;
create or replace function ig_internal.bootstrap_player_role()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.user_roles(user_id,role) values(new.id,'player') on conflict(user_id) do nothing;
 return new;
end $$;
revoke all on function ig_internal.bootstrap_player_role() from public,anon,authenticated;
drop trigger if exists on_auth_user_created_player_role on auth.users;
create trigger on_auth_user_created_player_role after insert on auth.users
for each row execute function ig_internal.bootstrap_player_role();
insert into public.user_roles(user_id,role)
select p.id,'player' from public.profiles p
where not exists(select 1 from public.user_roles r where r.user_id=p.id)
on conflict(user_id) do nothing;
alter table public.ign_entries add column if not exists request_payload jsonb;
alter table public.ign_entries add column if not exists response jsonb;
create or replace function public.ign_action(p_action text,p_amount numeric default null,p_operation_id uuid default null,p_auto_stake boolean default null)
returns jsonb language plpgsql security definer set search_path = public,pg_temp as $$
declare v_user uuid := auth.uid(); v_account public.ign_accounts%rowtype; v_kind text; v_amount numeric(28,8); v_result jsonb; v_payload jsonb; v_receipt public.ign_entries%rowtype;
begin
 if v_user is null then raise exception 'authentication required' using errcode='28000'; end if;
 if not exists (select 1 from public.profiles where id=v_user and is_excluded=false) then
  raise exception 'account unavailable' using errcode='42501';
 end if;
 if coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or not exists (select 1 from public.user_roles where user_id=v_user and role in ('player','admin','superadmin')) then
  raise exception 'Read-only or unverified account' using errcode='42501';
 end if;
 if p_action is null or p_action not in ('demo_grant','stake','unstake','claim','auto_stake') then raise exception 'invalid operation'; end if;
 if p_action in ('stake','unstake') and (p_amount is null or p_amount<=0 or p_amount>1000000000 or p_amount<>trunc(p_amount,8)) then
   raise exception 'invalid amount';
 end if;
 if p_action not in ('stake','unstake') and p_amount is not null then raise exception 'Unexpected amount' using errcode='22023'; end if;
 if p_action <> 'auto_stake' and p_auto_stake is not null then raise exception 'Unexpected auto-stake flag' using errcode='22023'; end if;
 v_payload:=jsonb_build_object('action',p_action,'amount',p_amount,'auto_stake',p_auto_stake);
 if p_operation_id is null then raise exception 'operation id required'; end if;
 insert into public.ign_accounts(user_id) values (v_user) on conflict do nothing;
 select * into v_account from public.ign_accounts where user_id=v_user for update;
 select * into v_receipt from public.ign_entries where user_id=v_user and operation_id=p_operation_id;
 if found then
  if v_receipt.request_payload is distinct from v_payload or v_receipt.response is null then
   raise exception 'Idempotency key conflicts with original request' using errcode='22023';
  end if;
  return v_receipt.response;
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
 v_result:=jsonb_build_object('status','ok','available',v_account.available,'staked',v_account.staked,'claimable',v_account.claimable,'auto_stake',v_account.auto_stake,'total_claimed',v_account.total_claimed);
 update public.ign_accounts set available=v_account.available,staked=v_account.staked,claimable=v_account.claimable,total_claimed=v_account.total_claimed,auto_stake=v_account.auto_stake,demo_granted=v_account.demo_granted,updated_at=now() where user_id=v_user;
 insert into public.ign_entries(user_id,operation_id,kind,amount,available_after,staked_after,claimable_after,request_payload,response) values(v_user,p_operation_id,v_kind,v_amount,v_account.available,v_account.staked,v_account.claimable,v_payload,v_result);
 return v_result;
end $$;
revoke all on function public.ign_action(text,numeric,uuid,boolean) from public,anon;
grant execute on function public.ign_action(text,numeric,uuid,boolean) to authenticated;


