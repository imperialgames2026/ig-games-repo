alter table public.fair_demo_rounds alter column outcome drop not null; alter table public.fair_demo_rounds add column if not exists status text not null default 'committed' check (status in ('committed','revealed')); create index if not exists fair_demo_rounds_user_status_idx on public.fair_demo_rounds(user_id,status);

