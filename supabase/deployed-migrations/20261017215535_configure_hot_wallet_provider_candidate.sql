-- User-selected treasury wallet app: HOT Wallet by HOT Labs.
-- Naming a provider does not establish a merchant withdrawal API, compatibility
-- with every chain/asset, approval-policy support, or permission to move funds.
-- All treasury rows and funds movements remain disabled.
update public.crypto_treasury_accounts
   set provider_name = 'HOT Wallet (HOT Labs)',
       updated_at = now()
 where account_id = 'operational-hot-wallet'
   and is_active = false
   and transfers_enabled = false;

create table if not exists public.crypto_treasury_integration_readiness (
  provider_id text primary key check (provider_id = 'hot-wallet'),
  provider_name text not null default 'HOT Wallet (HOT Labs)'
    check (provider_name = 'HOT Wallet (HOT Labs)'),
  wallet_app_multichain_support_discovered boolean not null default true,
  business_server_signing_verified boolean not null default false
    check (business_server_signing_verified = false),
  independent_approval_policy_verified boolean not null default false
    check (independent_approval_policy_verified = false),
  payout_api_verified boolean not null default false
    check (payout_api_verified = false),
  per_user_deposit_address_derivation_verified boolean not null default false
    check (per_user_deposit_address_derivation_verified = false),
  every_requested_network_verified boolean not null default false
    check (every_requested_network_verified = false),
  operationally_approved boolean not null default false
    check (operationally_approved = false),
  real_funds_enabled boolean not null default false
    check (real_funds_enabled = false),
  reference_url text not null default 'https://hot-labs.org/wallet/'
    check (reference_url = 'https://hot-labs.org/wallet/'),
  updated_at timestamptz not null default now()
);
alter table public.crypto_treasury_integration_readiness enable row level security;
revoke all on public.crypto_treasury_integration_readiness from public, anon, authenticated;
insert into public.crypto_treasury_integration_readiness(provider_id)
values ('hot-wallet')
on conflict (provider_id) do nothing;

comment on table public.crypto_treasury_integration_readiness is
'HOT Wallet is a named operating-wallet candidate only; 0 audited automated signing, custody, or payment capabilities have been approved. No real funds.';


