-- Hybrid custody: connected wallets remain user-controlled; only verified deposits enter the internal ledger.
-- A 3% exchange fee is fixed; prices must come from a verified, expiring provider quote.
create table if not exists public.exchange_orders (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id),
 client_request_id uuid not null,
 source_asset text not null,
 destination_asset text not null,
 source_network text not null,
 destination_network text not null,
 amount_in numeric(30,12) not null check(amount_in>0),
 fee_bps integer not null default 300 check(fee_bps=300),
 quoted_amount_out numeric(30,12),
 provider_quote_id text,
 quote_expires_at timestamptz,
 status text not null default 'pending_quote' check(status in ('pending_quote','quoted','awaiting_deposit','processing','completed','failed','expired','refunded')),
 provider_transaction_id text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(user_id,client_request_id),
 check(source_asset<>destination_asset or source_network<>destination_network)
);
alter table public.exchange_orders enable row level security;
revoke all on public.exchange_orders from anon,authenticated;
grant select on public.exchange_orders to authenticated;
create policy "users read own exchange orders" on public.exchange_orders for select to authenticated using(user_id=(select auth.uid()));
create table if not exists public.exchange_fee_ledger (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null unique references public.exchange_orders(id),
 asset text not null,
 fee_amount numeric(30,12) not null check(fee_amount>=0),
 created_at timestamptz not null default now()
);
alter table public.exchange_fee_ledger enable row level security;
revoke all on public.exchange_fee_ledger from anon,authenticated;
comment on table public.exchange_orders is 'Exchange workflow only: no exchange execution or deposits are enabled until verified provider, custody and settlement integration.';
