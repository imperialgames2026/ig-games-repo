-- Server-authoritative, service-role-only wallet transfer and dice settlement.
-- Not deployed automatically. Review and apply in a controlled migration.
create table if not exists public.secure_operation_receipts (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id),
  operation_id uuid not null,
  kind text not null check (kind in ('transfer','dice')),
  request_fingerprint text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  unique(actor_id,operation_id)
);
alter table public.secure_operation_receipts enable row level security;
revoke all on public.secure_operation_receipts from anon, authenticated, public;
revoke all on public.secure_operation_receipts from service_role;
grant select, insert on public.secure_operation_receipts to service_role;

create or replace function public.secure_wallet_operation(
  p_actor uuid, p_operation uuid, p_kind text, p_amount numeric,
  p_target uuid default null, p_guess integer default null
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_fingerprint text;
  v_existing public.secure_operation_receipts%rowtype;
  v_actor public.profiles%rowtype;
  v_target public.profiles%rowtype;
  v_balance numeric;
  v_target_balance numeric;
  v_roll integer;
  v_byte integer;
  v_win numeric;
  v_result jsonb;
begin
  if auth.role() <> 'service_role' then raise exception 'service role required' using errcode='42501'; end if;
  if p_actor is null or p_operation is null or p_kind not in ('transfer','dice')
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
  select * into v_existing from public.secure_operation_receipts
    where actor_id=p_actor and operation_id=p_operation;
  if found then
    if v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'idempotency key reused with different arguments' using errcode='23505';
    end if;
    return v_existing.result;
  end if;
  select * into v_actor from public.profiles where id=p_actor;
  if not found or v_actor.role <> 'player' or v_actor.is_excluded then
    raise exception 'account ineligible' using errcode='42501';
  end if;
  if p_kind='transfer' then
    select * into v_target from public.profiles where id=p_target;
    if not found or v_target.role <> 'player' or v_target.is_excluded then
      raise exception 'recipient ineligible' using errcode='42501';
    end if;
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
$$;
revoke all on function public.secure_wallet_operation(uuid,uuid,text,numeric,uuid,integer) from public,anon,authenticated;
grant execute on function public.secure_wallet_operation(uuid,uuid,text,numeric,uuid,integer) to service_role;
