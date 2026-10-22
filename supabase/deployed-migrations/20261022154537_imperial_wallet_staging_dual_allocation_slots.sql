create schema if not exists ig_wallet_internal;
create table if not exists ig_wallet_internal.player_allocations (
 user_id uuid not null references public.profiles(id) on delete cascade,
 network_id text not null references public.crypto_deposit_networks(network_id),
 allocation_type text not null check (allocation_type in ('player','yield_vault')),
 status text not null default 'pending_custody' check (status in ('pending_custody','assigned','suspended')),
 address text,
 custody_reference text,
 created_at timestamptz not null default now(),
 primary key(user_id,network_id,allocation_type),
 constraint no_address_without_custody check ((address is null and custody_reference is null and status='pending_custody') or (address is not null and custody_reference is not null and status in ('assigned','suspended')))
);
alter table ig_wallet_internal.player_allocations enable row level security;
revoke all on schema ig_wallet_internal from public,anon,authenticated;
revoke all on ig_wallet_internal.player_allocations from public,anon,authenticated;
create or replace function ig_wallet_internal.provision_slots(p_user uuid)
returns integer language plpgsql security invoker set search_path='' as $$
declare added integer;
begin
 insert into ig_wallet_internal.player_allocations(user_id,network_id,allocation_type)
 select p_user,n.network_id,t.kind from public.crypto_deposit_networks n
 cross join (values ('player'),('yield_vault')) as t(kind)
 where exists (select 1 from public.profiles p where p.id=p_user)
 on conflict do nothing;
 get diagnostics added=row_count;
 return added;
end $$;
revoke all on function ig_wallet_internal.provision_slots(uuid) from public,anon,authenticated;
create or replace function ig_wallet_internal.on_profile_created()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform ig_wallet_internal.provision_slots(new.id);
 return new;
end $$;
revoke all on function ig_wallet_internal.on_profile_created() from public,anon,authenticated;
drop trigger if exists ig_wallet_provision_on_profile on public.profiles;
create trigger ig_wallet_provision_on_profile after insert on public.profiles for each row execute function ig_wallet_internal.on_profile_created();
select ig_wallet_internal.provision_slots(id) from public.profiles;
