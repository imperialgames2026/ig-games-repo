-- Staging-only headless poker accounts. Never used for real-money or wallet transactions.
create table if not exists public.ig_poker_lab_bots (
  key text primary key check (key in ('ace','baron','carl','wendy')),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  public_name text not null check (length(public_name) between 5 and 64),
  strategy text not null check (strategy in ('tight','aggressive','caller','wildcard')),
  created_at timestamptz not null default now()
);
create table if not exists public.ig_poker_lab_tables (
  table_id uuid primary key references public.poker_tables_v1(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.ig_poker_lab_bots enable row level security;
alter table public.ig_poker_lab_tables enable row level security;
revoke all on public.ig_poker_lab_bots from public,anon,authenticated;
revoke all on public.ig_poker_lab_tables from public,anon,authenticated;
comment on table public.ig_poker_lab_bots is 'Dedicated staging-only simulated poker accounts. Never admit bots to real-money wallet or settlement flows.';
comment on table public.ig_poker_lab_tables is 'Explicitly isolated testing tables, restricted to staging and Superadmin control.';


