-- Payment preparation is separate from financial settlement. No funds are moved,
-- reserved, promised or credited by a request; provider execution is not enabled.
create table public.payment_preparation_requests (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),
 request_id uuid not null,kind text not null check(kind in ('deposit','withdrawal')),
 asset text not null check(asset in ('BTC','ETH','USDC','USDT','SOL')),
 network text not null check(length(network) between 2 and 40),
 amount numeric(30,8) not null check(amount>0 and amount<=1000000),
 destination text check(destination is null or length(destination) between 8 and 256),
 status text not null default 'awaiting_provider' check(status in ('awaiting_provider','cancelled')),
 created_at timestamptz not null default now(),unique(user_id,request_id),
 check(kind<>'withdrawal' or destination is not null)
);
alter table public.payment_preparation_requests enable row level security;
revoke all on public.payment_preparation_requests from public,anon,authenticated;
grant select on public.payment_preparation_requests to authenticated;
grant all on public.payment_preparation_requests to service_role;
create policy payment_preparation_own_read on public.payment_preparation_requests for select to authenticated using(user_id=auth.uid());
create or replace function public.payment_prepare(p_user uuid,p_request uuid,p_kind text,p_asset text,p_network text,p_amount numeric,p_destination text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare prior public.payment_preparation_requests%rowtype;result public.payment_preparation_requests%rowtype;
begin
 if p_user is null or p_request is null or p_kind is null or p_asset is null or p_network is null or p_amount is null or
    p_amount<=0 or p_amount>1000000 or p_amount<>trunc(p_amount,8) or
    not exists(select 1 from public.profiles p join public.user_roles r on r.user_id=p.id where p.id=p_user and not p.is_excluded and r.role='player') then
  raise exception 'Account or request ineligible' using errcode='42501';end if;
 if not ((p_asset='BTC' and p_network='bitcoin') or (p_asset in ('ETH','USDC','USDT') and p_network='ethereum') or
         (p_asset in ('SOL','USDC','USDT') and p_network='solana')) then
  raise exception 'Unsupported asset and network' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_user::text)::bigint);
 select * into prior from public.payment_preparation_requests where user_id=p_user and request_id=p_request;
 if found then
  if prior.kind is distinct from p_kind or prior.asset is distinct from p_asset or prior.network is distinct from p_network or
     prior.amount is distinct from p_amount or prior.destination is distinct from p_destination then
   raise exception 'Request ID conflict' using errcode='23505';end if;
  return to_jsonb(prior);end if;
 if (select count(*) from public.payment_preparation_requests where user_id=p_user and status='awaiting_provider')>=10 then
  raise exception 'Too many pending requests' using errcode='22023';end if;
 insert into public.payment_preparation_requests(user_id,request_id,kind,asset,network,amount,destination)
 values(p_user,p_request,p_kind,p_asset,p_network,p_amount,p_destination) returning * into result;
 return to_jsonb(result);
end $$;
revoke all on function public.payment_prepare(uuid,uuid,text,text,text,numeric,text) from public,anon,authenticated;
grant execute on function public.payment_prepare(uuid,uuid,text,text,text,numeric,text) to service_role;
