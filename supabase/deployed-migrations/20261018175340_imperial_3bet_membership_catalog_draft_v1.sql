create table if not exists public.ig_membership_plans_draft (
 plan_code text primary key,
 name text not null,
 monthly_price_usd numeric(12,2) not null check(monthly_price_usd>=0),
 ign_monthly_usd_target numeric(12,2) not null default 0 check(ign_monthly_usd_target>=0),
 ign_tokens_per_month numeric(28,8),
 hand_review_credits_per_month integer not null default 0 check(hand_review_credits_per_month>=0),
 boosters_per_month integer not null default 0 check(boosters_per_month>=0),
 boost_duration_hours integer not null default 12 check(boost_duration_hours between 1 and 72),
 base_fee_rebate_bps integer not null default 0 check(base_fee_rebate_bps between 0 and 10000),
 tier1_fee_rebate_bps integer not null default 0 check(tier1_fee_rebate_bps between 0 and 10000),
 tier2_fee_rebate_bps integer not null default 0 check(tier2_fee_rebate_bps between 0 and 10000),
 boost_multiplier numeric(8,4),
 tournament_discount_bps integer,
 pricing_enabled boolean not null default false,
 subscription_activation_enabled boolean not null default false,
 reward_issuance_enabled boolean not null default false,
 updated_at timestamptz not null default now(),
 constraint rebate_order check(base_fee_rebate_bps<=tier1_fee_rebate_bps and tier1_fee_rebate_bps<=tier2_fee_rebate_bps),
 constraint no_unverified_ign_valuation check(ign_tokens_per_month is null),
 constraint no_unapproved_tournament_discount check(tournament_discount_bps is null)
);
insert into public.ig_membership_plans_draft(plan_code,name,monthly_price_usd,ign_monthly_usd_target,ign_tokens_per_month,hand_review_credits_per_month,boosters_per_month,boost_duration_hours,base_fee_rebate_bps,tier1_fee_rebate_bps,tier2_fee_rebate_bps,pricing_enabled,subscription_activation_enabled,reward_issuance_enabled)
values ('imperial_3bet','Imperial 3-Bet Membership',120,80,null,200,6,12,1000,1250,1500,false,false,false)
on conflict(plan_code) do update set monthly_price_usd=excluded.monthly_price_usd,ign_monthly_usd_target=excluded.ign_monthly_usd_target,hand_review_credits_per_month=excluded.hand_review_credits_per_month,boosters_per_month=excluded.boosters_per_month,boost_duration_hours=excluded.boost_duration_hours,base_fee_rebate_bps=excluded.base_fee_rebate_bps,tier1_fee_rebate_bps=excluded.tier1_fee_rebate_bps,tier2_fee_rebate_bps=excluded.tier2_fee_rebate_bps,pricing_enabled=false,subscription_activation_enabled=false,reward_issuance_enabled=false,updated_at=now();
alter table public.ig_membership_plans_draft enable row level security;
revoke all on public.ig_membership_plans_draft from anon,authenticated;
grant select on public.ig_membership_plans_draft to authenticated;
create policy ig_membership_plans_read on public.ig_membership_plans_draft for select to authenticated using(true);
comment on table public.ig_membership_plans_draft is 'Staging draft. $80 IGN denotes intended benefit value, not a redeemable, transferable or priced asset, and does not mint, grant or promise token quantity. All billing and reward issuance disabled.';


