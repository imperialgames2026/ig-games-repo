
create table if not exists public.ig_hand_analysis_packages (
 sku text primary key check (sku ~ '^[a-z0-9_]{3,40}$'),
 name text not null, credits integer not null check (credits>0),
 proposed_usd_price numeric(12,2) check (proposed_usd_price>=0),
 payment_enabled boolean not null default false,
 created_at timestamptz not null default now()
);
insert into public.ig_hand_analysis_packages(sku,name,credits,proposed_usd_price) values
('hand_5','5 Hand Reviews',5,2.99),('hand_25','25 Hand Reviews',25,9.99),('hand_100','100 Hand Reviews',100,29.99)
on conflict(sku) do nothing;

create table if not exists public.ig_hand_analysis_accounts(
 user_id uuid primary key references auth.users(id) on delete cascade,
 credits integer not null default 0 check(credits>=0),
 total_used integer not null default 0 check(total_used>=0),
 updated_at timestamptz not null default now()
);
create table if not exists public.ig_hand_analysis_receipts (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 hand_reference text not null check(length(hand_reference) between 5 and 180),
 request_id uuid not null,
 status text not null default 'pending' check(status in ('pending','complete','failed')),
 credits_spent integer not null default 1 check(credits_spent=1),
 analysis jsonb,
 completed_at timestamptz,
 created_at timestamptz not null default now(),
 unique(user_id,request_id)
);
create index if not exists ig_hand_analysis_owner_recent on public.ig_hand_analysis_receipts(user_id,created_at desc);
alter table public.ig_hand_analysis_packages enable row level security;
alter table public.ig_hand_analysis_accounts enable row level security;
alter table public.ig_hand_analysis_receipts enable row level security;
revoke all on public.ig_hand_analysis_packages,public.ig_hand_analysis_accounts,public.ig_hand_analysis_receipts from anon,authenticated;
grant select on public.ig_hand_analysis_packages,public.ig_hand_analysis_accounts,public.ig_hand_analysis_receipts to authenticated;
create policy ig_hand_pkg_read on public.ig_hand_analysis_packages for select to authenticated using(true);
create policy ig_hand_acc_owner on public.ig_hand_analysis_accounts for select to authenticated using(user_id=(select auth.uid()));
create policy ig_hand_receipt_owner on public.ig_hand_analysis_receipts for select to authenticated using(user_id=(select auth.uid()));
comment on table public.ig_hand_analysis_packages is 'DRAFT prices only: payments and credits purchasing disabled. Not connected to IGD casino wallet.';
comment on table public.ig_hand_analysis_receipts is 'Post-hand educational study records only. No in-hand solver, opponent hole card access, or credit issuance through client.';


