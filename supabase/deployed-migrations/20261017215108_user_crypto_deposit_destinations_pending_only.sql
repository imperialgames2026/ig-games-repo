-- Staging-only deposit destination assignment model.
-- IMPORTANT: no wallet generation, no custody addresses, no deposit acceptance.
-- Each authenticated user will eventually have a unique attributed destination
-- per network. Network address + tag/memo attribution is never shared accidentally.
create table if not exists public.user_crypto_deposit_destinations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  network_id text not null references public.crypto_deposit_networks(network_id),
  attribution_method text not null check (attribution_method in (
    'dedicated_address','unique_destination_tag','dedicated_subaddress'
  )),
  deposit_address text,
  destination_tag text,
  custody_provider_ref text,
  assignment_status text not null default 'pending'
    check (assignment_status = 'pending'),
  provider_verified boolean not null default false
    check (provider_verified = false),
  enabled boolean not null default false
    check (enabled = false),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id,network_id),
  -- Hard safety gate until independent custody is integrated and audited.
  check (deposit_address is null and destination_tag is null and custody_provider_ref is null),
  check (
    (network_id in ('monero','zephyr') and attribution_method = 'dedicated_subaddress')
    or (network_id = 'xrpl' and attribution_method in ('dedicated_address','unique_destination_tag'))
    or (network_id not in ('monero','zephyr','xrpl') and attribution_method = 'dedicated_address')
  )
);
alter table public.user_crypto_deposit_destinations enable row level security;
revoke all on public.user_crypto_deposit_destinations from public, anon, authenticated;
grant select on public.user_crypto_deposit_destinations to authenticated;
drop policy if exists "crypto destination own read" on public.user_crypto_deposit_destinations;
create policy "crypto destination own read"
  on public.user_crypto_deposit_destinations
  for select to authenticated
  using (user_id = (select auth.uid()));
-- These indexes become critical once staging's null-address constraint is
-- replaced in a separately reviewed release. XRPL shared custody addresses
-- may differentiate users by tag; other chains must have distinct destinations.
create unique index if not exists user_deposit_route_exclusive_address_idx
  on public.user_crypto_deposit_destinations(network_id,deposit_address)
  where deposit_address is not null and network_id <> 'xrpl';
create unique index if not exists user_deposit_route_xrpl_address_tag_idx
  on public.user_crypto_deposit_destinations(network_id,deposit_address,destination_tag)
  where network_id = 'xrpl' and deposit_address is not null and destination_tag is not null;
create unique index if not exists user_deposit_route_xrpl_untagged_idx
  on public.user_crypto_deposit_destinations(network_id,deposit_address)
  where network_id = 'xrpl' and deposit_address is not null and destination_tag is null;
comment on table public.user_crypto_deposit_destinations is
'Future account-specific deposit destinations, currently pending and addressless. Owner-read only. NEVER send cryptocurrency until custody activation and monitoring are verified. No keys stored.';


