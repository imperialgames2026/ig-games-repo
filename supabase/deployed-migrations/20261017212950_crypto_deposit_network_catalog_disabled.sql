-- Staging-only deposit acceptance foundation. NEVER CREDIT OR RECEIVE FUNDS FROM THIS MIGRATION.
-- A separate reviewed migration must intentionally remove the hard disabled guards.
create table if not exists public.crypto_deposit_networks (
  network_id text primary key check (network_id in (
    'solana','ethereum','bsc','arbitrum-one','op-mainnet','polygon-pos',
    'bitcoin','litecoin','xrpl','cardano','monero','zephyr'
  )),
  display_name text not null,
  chain_family text not null check (chain_family in ('solana','evm','utxo','xrpl','cardano','cryptonote')),
  evm_chain_id bigint unique,
  enabled boolean not null default false check (enabled = false),
  receiver_verified boolean not null default false check (receiver_verified = false),
  monitor_verified boolean not null default false check (monitor_verified = false),
  reconciliation_verified boolean not null default false check (reconciliation_verified = false),
  inserted_at timestamptz not null default now(),
  check ((chain_family = 'evm' and evm_chain_id is not null) or (chain_family <> 'evm' and evm_chain_id is null))
);
alter table public.crypto_deposit_networks enable row level security;
revoke all on public.crypto_deposit_networks from public, anon, authenticated;
-- Catalog configuration is private and may only be managed with service credentials.

insert into public.crypto_deposit_networks
  (network_id,display_name,chain_family,evm_chain_id)
values
 ('solana','Solana Mainnet','solana',null),
 ('ethereum','Ethereum Mainnet','evm',1),
 ('bsc','BNB Smart Chain','evm',56),
 ('arbitrum-one','Arbitrum One','evm',42161),
 ('op-mainnet','OP Mainnet','evm',10),
 ('polygon-pos','Polygon PoS','evm',137),
 ('bitcoin','Bitcoin','utxo',null),
 ('litecoin','Litecoin','utxo',null),
 ('xrpl','XRP Ledger','xrpl',null),
 ('cardano','Cardano','cardano',null),
 ('monero','Monero','cryptonote',null),
 ('zephyr','Zephyr Protocol','cryptonote',null)
on conflict (network_id) do nothing;

create table if not exists public.crypto_deposit_assets (
  network_id text not null references public.crypto_deposit_networks(network_id),
  asset_code text not null check (asset_code ~ '^[A-Z0-9]{2,12}$'),
  asset_kind text not null check (asset_kind in ('native','token')),
  -- Token contract/mint and decimals MUST be confirmed for this specific chain and issuer.
  token_contract text,
  decimals smallint check (decimals between 0 and 30),
  token_issuer_verified boolean not null default false check (token_issuer_verified = false),
  enabled boolean not null default false check (enabled = false),
  primary key (network_id, asset_code),
  check ((asset_kind = 'native' and token_contract is null) or asset_kind = 'token')
);
alter table public.crypto_deposit_assets enable row level security;
revoke all on public.crypto_deposit_assets from public, anon, authenticated;

insert into public.crypto_deposit_assets (network_id,asset_code,asset_kind)
values
 ('solana','SOL','native'),('solana','USDT','token'),('solana','USDC','token'),
 ('ethereum','ETH','native'),('ethereum','USDT','token'),('ethereum','USDC','token'),
 ('bsc','BNB','native'),('bsc','USDT','token'),('bsc','USDC','token'),
 ('arbitrum-one','ETH','native'),('arbitrum-one','USDT','token'),('arbitrum-one','USDC','token'),
 ('op-mainnet','ETH','native'),('op-mainnet','USDT','token'),('op-mainnet','USDC','token'),
 ('polygon-pos','POL','native'),('polygon-pos','USDT','token'),('polygon-pos','USDC','token'),
 ('bitcoin','BTC','native'),('litecoin','LTC','native'),('xrpl','XRP','native'),
 ('cardano','ADA','native'),('monero','XMR','native'),('zephyr','ZEPH','native')
on conflict (network_id,asset_code) do nothing;

-- Future chain indexers may record observations for reconciliation.
-- These records MUST NEVER generate user credits, wallet mutation, or payout.
create table if not exists public.crypto_deposit_observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  network_id text not null,
  asset_code text not null,
  tx_hash text not null check (char_length(tx_hash) between 8 and 256),
  output_index integer not null default 0 check (output_index >= 0),
  amount_atomic numeric(78,0) not null check (amount_atomic > 0),
  confirmations integer not null default 0 check (confirmations >= 0),
  status text not null default 'observed'
    check (status in ('observed','confirming','confirmed','held','rejected')),
  -- No credited state exists while real-value handling is out of scope.
  credit_status text not null default 'not_credited' check (credit_status = 'not_credited'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (network_id,asset_code)
    references public.crypto_deposit_assets(network_id,asset_code),
  unique (network_id,tx_hash,output_index)
);
alter table public.crypto_deposit_observations enable row level security;
revoke all on public.crypto_deposit_observations from public, anon, authenticated;
grant select on public.crypto_deposit_observations to authenticated;
drop policy if exists "deposit observation own read" on public.crypto_deposit_observations;
create policy "deposit observation own read" on public.crypto_deposit_observations
  for select to authenticated using (user_id = (select auth.uid()));
create index if not exists crypto_deposit_observations_user_created_idx
  on public.crypto_deposit_observations (user_id,created_at desc);
comment on table public.crypto_deposit_observations is
'Staging-only observation records, owner read. No wallet crediting, no address assignment, no automated payments.';


