-- IGN staging-only token economics. Planning settings are not game settlement settings.
alter table public.ign_settings
 add column if not exists target_house_edge_bps integer not null default 700 check (target_house_edge_bps between 0 and 10000),
 add column if not exists wagering_reward_bps_of_edge integer not null default 1000 check (wagering_reward_bps_of_edge between 0 and 10000),
 add column if not exists staking_reward_bps_of_edge integer not null default 1000 check (staking_reward_bps_of_edge between 0 and 10000),
 add column if not exists hourly_cycle_minutes integer not null default 60 check (hourly_cycle_minutes=60),
 add column if not exists early_unstake_penalty_bps integer not null default 100 check (early_unstake_penalty_bps between 0 and 10000),
 add column if not exists penalty_free_after_hours integer not null default 168 check (penalty_free_after_hours between 1 and 8760),
 add column if not exists wagering_rewards_enabled boolean not null default false,
 add column if not exists early_unstake_penalty_enabled boolean not null default false;
alter table public.ign_settings add constraint ign_reward_allocations_max_100pct check (wagering_reward_bps_of_edge + staking_reward_bps_of_edge <= 10000);
comment on table public.ign_settings is 'Staging-only IGN tokenomics. Rates are theoretical targets, not verified game RTP, treasury funding, or active token rewards.';
create or replace function public.ign_reward_preview(p_eligible_wagers numeric)
returns table(eligible_wagers numeric,expected_house_revenue numeric,wagering_reward_budget numeric,staking_reward_budget numeric,combined_reward_budget numeric,remaining_expected_house_revenue numeric)
language sql stable security invoker set search_path=public,pg_temp as $$
 select round(p_eligible_wagers,8),
        round(p_eligible_wagers * s.target_house_edge_bps / 10000,8),
        round(p_eligible_wagers * s.target_house_edge_bps * s.wagering_reward_bps_of_edge / 100000000,8),
        round(p_eligible_wagers * s.target_house_edge_bps * s.staking_reward_bps_of_edge / 100000000,8),
        round(p_eligible_wagers * s.target_house_edge_bps * (s.wagering_reward_bps_of_edge+s.staking_reward_bps_of_edge) / 100000000,8),
        round(p_eligible_wagers * s.target_house_edge_bps * (10000-s.wagering_reward_bps_of_edge-s.staking_reward_bps_of_edge) / 100000000,8)
 from public.ign_settings s
 where s.singleton=true and p_eligible_wagers >= 0 and p_eligible_wagers <= 1000000000000
$$;
revoke all on function public.ign_reward_preview(numeric) from public,anon;
grant execute on function public.ign_reward_preview(numeric) to authenticated;