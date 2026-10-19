create table if not exists public.fair_seed_commitments (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 game text not null check (game in ('dice','coin','number')),
 server_seed text not null,
 server_seed_hash text not null,
 status text not null default 'committed' check (status in ('committed','revealed')),
 client_seed text,
 nonce bigint not null default 0,
 outcome jsonb,
 created_at timestamptz not null default now(),
 revealed_at timestamptz,
 constraint fair_client_seed_valid check (client_seed is null or char_length(client_seed) between 1 and 128)
);
alter table public.fair_seed_commitments enable row level security;
revoke all on public.fair_seed_commitments from public,anon,authenticated;
grant select(id,game,server_seed_hash,status,client_seed,nonce,outcome,created_at,revealed_at) on public.fair_seed_commitments to authenticated;
create policy "read own seed commitments" on public.fair_seed_commitments for select to authenticated using (user_id=(select auth.uid()));
create index if not exists fair_seed_commitments_user_status on public.fair_seed_commitments(user_id,status,created_at);


