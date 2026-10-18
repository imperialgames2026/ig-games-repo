create schema if not exists internal;
create or replace function internal.admin_mutation(p_actor uuid,p_target uuid,p_action text,p_reason text,p_request uuid,p_currency text default null,p_delta numeric default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.profiles%rowtype; t public.profiles%rowtype; old_balance numeric; new_balance numeric; existing public.admin_action_audit%rowtype; result jsonb;
begin
 if p_actor is null or p_target is null or p_request is null or length(btrim(coalesce(p_reason,''))) not between 8 and 2000 then raise exception 'invalid request' using errcode='22023'; end if;
 if p_action not in ('exclude','restore','wallet_adjustment') then raise exception 'invalid action' using errcode='22023'; end if;
 select * into a from public.profiles where id=p_actor for update;
 if not found or a.is_excluded or a.role not in ('admin','superadmin') then raise exception 'unauthorized' using errcode='42501'; end if;
 select * into t from public.profiles where id=p_target for update;
 if not found then raise exception 'target not found' using errcode='22023'; end if;
 if p_actor=p_target or (a.role='admin' and t.role in ('admin','superadmin')) or (a.role='superadmin' and t.role='superadmin') then raise exception 'protected target' using errcode='42501'; end if;
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
  if a.role<>'superadmin' then raise exception 'superadmin required for balance changes' using errcode='42501'; end if;
  if p_currency<>'IGT' or p_delta is null or p_delta=0 or abs(p_delta)>10000 or p_delta<>round(p_delta,6) then
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
end $$;
revoke all on function internal.admin_mutation(uuid,uuid,text,text,uuid,text,numeric) from public,anon,authenticated;
grant usage on schema internal to service_role;
grant execute on function internal.admin_mutation(uuid,uuid,text,text,uuid,text,numeric) to service_role;
