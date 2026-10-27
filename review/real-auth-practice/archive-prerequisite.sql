-- REVIEW ONLY: exact archive DDL prefix; excludes unrelated coaching receipt ALTER.
create table if not exists public.ig_poker_completed_hands (
 id uuid primary key default gen_random_uuid(),
 table_id uuid not null,
 hand_no integer not null check(hand_no>0),
 player_user_id uuid not null references auth.users(id) on delete cascade,
 variant text not null check(variant in ('holdem','omaha')),
 completed_at timestamptz not null,
 hand_summary jsonb not null,
 source_kind text not null default 'server_settlement' check(source_kind='server_settlement'),
 created_at timestamptz not null default now(),
 unique(table_id,hand_no,player_user_id)
);
create index if not exists ig_completed_hands_user_recent on public.ig_poker_completed_hands(player_user_id,completed_at desc);
alter table public.ig_poker_completed_hands enable row level security;
revoke all on public.ig_poker_completed_hands from anon,authenticated;
grant select on public.ig_poker_completed_hands to authenticated;
create policy ig_completed_hands_owner_read on public.ig_poker_completed_hands for select to authenticated using(player_user_id=(select auth.uid()));
