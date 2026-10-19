-- STAGING-ONLY Imperial Games treasury policy: user's ELLIPAL air-gapped
-- wallet is the offline bulk cold reserve; separate hot wallet runs operations.
-- Does NOT create receiving addresses, store keys, sign, send, or move funds.
create table if not exists public.crypto_treasury_accounts (
  account_id text primary key check (account_id in ('operational-hot-wallet','ellipal-cold-reserve')),
  display_name text not null,
  custody_tier text not null check (custody_tier in ('hot_operating','offline_cold_reserve')),
  provider_name text not null,
  signing_mode text not null check (signing_mode in ('independent_online_custody','ellipal_air_gapped_offline')),
  purpose text not null,
  -- A provider's custody or watch-only reference is never a signing secret.
  custody_reference text,
  chain_address text,
  permitted_transfer_direction text not null check (permitted_transfer_direction in ('none')),
  is_active boolean not null default false check (is_active = false),
  transfers_enabled boolean not null default false check (transfers_enabled = false),
  current_balance_source text not null default 'unverified' check (current_balance_source = 'unverified'),
  last_verified_at timestamptz,
  updated_at timestamptz not null default now(),
  check (chain_address is null and custody_reference is null and last_verified_at is null),
  check (
    (account_id = 'operational-hot-wallet' and custody_tier = 'hot_operating'
       and signing_mode = 'independent_online_custody')
    or
    (account_id = 'ellipal-cold-reserve' and custody_tier = 'offline_cold_reserve'
       and signing_mode = 'ellipal_air_gapped_offline')
  )
);
alter table public.crypto_treasury_accounts enable row level security;
revoke all on public.crypto_treasury_accounts from public, anon, authenticated;

insert into public.crypto_treasury_accounts
 (account_id,display_name,custody_tier,provider_name,signing_mode,purpose,permitted_transfer_direction)
values
 ('operational-hot-wallet','Imperial Games Hot Wallet','hot_operating',
  'provider_to_be_confirmed','independent_online_custody',
  'future limited routine approved withdrawals','none'),
 ('ellipal-cold-reserve','Imperial Games ELLIPAL Offline Reserve','offline_cold_reserve',
  'ELLIPAL','ellipal_air_gapped_offline',
  'future bulk treasury reserves, offline top-ups and sweeps','none')
on conflict (account_id) do update set
  display_name = excluded.display_name,
  custody_tier = excluded.custody_tier,
  provider_name = excluded.provider_name,
  signing_mode = excluded.signing_mode,
  purpose = excluded.purpose,
  permitted_transfer_direction = 'none',
  is_active = false,
  transfers_enabled = false,
  updated_at = now();

create table if not exists public.crypto_treasury_control_policy (
  policy_id text primary key check (policy_id = 'staging-default'),
  planned_cold_reserve_model text not null default 'bulk_assets_ellipal'
    check (planned_cold_reserve_model = 'bulk_assets_ellipal'),
  daily_operating_wallet_role text not null default 'operational-hot-wallet'
    check (daily_operating_wallet_role = 'operational-hot-wallet'),
  cold_wallet_role text not null default 'ellipal-cold-reserve'
    check (cold_wallet_role = 'ellipal-cold-reserve'),
  -- Do not invent a limit or reserve split for the user's actual holdings.
  max_hot_exposure_usd numeric(20,2) check (max_hot_exposure_usd > 0),
  cold_reserve_target_percent numeric(5,2)
    check (cold_reserve_target_percent > 0 and cold_reserve_target_percent <= 100),
  approval_threshold_usd numeric(20,2) not null default 2500.00
    check (approval_threshold_usd = 2500.00),
  manual_offline_cold_signing_required boolean not null default true
    check (manual_offline_cold_signing_required = true),
  second_person_control_for_cold_movements boolean not null default true
    check (second_person_control_for_cold_movements = true),
  independent_custody_signing_required boolean not null default true
    check (independent_custody_signing_required = true),
  compliance_screen_every_withdrawal boolean not null default true
    check (compliance_screen_every_withdrawal = true),
  automated_hot_wallet_payouts_enabled boolean not null default false
    check (automated_hot_wallet_payouts_enabled = false),
  treasury_transfers_enabled boolean not null default false
    check (treasury_transfers_enabled = false),
  updated_at timestamptz not null default now()
);
alter table public.crypto_treasury_control_policy enable row level security;
revoke all on public.crypto_treasury_control_policy from public, anon, authenticated;
insert into public.crypto_treasury_control_policy (policy_id)
values ('staging-default')
on conflict (policy_id) do nothing;
comment on table public.crypto_treasury_accounts is
'ELLIPAL offline reserve and distinct hot-wallet operating account. Staging planning only, no addresses or signing material; all transfers disabled.';
comment on table public.crypto_treasury_control_policy is
'Staging-only hot/cold custody separation: $2500 review threshold; every withdrawal screened; independent signing; offline reserve never auto signs.';


