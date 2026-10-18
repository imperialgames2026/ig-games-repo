-- Imperial Gaming: initial Supabase foundation
-- Financial/game mutations should be performed by Edge Functions or SECURITY DEFINER routines.

create extension if not exists pgcrypto;

create type public.user_role as enum ('player', 'tester', 'admin', 'superadmin');
create type public.transaction_type as enum ('purchase', 'win', 'loss', 'bonus', 'daily_reward', 'admin_credit', 'admin_debit', 'referral_bonus', 'referral_commission', 'weekly_bonus', 'rakeback', 'withdrawal');
create type public.transaction_status as enum ('pending', 'completed', 'failed', 'cancelled');
create type public.withdrawal_status as enum ('pending', 'approved', 'rejected', 'paid', 'cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  profile_picture text,
  role public.user_role not null default 'player',
  is_excluded boolean not null default false,
  kyc_status text not null default 'not_started',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  cent_balance numeric(30,8) not null default 0,
  igd_balance numeric(30,8) not null default 0,
  igt_balance numeric(30,8) not null default 0,
  staked_igd_balance numeric(30,8) not null default 0,
  total_staking_rewards_igd numeric(30,8) not null default 0,
  total_deposited_igd numeric(30,8) not null default 0,
  total_wagered_cent numeric(30,8) not null default 0,
  total_wagered_igd numeric(30,8) not null default 0,
  total_won_cent numeric(30,8) not null default 0,
  total_lost_cent numeric(30,8) not null default 0,
  total_purchased_cent numeric(30,8) not null default 0,
  experience_points bigint not null default 0,
  vip_level integer not null default 0,
  purchase_count integer not null default 0,
  bonus_50_available boolean not null default false,
  bonus_100_available boolean not null default false,
  bonus_150_available boolean not null default false,
  active_bonus numeric(30,8) not null default 0,
  free_spins integer not null default 0,
  free_spin_bet_amount numeric(30,8) not null default 0,
  free_spin_game text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  type public.transaction_type not null,
  currency text,
  cent_amount numeric(30,8) not null default 0,
  igd_amount numeric(30,8) not null default 0,
  igt_amount numeric(30,8) not null default 0,
  game_slug text,
  description text,
  balance_after numeric(30,8),
  status public.transaction_status not null default 'pending',
  notes jsonb,
  payment_method text,
  reference_id text,
  created_at timestamptz not null default now()
);

create table public.weekly_wagers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_key date not null,
  total_ic_wagered numeric(30,8) not null default 0,
  total_id_wagered numeric(30,8) not null default 0,
  weekly_goal numeric(30,8) not null default 0,
  goal_reached boolean not null default false,
  weekly_bonus_amount numeric(30,8) not null default 0,
  rakeback_amount numeric(30,8) not null default 0,
  reward_status text not null default 'pending',
  credited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_key)
);

create table public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  amount numeric(30,8) not null check (amount > 0),
  payment_method text not null,
  payment_details jsonb,
  status public.withdrawal_status not null default 'pending',
  admin_note text,
  reviewed_at timestamptz,
  audit_flag boolean not null default false,
  audit_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.token_packs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tokens numeric(30,8) not null default 0,
  cat_dollars numeric(30,8) not null default 0,
  price numeric(12,2) not null check (price >= 0),
  is_active boolean not null default true,
  is_featured boolean not null default false,
  badge text,
  image_url text,
  weekly_bonus_threshold numeric(30,8),
  weekly_bonus_reward numeric(30,8),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index transactions_user_created_idx on public.transactions(user_id, created_at desc);
create index weekly_wagers_user_week_idx on public.weekly_wagers(user_id, week_key desc);
create index withdrawals_user_created_idx on public.withdrawal_requests(user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.transactions enable row level security;
alter table public.weekly_wagers enable row level security;
alter table public.withdrawal_requests enable row level security;
alter table public.token_packs enable row level security;

create policy "profiles own read" on public.profiles for select using (auth.uid() = id);
create policy "profiles own update" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "wallet own read" on public.wallets for select using (auth.uid() = user_id);
create policy "transactions own read" on public.transactions for select using (auth.uid() = user_id);
create policy "weekly wagers own read" on public.weekly_wagers for select using (auth.uid() = user_id);
create policy "withdrawals own read" on public.withdrawal_requests for select using (auth.uid() = user_id);
create policy "withdrawals own create" on public.withdrawal_requests for insert with check (auth.uid() = user_id);
create policy "active token packs read" on public.token_packs for select using (is_active = true);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  insert into public.wallets (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger profiles_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();
create trigger wallets_updated_at before update on public.wallets for each row execute procedure public.set_updated_at();
create trigger weekly_wagers_updated_at before update on public.weekly_wagers for each row execute procedure public.set_updated_at();
create trigger withdrawals_updated_at before update on public.withdrawal_requests for each row execute procedure public.set_updated_at();
create trigger token_packs_updated_at before update on public.token_packs for each row execute procedure public.set_updated_at();
