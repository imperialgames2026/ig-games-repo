-- Imperial Games security hardening and server-authoritative settlement foundation.
-- Apply after 20260905_initial_schema.sql.

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin'::public.user_role, 'superadmin'::public.user_role)); $$;

create or replace function public.is_superadmin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'superadmin'::public.user_role); $$;

drop policy if exists "profiles own update" on public.profiles;
create policy "profiles own safe update" on public.profiles for update using (auth.uid() = id)
with check (auth.uid() = id and role = (select p.role from public.profiles p where p.id = auth.uid()) and is_excluded = (select p.is_excluded from public.profiles p where p.id = auth.uid()) and kyc_status = (select p.kyc_status from public.profiles p where p.id = auth.uid()));
create policy "profiles admin read" on public.profiles for select using (auth.uid() = id or public.is_admin());
create policy "profiles admin update" on public.profiles for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "wallet own read" on public.wallets;
create policy "wallet own read" on public.wallets for select using (auth.uid() = user_id or public.is_admin());
drop policy if exists "transactions own read" on public.transactions;
create policy "transactions own read" on public.transactions for select using (auth.uid() = user_id or public.is_admin());
drop policy if exists "weekly wagers own read" on public.weekly_wagers;
create policy "weekly wagers own read" on public.weekly_wagers for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists "withdrawals own create" on public.withdrawal_requests;
create policy "withdrawals own create" on public.withdrawal_requests for insert with check (auth.uid() = user_id and status = 'pending'::public.withdrawal_status and admin_note is null and audit_flag = false and audit_reason is null and reviewed_at is null);
create policy "withdrawals admin update" on public.withdrawal_requests for update using (public.is_admin()) with check (public.is_admin());
create policy "withdrawals admin read" on public.withdrawal_requests for select using (auth.uid() = user_id or public.is_admin());

create table if not exists public.game_rounds (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete restrict,
  game_slug text not null, currency text not null, wager_amount numeric(30,8) not null check (wager_amount >= 0),
  payout_amount numeric(30,8) not null default 0 check (payout_amount >= 0), house_edge_amount numeric(30,8) not null default 0,
  status text not null default 'settled', client_request_id text, outcome jsonb, created_at timestamptz not null default now(), settled_at timestamptz,
  unique (user_id, client_request_id)
);
create index if not exists game_rounds_user_created_idx on public.game_rounds(user_id, created_at desc);
create index if not exists game_rounds_game_created_idx on public.game_rounds(game_slug, created_at desc);
alter table public.game_rounds enable row level security;
create policy "game rounds own read" on public.game_rounds for select using (auth.uid() = user_id or public.is_admin());

create table if not exists public.house_edge_events (
  id uuid primary key default gen_random_uuid(), game_round_id uuid not null references public.game_rounds(id) on delete restrict,
  hour_start timestamptz not null, currency text not null, house_edge_amount numeric(30,8) not null check (house_edge_amount >= 0),
  created_at timestamptz not null default now(), unique (game_round_id)
);
create index if not exists house_edge_events_hour_idx on public.house_edge_events(hour_start, currency);
alter table public.house_edge_events enable row level security;
create policy "house edge admin read" on public.house_edge_events for select using (public.is_admin());

create table if not exists public.reward_policy (
  id boolean primary key default true check (id), house_edge_reward_bps integer not null default 200 check (house_edge_reward_bps between 0 and 10000),
  effective_at timestamptz not null default now(), version bigint not null default 1, updated_by uuid references auth.users(id), updated_at timestamptz not null default now()
);
insert into public.reward_policy (id) values (true) on conflict (id) do nothing;
alter table public.reward_policy enable row level security;
create policy "reward policy authenticated read" on public.reward_policy for select using (auth.uid() is not null);
create policy "reward policy admin update" on public.reward_policy for update using (public.is_admin()) with check (public.is_admin());

create table if not exists public.staking_reward_distributions (
  id uuid primary key default gen_random_uuid(), hour_start timestamptz not null unique,
  eligible_stake numeric(30,8) not null default 0, eligible_house_edge numeric(30,8) not null default 0,
  reward_bps integer not null, reward_pool numeric(30,8) not null default 0, distributed_amount numeric(30,8) not null default 0,
  dust_amount numeric(30,8) not null default 0, status text not null default 'pending', created_at timestamptz not null default now(), settled_at timestamptz
);
alter table public.staking_reward_distributions enable row level security;
create policy "staking distribution admin read" on public.staking_reward_distributions for select using (public.is_admin());

-- Transitional storage for non-core entities while they are converted to dedicated tables.
create table if not exists public.app_records (
  id uuid primary key default gen_random_uuid(), entity text not null, owner_user_id uuid references auth.users(id) on delete cascade,
  owner_email text, data jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists app_records_entity_idx on public.app_records(entity, created_at desc);
create index if not exists app_records_owner_idx on public.app_records(owner_user_id, entity, created_at desc);
alter table public.app_records enable row level security;
create policy "app records read own" on public.app_records for select using (owner_user_id = auth.uid() or owner_user_id is null or public.is_admin());
create policy "app records create own" on public.app_records for insert with check (owner_user_id = auth.uid());
create policy "app records update own" on public.app_records for update using (owner_user_id = auth.uid() or public.is_admin()) with check (owner_user_id = auth.uid() or public.is_admin());
create policy "app records delete own" on public.app_records for delete using (owner_user_id = auth.uid() or public.is_admin());

create trigger app_records_updated_at before update on public.app_records for each row execute procedure public.set_updated_at();
