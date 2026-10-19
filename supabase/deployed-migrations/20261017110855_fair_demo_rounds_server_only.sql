create table if not exists public.fair_demo_rounds (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 game text not null check (game in ('dice','coin','number')),
 client_seed text not null check (char_length(client_seed) between 1 and 128),
 server_seed_hash text not null check (server_seed_hash ~ '^[0-9a-f]{64}$'),
 server_seed text not null,
 nonce bigint not null default 0,
 outcome jsonb not null,
 created_at timestamptz not null default now(),
 unique (user_id, id)
);
alter table public.fair_demo_rounds enable row level security;
revoke all on public.fair_demo_rounds from anon, authenticated;
grant select (id, game, client_seed, server_seed_hash, nonce, outcome, created_at) on public.fair_demo_rounds to authenticated;
drop policy if exists "read own demo rounds" on public.fair_demo_rounds;
create policy "read own demo rounds" on public.fair_demo_rounds for select to authenticated using (user_id=(select auth.uid()));
-- Keep server_seed inaccessible via direct table reads; the function reveals it only in a completed round response.


