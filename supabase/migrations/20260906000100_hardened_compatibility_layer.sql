alter table public.profiles add column if not exists legacy_data jsonb not null default '{}'::jsonb;
alter table public.wallets add column if not exists legacy_data jsonb not null default '{}'::jsonb;
alter table public.transactions add column if not exists legacy_data jsonb not null default '{}'::jsonb;
alter table public.weekly_wagers add column if not exists legacy_data jsonb not null default '{}'::jsonb;
alter table public.withdrawal_requests add column if not exists legacy_data jsonb not null default '{}'::jsonb;

create table if not exists public.app_records (id uuid primary key default gen_random_uuid(), entity text not null, owner_user_id uuid references auth.users(id) on delete cascade, owner_email text, data jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index if not exists app_records_entity_created_idx on public.app_records(entity, created_at desc);
create index if not exists app_records_owner_entity_idx on public.app_records(owner_user_id, entity, created_at desc);

create table if not exists public.idempotency_keys (key text primary key, operation text not null, user_id uuid references auth.users(id) on delete set null, response jsonb, created_at timestamptz not null default now(), expires_at timestamptz);
create table if not exists public.game_rounds (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete set null, game_slug text not null, currency text, bet_amount numeric(30,8) not null default 0, win_amount numeric(30,8) not null default 0, house_edge numeric(20,10) not null default 0, status text not null default 'settled', outcome jsonb not null default '{}'::jsonb, server_seed_hash text, server_seed text, client_seed text, round_number bigint, created_at timestamptz not null default now(), settled_at timestamptz);
create table if not exists public.staking_reward_cycles (cycle_start timestamptz primary key, cycle_end timestamptz not null, eligible_house_edge numeric(30,8) not null default 0, reward_rate numeric(12,8) not null default 0.02, reward_pool numeric(30,8) not null default 0, total_eligible_stake numeric(30,8) not null default 0, total_distributed numeric(30,8) not null default 0, status text not null default 'pending', created_at timestamptz not null default now(), settled_at timestamptz);

create or replace function public.is_admin_or_superadmin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('admin','superadmin')); $$;
create or replace function public.is_superadmin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='superadmin'); $$;

alter table public.app_records enable row level security;
alter table public.idempotency_keys enable row level security;
alter table public.game_rounds enable row level security;
alter table public.staking_reward_cycles enable row level security;
drop policy if exists app_records_owner_read on public.app_records;
create policy app_records_owner_read on public.app_records for select using (owner_user_id=auth.uid() or public.is_admin_or_superadmin());
create policy game_rounds_owner_read on public.game_rounds for select using (user_id=auth.uid() or public.is_admin_or_superadmin());
create policy staking_cycles_admin_read on public.staking_reward_cycles for select using (public.is_admin_or_superadmin());

create or replace function public.protect_profile_privileged_fields() returns trigger language plpgsql security definer set search_path=public as $$ begin if auth.role()<>'service_role' and auth.uid()=old.id then if new.role is distinct from old.role or new.is_excluded is distinct from old.is_excluded or new.kyc_status is distinct from old.kyc_status then raise exception 'Privileged profile fields can only be changed server-side'; end if; end if; return new; end; $$;
drop trigger if exists protect_profile_privileged_fields on public.profiles;
create trigger protect_profile_privileged_fields before update on public.profiles for each row execute procedure public.protect_profile_privileged_fields();
create or replace function public.set_app_records_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end; $$;
drop trigger if exists app_records_updated_at on public.app_records;
create trigger app_records_updated_at before update on public.app_records for each row execute procedure public.set_app_records_updated_at();

drop policy if exists wallet_own_update on public.wallets;
drop policy if exists wallet_own_insert on public.wallets;
drop policy if exists wallet_own_delete on public.wallets;
drop policy if exists transactions_own_insert on public.transactions;
drop policy if exists transactions_own_update on public.transactions;
drop policy if exists transactions_own_delete on public.transactions;

insert into storage.buckets (id,name,public) values ('profile-media','profile-media',true) on conflict (id) do nothing;
insert into storage.buckets (id,name,public) values ('kyc-documents','kyc-documents',false) on conflict (id) do nothing;
