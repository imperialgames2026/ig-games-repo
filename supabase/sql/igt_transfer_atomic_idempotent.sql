create table if not exists public.wallet_transfers (
 id uuid primary key default gen_random_uuid(),
 sender_id uuid not null references auth.users(id),
 recipient_id uuid not null references auth.users(id),
 currency text not null check (currency in ('IGT')),
 amount numeric(24,6) not null check (amount > 0),
 request_id uuid not null,
 created_at timestamptz not null default now(),
 unique(sender_id,request_id),
 check(sender_id <> recipient_id)
);
alter table public.wallet_transfers enable row level security;
revoke all on public.wallet_transfers from anon,authenticated;
grant select on public.wallet_transfers to authenticated;
create policy "participants view transfers" on public.wallet_transfers for select to authenticated using (sender_id=(select auth.uid()) or recipient_id=(select auth.uid()));
create or replace function public.transfer_igt(p_recipient uuid,p_amount numeric,p_request_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_sender uuid := auth.uid(); v_id uuid; v_balance numeric; v_existing public.wallet_transfers%rowtype;
begin
 if v_sender is null then raise exception 'Authentication required'; end if;
 if p_recipient is null or p_recipient=v_sender or p_amount is null or p_amount<=0 or p_amount>1000000 or scale(p_amount)>6 or p_request_id is null then raise exception 'Invalid transfer'; end if;
 if not exists(select 1 from public.profiles where id=v_sender and is_excluded=false) or not exists(select 1 from public.profiles where id=p_recipient and is_excluded=false) then raise exception 'Account unavailable'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_sender::text||':'||p_request_id::text,0));
 select * into v_existing from public.wallet_transfers where sender_id=v_sender and request_id=p_request_id;
 if found then
  if v_existing.recipient_id<>p_recipient or v_existing.amount<>p_amount or v_existing.currency<>'IGT' then raise exception 'Idempotency key conflict'; end if;
  return v_existing.id;
 end if;
 perform 1 from public.wallets where user_id in (v_sender,p_recipient) order by user_id for update;
 if (select count(*) from public.wallets where user_id in (v_sender,p_recipient))<>2 then raise exception 'Wallet unavailable'; end if;
 select igt_balance into v_balance from public.wallets where user_id=v_sender;
 if v_balance<p_amount then raise exception 'Insufficient funds'; end if;
 update public.wallets set igt_balance=igt_balance-p_amount,updated_at=now() where user_id=v_sender;
 update public.wallets set igt_balance=igt_balance+p_amount,updated_at=now() where user_id=p_recipient;
 insert into public.wallet_transfers(sender_id,recipient_id,currency,amount,request_id) values(v_sender,p_recipient,'IGT',p_amount,p_request_id) returning id into v_id;
 return v_id;
end $$;
revoke all on function public.transfer_igt(uuid,numeric,uuid) from public,anon;
grant execute on function public.transfer_igt(uuid,numeric,uuid) to authenticated;