create table if not exists public.crash_round_queue (
 id bigint generated always as identity primary key,
 batch_id uuid not null,
 ordinal integer not null check (ordinal between 1 and 150),
 crash_point numeric(8,2) not null check (crash_point between 0 and 12000),
 duration_ms integer not null check (duration_ms between 500 and 120000),
 commitment text not null check (length(commitment)=64),
 seed_secret text not null,
 status text not null default 'queued' check (status in ('queued','betting','live','finished')),
 created_at timestamptz not null default now(),
 unique(batch_id,ordinal)
);
alter table public.crash_round_queue enable row level security;
revoke all on public.crash_round_queue from anon, authenticated;
create index if not exists crash_round_queue_status_idx on public.crash_round_queue(status,id);


