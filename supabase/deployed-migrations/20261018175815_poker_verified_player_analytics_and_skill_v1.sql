-- Staging-only, server-settlement-derived poker analytics. NO client event writes.
create table if not exists public.ig_poker_hand_facts (
 completed_hand_id uuid primary key references public.ig_poker_completed_hands(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 variant text not null check(variant in ('holdem','omaha')),
 went_to_flop boolean not null default false,
 saw_showdown boolean not null default false,
 won_showdown boolean not null default false,
 won_hand boolean not null default false,
 voluntarily_put_money_preflop boolean not null default false,
 preflop_raised boolean not null default false,
 threebet_opportunity boolean not null default false,
 threebet_made boolean not null default false,
 faced_threebet boolean not null default false,
 folded_to_threebet boolean not null default false,
 cbet_flop_opportunity boolean not null default false,
 cbet_flop_made boolean not null default false,
 faced_cbet_flop boolean not null default false,
 folded_to_cbet_flop boolean not null default false,
 steal_opportunity boolean not null default false,
 steal_attempt boolean not null default false,
 blind_defense_opportunity boolean not null default false,
 defended_blind boolean not null default false,
 aggressive_actions integer not null default 0 check(aggressive_actions>=0),
 calls integer not null default 0 check(calls>=0),
 hand_bb_net numeric(18,6),
 recorded_at timestamptz not null default now(),
 check(not threebet_made or (threebet_opportunity and preflop_raised)),
 check(not folded_to_threebet or faced_threebet),
 check(not cbet_flop_made or cbet_flop_opportunity),
 check(not folded_to_cbet_flop or faced_cbet_flop),
 check(not steal_attempt or steal_opportunity),
 check(not defended_blind or blind_defense_opportunity),
 check(not won_showdown or saw_showdown)
);
create index if not exists ig_poker_hand_facts_user on public.ig_poker_hand_facts(user_id);
create table if not exists public.ig_poker_decision_grades (
 id uuid primary key default gen_random_uuid(),
 completed_hand_id uuid not null references public.ig_poker_completed_hands(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 decision_key text not null check(length(decision_key) between 1 and 100),
 decision_quality numeric(5,4) not null check(decision_quality between 0 and 1),
 grading_version text not null,
 graded_at timestamptz not null default now(),
 unique(completed_hand_id,decision_key,grading_version)
);
create index if not exists ig_poker_decision_grades_user on public.ig_poker_decision_grades(user_id);
alter table public.ig_poker_hand_facts enable row level security;
alter table public.ig_poker_decision_grades enable row level security;
revoke all on public.ig_poker_hand_facts,public.ig_poker_decision_grades from anon,authenticated;
grant select on public.ig_poker_hand_facts,public.ig_poker_decision_grades to authenticated;
create policy ig_hand_facts_owner on public.ig_poker_hand_facts for select to authenticated using(user_id=(select auth.uid()));
create policy ig_grades_owner on public.ig_poker_decision_grades for select to authenticated using(user_id=(select auth.uid()));
comment on table public.ig_poker_hand_facts is 'Per-hand factual poker denominators, generated only from completed hands by trusted settlement processor; not populated from user inputs.';
comment on table public.ig_poker_decision_grades is 'Post-hand verified objective decision quality 0–1, requiring versioned evaluator; ungraded players remain N/A.';
create or replace view public.ig_poker_player_metrics
with(security_invoker=true)
as
with f as (
 select user_id,count(*)::integer hands,
 count(*) filter(where voluntarily_put_money_preflop)::integer vpip_count,
 count(*) filter(where preflop_raised)::integer pfr_count,
 count(*) filter(where threebet_opportunity)::integer threebet_opps,
 count(*) filter(where threebet_made)::integer threebets,
 count(*) filter(where faced_threebet)::integer faced_threebet_count,
 count(*) filter(where folded_to_threebet)::integer folded_to_threebet_count,
 count(*) filter(where cbet_flop_opportunity)::integer cbet_opps,
 count(*) filter(where cbet_flop_made)::integer cbets,
 count(*) filter(where faced_cbet_flop)::integer faced_cbet_count,
 count(*) filter(where folded_to_cbet_flop)::integer folded_to_cbet_count,
 count(*) filter(where steal_opportunity)::integer steal_opps,
 count(*) filter(where steal_attempt)::integer steals,
 count(*) filter(where blind_defense_opportunity)::integer defense_opps,
 count(*) filter(where defended_blind)::integer defenses,
 count(*) filter(where saw_showdown)::integer showdowns,
 count(*) filter(where won_showdown)::integer showdown_wins,
 count(*) filter(where saw_showdown or won_hand)::integer known_showdown_or_win_hands,
 count(*) filter(where won_hand)::integer hand_wins,
 sum(aggressive_actions)::bigint aggressive_actions,
 sum(calls)::bigint calls,
 sum(hand_bb_net) bb_net,
 count(hand_bb_net)::integer bb_net_observations
 from public.ig_poker_hand_facts group by user_id
),
g as (
 select user_id,count(*)::integer graded_decisions,
 count(distinct completed_hand_id)::integer graded_hands,
 avg(decision_quality) avg_quality from public.ig_poker_decision_grades group by user_id
)
select f.user_id,f.hands,
 round(100.0*f.vpip_count/nullif(f.hands,0),2) vpip,
 round(100.0*f.pfr_count/nullif(f.hands,0),2) pfr,
 round(100.0*f.threebets/nullif(f.threebet_opps,0),2) threebet,
 f.threebet_opps,
 round(100.0*f.folded_to_threebet_count/nullif(f.faced_threebet_count,0),2) fold_to_threebet,
 f.faced_threebet_count as fold_to_threebet_opps,
 round(100.0*f.cbets/nullif(f.cbet_opps,0),2) flop_cbet,
 f.cbet_opps,
 round(100.0*f.folded_to_cbet_count/nullif(f.faced_cbet_count,0),2) fold_to_flop_cbet,
 f.faced_cbet_count as fold_to_flop_cbet_opps,
 round(100.0*f.steals/nullif(f.steal_opps,0),2) steal,
 f.steal_opps,
 round(100.0*f.defenses/nullif(f.defense_opps,0),2) blind_defense,
 f.defense_opps,
 round(100.0*f.showdown_wins/nullif(f.showdowns,0),2) wtsd_win,
 f.showdowns,
 round(100.0*f.hand_wins/nullif(f.hands,0),2) hands_won,
 round(f.aggressive_actions::numeric/nullif(f.calls,0),2) aggression_factor,
 f.bb_net,
 f.bb_net_observations,
 coalesce(g.graded_decisions,0) graded_decisions,
 coalesce(g.graded_hands,0) graded_hands,
 case when f.hands>=200 and coalesce(g.graded_decisions,0)>=100 and coalesce(g.graded_hands,0)>=50
   then greatest(0,least(1000,round(1000*g.avg_quality)))::integer
   else null::integer end as skill_score,
 case when f.hands>=200 and coalesce(g.graded_decisions,0)>=100 and coalesce(g.graded_hands,0)>=50
   then 'evaluated' else 'N/A' end as skill_status
from f left join g on g.user_id=f.user_id;
revoke all on public.ig_poker_player_metrics from public,anon;
grant select on public.ig_poker_player_metrics to authenticated;
comment on view public.ig_poker_player_metrics is 'Owner-only via invoker RLS. N/A skill until 200 archived hands, 100 graded decisions and 50 evaluated hands; score is 0–1000 post-hand decision quality, not winnings or wagering.';


