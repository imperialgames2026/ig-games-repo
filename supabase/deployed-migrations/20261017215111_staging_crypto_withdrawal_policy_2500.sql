-- STAGING POLICY ONLY. No wallet balance mutation, approval, or chain signing.
-- The thresholds are operational review rules, NEVER AML exemptions.
create table if not exists public.crypto_withdrawal_policy (
  policy_id text primary key check (policy_id = 'staging-default'),
  approval_threshold_usd numeric(20,2) not null check (approval_threshold_usd > 0),
  review_rolling_24h_usd numeric(20,2) not null check (review_rolling_24h_usd > 0),
  review_rolling_7d_usd numeric(20,2) not null check (review_rolling_7d_usd > 0),
  hold_rolling_24h_usd numeric(20,2) not null check (hold_rolling_24h_usd >= review_rolling_24h_usd),
  hold_rolling_7d_usd numeric(20,2) not null check (hold_rolling_7d_usd >= review_rolling_7d_usd),
  screen_every_transaction boolean not null default true check (screen_every_transaction = true),
  independent_custody_signer_required boolean not null default true
    check (independent_custody_signer_required = true),
  real_deposits_enabled boolean not null default false check (real_deposits_enabled = false),
  real_withdrawals_enabled boolean not null default false check (real_withdrawals_enabled = false),
  updated_at timestamptz not null default now()
);
alter table public.crypto_withdrawal_policy enable row level security;
revoke all on public.crypto_withdrawal_policy from public, anon, authenticated;
insert into public.crypto_withdrawal_policy (
  policy_id, approval_threshold_usd, review_rolling_24h_usd,
  review_rolling_7d_usd, hold_rolling_24h_usd, hold_rolling_7d_usd
) values ('staging-default',2500.00,2500.00,7500.00,10000.00,25000.00)
on conflict (policy_id) do update set
  approval_threshold_usd = excluded.approval_threshold_usd,
  review_rolling_24h_usd = excluded.review_rolling_24h_usd,
  review_rolling_7d_usd = excluded.review_rolling_7d_usd,
  hold_rolling_24h_usd = excluded.hold_rolling_24h_usd,
  hold_rolling_7d_usd = excluded.hold_rolling_7d_usd,
  updated_at = now();

-- The evaluator returns only a *preview lane*. Actual withdrawal authorization
-- always remains false, even after all screens/approvals hypothetically pass.
-- Rolling totals are supplied solely as sample simulation inputs, NOT authoritative
-- money-history figures. The future withdrawal handler must calculate them from
-- reserved + submitted + processed ledger events inside a locked transaction.
create or replace function public.preview_crypto_withdrawal_policy(
  p_amount_usd numeric,
  p_previous_24h_usd numeric,
  p_previous_7d_usd numeric,
  p_screening_state text default 'pending'
) returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_policy public.crypto_withdrawal_policy%rowtype;
  v_total_24h numeric;
  v_total_7d numeric;
  v_manual boolean;
  v_hold boolean;
begin
  select * into strict v_policy from public.crypto_withdrawal_policy
   where policy_id = 'staging-default';
  if p_amount_usd is null or p_previous_24h_usd is null or
     p_previous_7d_usd is null or p_amount_usd <= 0 or
     p_previous_24h_usd < 0 or p_previous_7d_usd < 0 or
     p_amount_usd > 1000000000 or p_previous_24h_usd > 1000000000 or
     p_previous_7d_usd > 1000000000 or
     p_screening_state not in ('clear','pending','flagged','blocked') or
     p_screening_state is null then
     raise exception 'Invalid staging withdrawal scenario' using errcode='22023';
  end if;
  v_total_24h := p_amount_usd + p_previous_24h_usd;
  v_total_7d := p_amount_usd + p_previous_7d_usd;
  v_manual := p_amount_usd >= v_policy.approval_threshold_usd
     or v_total_24h >= v_policy.review_rolling_24h_usd
     or v_total_7d >= v_policy.review_rolling_7d_usd
     or p_screening_state <> 'clear';
  v_hold := v_total_24h > v_policy.hold_rolling_24h_usd
     or v_total_7d > v_policy.hold_rolling_7d_usd
     or p_screening_state = 'blocked';
  return pg_catalog.jsonb_build_object(
    'mode','staging_only',
    'amount_usd',p_amount_usd,
    'rolling_24h_usd',v_total_24h,
    'rolling_7d_usd',v_total_7d,
    'screening_required',true,
    'screening_state',p_screening_state,
    'superadmin_approval_required',v_manual,
    'approval_lane',case when v_hold then 'hold_for_compliance'
                         when v_manual then 'superadmin_review'
                         else 'automation_candidate' end,
    'independent_custody_signature_required',true,
    'can_release_funds',false,
    'deposits_enabled',false,
    'withdrawals_enabled',false
  );
end
$$;
revoke all on function public.preview_crypto_withdrawal_policy(numeric,numeric,numeric,text)
  from public,anon,authenticated;
grant execute on function public.preview_crypto_withdrawal_policy(numeric,numeric,numeric,text)
  to service_role;
comment on table public.crypto_withdrawal_policy is
'Configurable staging-only USD-equivalent crypto withdrawal review policy. Superadmin review at or above $2500 or when rolling totals trigger, screening every transaction, separate custody signing. No enabled funds.';
comment on function public.preview_crypto_withdrawal_policy(numeric,numeric,numeric,text) is
'Service-only non-authoritative hypothetical policy simulator; never releases or approves real funds.';


