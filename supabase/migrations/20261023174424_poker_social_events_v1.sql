create table if not exists public.poker_social_events_v1 (
 id uuid primary key default gen_random_uuid(),
 table_id uuid not null references public.poker_tables_v1(id) on delete cascade,
 actor_id uuid not null references auth.users(id) on delete cascade,
 target_user_id uuid not null references auth.users(id) on delete cascade,
 action_id text not null check (action_id in ('poop','dynamite','cheers','pie','money','chicken','water')),
 created_at timestamptz not null default clock_timestamp(),
 check (actor_id <> target_user_id)
);
create index if not exists poker_social_events_v1_table_recent
 on public.poker_social_events_v1(table_id,created_at desc);
create index if not exists poker_social_events_v1_actor_recent
 on public.poker_social_events_v1(actor_id,created_at desc);
alter table public.poker_social_events_v1 enable row level security;
revoke all on public.poker_social_events_v1 from public,anon,authenticated;
grant select,insert,delete on public.poker_social_events_v1 to service_role;
comment on table public.poker_social_events_v1 is
 'Ephemeral cosmetic poker-table social actions. Backend-only; no chips, wallet, KYC, or financial authority.';
