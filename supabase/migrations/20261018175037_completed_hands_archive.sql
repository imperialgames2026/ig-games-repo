-- Past Played Hands is the ONLY eligible source for hand coaching.
-- Archive rows are written exclusively by an audited server-side settlement pipeline.
create table if not exists public.ig_poker_completed_hands(
 id uuid primary key default gen_random_uuid(),
 table_id uuid not null,hand_no integer not null check(hand_no>0),
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
alter table public.ig_hand_analysis_receipts add column if not exists completed_hand_id uuid references public.ig_poker_completed_hands(id);
create index if not exists ig_hand_receipts_archive_id on public.ig_hand_analysis_receipts(user_id,completed_hand_id);
comment on table public.ig_poker_completed_hands is 'Read-only past played hands directory. Archive only after authorized, verified server settlement; no client-supplied hand summaries.';
comment on column public.ig_hand_analysis_receipts.completed_hand_id is 'Future AI analysis must use a completed, server-archived hand owned by the requester; never live hands.';
