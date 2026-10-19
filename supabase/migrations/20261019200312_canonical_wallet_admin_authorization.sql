-- Canonical permissions for RLS and server-only wallet/admin operations.
-- Existing currency, balances and receipts remain unchanged.
create or replace function internal.current_admin_role()
returns text language sql stable security definer set search_path = ''
as $$
 select ur.role from public.user_roles ur join public.profiles pr on pr.id=ur.user_id
 where ur.user_id=(select auth.uid()) and pr.is_excluded=false
 and coalesce((select auth.jwt()->>'is_anonymous'),'false')='false'
 and ur.role in ('admin','superadmin')
$$;
revoke all on function internal.current_admin_role() from public,anon;
grant usage on schema internal to authenticated;
grant execute on function internal.current_admin_role() to authenticated,service_role;

create or replace function public.is_admin()
returns boolean language sql stable security invoker set search_path = ''
as $$ select internal.current_admin_role() is not null $$;
create or replace function public.is_admin_or_superadmin()
returns boolean language sql stable security invoker set search_path = ''
as $$ select internal.current_admin_role() is not null $$;
create or replace function public.is_superadmin()
returns boolean language sql stable security invoker set search_path = ''
as $$ select coalesce(internal.current_admin_role()='superadmin',false) $$;
revoke all on function public.is_admin(),public.is_admin_or_superadmin(),public.is_superadmin() from public,anon;
grant execute on function public.is_admin(),public.is_admin_or_superadmin(),public.is_superadmin() to authenticated,service_role;

CREATE OR REPLACE FUNCTION public.secure_wallet_operation(p_actor uuid, p_operation uuid, p_kind text, p_amount numeric, p_target uuid DEFAULT NULL::uuid, p_guess integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_fingerprint text;
  v_existing public.secure_operation_receipts%rowtype;
  v_actor public.profiles%rowtype;
  v_target public.profiles%rowtype;
  v_actor_role text;
  v_target_role text;
  v_balance numeric;
  v_target_balance numeric;
  v_roll integer;
  v_byte integer;
  v_win numeric;
  v_result jsonb;
begin
  if (select auth.jwt()->>'role') is distinct from 'service_role' then raise exception 'service role required' using errcode='42501'; end if;
  if p_actor is null or p_operation is null or (p_kind is null or p_kind not in ('transfer','dice'))
     or p_amount is null or p_amount <= 0 or p_amount > 10000
     or p_amount <> trunc(p_amount, 2) then
    raise exception 'invalid operation' using errcode='22023';
  end if;
  if (p_kind = 'transfer' and (p_target is null or p_target = p_actor or p_guess is not null))
     or (p_kind = 'dice' and (p_target is not null or (p_guess is null or p_guess not between 1 and 6))) then
    raise exception 'invalid operation arguments' using errcode='22023';
  end if;
  v_fingerprint := encode(extensions.digest(
    concat_ws('|',p_actor::text,p_kind,p_amount::text,coalesce(p_target::text,''),
      coalesce(p_guess::text,'')), 'sha256'), 'hex');
  -- Serialize retries for the same actor + operation, even across concurrent requests.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor::text || ':' || p_operation::text, 0));
  -- Lock eligibility in the same transaction as settlement, in UUID order.
  perform 1 from public.profiles where id in (p_actor,p_target) order by id for share;
  perform 1 from public.user_roles where user_id in (p_actor,p_target) order by user_id for share;
  select * into v_actor from public.profiles where id=p_actor;
  select role into v_actor_role from public.user_roles where user_id=p_actor;
  if v_actor.id is null or v_actor.is_excluded is distinct from false or v_actor_role is distinct from 'player' then
    raise exception 'account ineligible' using errcode='42501';
  end if;
  if p_kind='transfer' then
    select * into v_target from public.profiles where id=p_target;
    select role into v_target_role from public.user_roles where user_id=p_target;
    if v_target.id is null or v_target.is_excluded is distinct from false or v_target_role is distinct from 'player' then
      raise exception 'recipient ineligible' using errcode='42501';
    end if;
  end if;
  select * into v_existing from public.secure_operation_receipts
    where actor_id=p_actor and operation_id=p_operation;
  if found then
    if v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'idempotency key reused with different arguments' using errcode='23505';
    end if;
    return v_existing.result;
  end if;
  -- All transfers lock wallet rows in deterministic UUID order to avoid deadlocks.
  if p_kind='transfer' then
    perform 1 from public.wallets where user_id in (p_actor,p_target) order by user_id for update;
    if (select count(*) from public.wallets where user_id in (p_actor,p_target)) <> 2 then
      raise exception 'wallet missing' using errcode='22023';
    end if;
  else
    perform 1 from public.wallets where user_id=p_actor for update;
  end if;
  select igt_balance into v_balance from public.wallets where user_id=p_actor;
  if v_balance is null or v_balance < p_amount then
    raise exception 'insufficient balance' using errcode='22023';
  end if;
  if p_kind='transfer' then
    update public.wallets set igt_balance=igt_balance-p_amount where user_id=p_actor;
    update public.wallets set igt_balance=igt_balance+p_amount where user_id=p_target
      returning igt_balance into v_target_balance;
    insert into public.transactions(user_id,type,currency,igt_amount,status,description,reference_id)
      values (p_actor,'loss','IGT',-p_amount,'completed','Peer transfer sent',p_operation::text),
             (p_target,'bonus','IGT',p_amount,'completed','Peer transfer received',p_operation::text);
    v_result := pg_catalog.jsonb_build_object('operation_id',p_operation,'kind','transfer','amount',p_amount,'balance',v_balance-p_amount,'recipient_balance',v_target_balance);
  else
    -- Uniform server-side six-sided die. Browser cannot supply the outcome.
    loop
      v_byte := pg_catalog.get_byte(extensions.gen_random_bytes(1),0);
      exit when v_byte < 252;
    end loop;
    v_roll := (v_byte % 6) + 1;
    v_win := case when v_roll=p_guess then p_amount*5 else 0 end;
    update public.wallets set igt_balance=igt_balance-p_amount+v_win
      where user_id=p_actor;
    insert into public.game_rounds(user_id,game_slug,currency,bet_amount,win_amount,status,outcome)
      values(p_actor,'secure-dice','IGT',p_amount,v_win,'settled',
        pg_catalog.jsonb_build_object('roll',v_roll,'guess',p_guess,'operation_id',p_operation));
    insert into public.transactions(user_id,type,currency,igt_amount,status,game_slug,reference_id)
      values(p_actor,'loss','IGT',-p_amount,'completed','secure-dice',p_operation::text);
    if v_win > 0 then
      insert into public.transactions(user_id,type,currency,igt_amount,status,game_slug,reference_id)
        values(p_actor,'win','IGT',v_win,'completed','secure-dice',p_operation::text);
    end if;
    v_result := pg_catalog.jsonb_build_object('operation_id',p_operation,'kind','dice','roll',v_roll,'guess',p_guess,'win',v_win,'balance',v_balance-p_amount+v_win);
  end if;
  insert into public.secure_operation_receipts(actor_id,operation_id,kind,request_fingerprint,result)
    values(p_actor,p_operation,p_kind,v_fingerprint,v_result);
  return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION internal.admin_mutation(p_actor uuid, p_target uuid, p_action text, p_reason text, p_request uuid, p_currency text DEFAULT NULL::text, p_delta numeric DEFAULT NULL::numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a public.profiles%rowtype; t public.profiles%rowtype; old_balance numeric; new_balance numeric; existing public.admin_action_audit%rowtype; result jsonb; actor_role text; target_role text;
begin
 if (select auth.jwt()->>'role') is distinct from 'service_role' then raise exception 'service role required' using errcode='42501'; end if;
 if p_actor is null or p_target is null or p_request is null or length(btrim(coalesce(p_reason,''))) not between 8 and 2000 then raise exception 'invalid request' using errcode='22023'; end if;
 if p_action is null or p_action not in ('exclude','restore','wallet_adjustment') then raise exception 'invalid action' using errcode='22023'; end if;
 -- All profile/role locks precede wallet locks, with deterministic row order.
 perform 1 from public.profiles where id in (p_actor,p_target) order by id for update;
 perform 1 from public.user_roles where user_id in (p_actor,p_target) order by user_id for share;
 select role into actor_role from public.user_roles where user_id=p_actor;
 select role into target_role from public.user_roles where user_id=p_target;
 select * into a from public.profiles where id=p_actor;
 if not found or a.is_excluded is distinct from false or actor_role is null or actor_role not in ('admin','superadmin') then raise exception 'unauthorized' using errcode='42501'; end if;
 select * into t from public.profiles where id=p_target;
 if not found or target_role is null or target_role not in ('player','tester','admin','superadmin') then raise exception 'target not found' using errcode='22023'; end if;
 if p_actor=p_target or (actor_role='admin' and target_role in ('admin','superadmin')) or (actor_role='superadmin' and target_role='superadmin') then raise exception 'protected target' using errcode='42501'; end if;
 select * into existing from public.admin_action_audit where request_id=p_request;
 if found then
  if existing.actor_id<>p_actor or existing.target_id<>p_target or existing.action<>p_action or existing.reason<>p_reason or
    (p_action='wallet_adjustment' and (existing.details->>'currency' is distinct from p_currency or (existing.details->>'delta')::numeric is distinct from p_delta)) then
   raise exception 'idempotency conflict' using errcode='23505';
  end if;
  return jsonb_build_object('audit_id',existing.id,'replayed',true,'details',existing.details);
 end if;
 if p_action in ('exclude','restore') then
  if p_currency is not null or p_delta is not null then raise exception 'unexpected balance fields' using errcode='22023'; end if;
  update public.profiles set is_excluded=(p_action='exclude'),updated_at=now() where id=p_target;
  result=jsonb_build_object('previous_excluded',t.is_excluded,'new_excluded',p_action='exclude');
 else
  if actor_role<>'superadmin' then raise exception 'superadmin required for balance changes' using errcode='42501'; end if;
  if p_currency is distinct from 'IGT' or p_delta is null or p_delta=0 or abs(p_delta)>10000 or p_delta<>round(p_delta,6) then
   raise exception 'only bounded IGT adjustments supported' using errcode='22023';
  end if;
  select igt_balance into old_balance from public.wallets where user_id=p_target for update;
  if not found or old_balance is null then raise exception 'wallet missing' using errcode='22023'; end if;
  new_balance:=old_balance+p_delta;
  if new_balance<0 then raise exception 'insufficient funds' using errcode='22023'; end if;
  update public.wallets set igt_balance=new_balance,updated_at=now() where user_id=p_target;
  result=jsonb_build_object('currency','IGT','delta',p_delta,'balance_before',old_balance,'balance_after',new_balance);
 end if;
 insert into public.admin_action_audit(actor_id,target_id,action,reason,request_id,details)
 values(p_actor,p_target,p_action,p_reason,p_request,result)
 returning id into existing.id;
 return jsonb_build_object('audit_id',existing.id,'replayed',false,'details',result);
end $function$;

revoke all on function public.secure_wallet_operation(uuid,uuid,text,numeric,uuid,integer) from public,anon,authenticated;
grant execute on function public.secure_wallet_operation(uuid,uuid,text,numeric,uuid,integer) to service_role;
revoke all on function internal.admin_mutation(uuid,uuid,text,text,uuid,text,numeric) from public,anon,authenticated;
grant execute on function internal.admin_mutation(uuid,uuid,text,text,uuid,text,numeric) to service_role;
