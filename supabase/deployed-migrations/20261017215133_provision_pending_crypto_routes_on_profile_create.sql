-- Create private per-account/per-network PENDING destination assignments.
-- Does not create addresses or enable receipt of any tokens.
create or replace function public.provision_pending_crypto_deposit_destinations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_crypto_deposit_destinations
    (user_id,network_id,attribution_method)
  select new.id, n.network_id,
    case when n.network_id in ('monero','zephyr') then 'dedicated_subaddress'
         else 'dedicated_address' end
  from public.crypto_deposit_networks as n
  on conflict (user_id,network_id) do nothing;
  return new;
end;
$$;
revoke all on function public.provision_pending_crypto_deposit_destinations()
 from public,anon,authenticated;
drop trigger if exists profile_pending_crypto_destinations on public.profiles;
create trigger profile_pending_crypto_destinations
  after insert on public.profiles
  for each row execute function public.provision_pending_crypto_deposit_destinations();

-- Backfill the existing staging profiles. All destination values remain NULL.
insert into public.user_crypto_deposit_destinations
  (user_id,network_id,attribution_method)
select p.id, n.network_id,
  case when n.network_id in ('monero','zephyr') then 'dedicated_subaddress'
       else 'dedicated_address' end
from public.profiles p
cross join public.crypto_deposit_networks n
on conflict (user_id,network_id) do nothing;

comment on function public.provision_pending_crypto_deposit_destinations() is
'Account-specific PENDING deposit records only. No wallet derivation, private keys, destination tag assignment, blockchain activity, or enabled deposits.';


