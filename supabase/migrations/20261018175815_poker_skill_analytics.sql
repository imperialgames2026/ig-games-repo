-- Verified poker analytics and decision-quality skill scoring.
-- Apply AFTER the completed hands archive migration.
-- Client writes revoked: only trusted settlement / offline coaching graders can ingest.
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
create table if not exists public.ig_poker_decision_grades(
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
create or replace view public.ig_poker_player_metrics with(security_invoker=true) as  WITH f AS (
         SELECT ig_poker_hand_facts.user_id,
            count(*)::integer AS hands,
            count(*) FILTER (WHERE ig_poker_hand_facts.voluntarily_put_money_preflop)::integer AS vpip_count,
            count(*) FILTER (WHERE ig_poker_hand_facts.preflop_raised)::integer AS pfr_count,
            count(*) FILTER (WHERE ig_poker_hand_facts.threebet_opportunity)::integer AS threebet_opps,
            count(*) FILTER (WHERE ig_poker_hand_facts.threebet_made)::integer AS threebets,
            count(*) FILTER (WHERE ig_poker_hand_facts.faced_threebet)::integer AS faced_threebet_count,
            count(*) FILTER (WHERE ig_poker_hand_facts.folded_to_threebet)::integer AS folded_to_threebet_count,
            count(*) FILTER (WHERE ig_poker_hand_facts.cbet_flop_opportunity)::integer AS cbet_opps,
            count(*) FILTER (WHERE ig_poker_hand_facts.cbet_flop_made)::integer AS cbets,
            count(*) FILTER (WHERE ig_poker_hand_facts.faced_cbet_flop)::integer AS faced_cbet_count,
            count(*) FILTER (WHERE ig_poker_hand_facts.folded_to_cbet_flop)::integer AS folded_to_cbet_count,
            count(*) FILTER (WHERE ig_poker_hand_facts.steal_opportunity)::integer AS steal_opps,
            count(*) FILTER (WHERE ig_poker_hand_facts.steal_attempt)::integer AS steals,
            count(*) FILTER (WHERE ig_poker_hand_facts.blind_defense_opportunity)::integer AS defense_opps,
            count(*) FILTER (WHERE ig_poker_hand_facts.defended_blind)::integer AS defenses,
            count(*) FILTER (WHERE ig_poker_hand_facts.saw_showdown)::integer AS showdowns,
            count(*) FILTER (WHERE ig_poker_hand_facts.won_showdown)::integer AS showdown_wins,
            count(*) FILTER (WHERE ig_poker_hand_facts.saw_showdown OR ig_poker_hand_facts.won_hand)::integer AS known_showdown_or_win_hands,
            count(*) FILTER (WHERE ig_poker_hand_facts.won_hand)::integer AS hand_wins,
            sum(ig_poker_hand_facts.aggressive_actions) AS aggressive_actions,
            sum(ig_poker_hand_facts.calls) AS calls,
            sum(ig_poker_hand_facts.hand_bb_net) AS bb_net,
            count(ig_poker_hand_facts.hand_bb_net)::integer AS bb_net_observations
           FROM ig_poker_hand_facts
          GROUP BY ig_poker_hand_facts.user_id
        ), g AS (
         SELECT ig_poker_decision_grades.user_id,
            count(*)::integer AS graded_decisions,
            count(DISTINCT ig_poker_decision_grades.completed_hand_id)::integer AS graded_hands,
            avg(ig_poker_decision_grades.decision_quality) AS avg_quality
           FROM ig_poker_decision_grades
          GROUP BY ig_poker_decision_grades.user_id
        )
 SELECT f.user_id,
    f.hands,
    round(100.0 * f.vpip_count::numeric / NULLIF(f.hands, 0)::numeric, 2) AS vpip,
    round(100.0 * f.pfr_count::numeric / NULLIF(f.hands, 0)::numeric, 2) AS pfr,
    round(100.0 * f.threebets::numeric / NULLIF(f.threebet_opps, 0)::numeric, 2) AS threebet,
    f.threebet_opps,
    round(100.0 * f.folded_to_threebet_count::numeric / NULLIF(f.faced_threebet_count, 0)::numeric, 2) AS fold_to_threebet,
    f.faced_threebet_count AS fold_to_threebet_opps,
    round(100.0 * f.cbets::numeric / NULLIF(f.cbet_opps, 0)::numeric, 2) AS flop_cbet,
    f.cbet_opps,
    round(100.0 * f.folded_to_cbet_count::numeric / NULLIF(f.faced_cbet_count, 0)::numeric, 2) AS fold_to_flop_cbet,
    f.faced_cbet_count AS fold_to_flop_cbet_opps,
    round(100.0 * f.steals::numeric / NULLIF(f.steal_opps, 0)::numeric, 2) AS steal,
    f.steal_opps,
    round(100.0 * f.defenses::numeric / NULLIF(f.defense_opps, 0)::numeric, 2) AS blind_defense,
    f.defense_opps,
    round(100.0 * f.showdown_wins::numeric / NULLIF(f.showdowns, 0)::numeric, 2) AS wtsd_win,
    f.showdowns,
    round(100.0 * f.hand_wins::numeric / NULLIF(f.hands, 0)::numeric, 2) AS hands_won,
    round(f.aggressive_actions::numeric / NULLIF(f.calls, 0)::numeric, 2) AS aggression_factor,
    f.bb_net,
    f.bb_net_observations,
    COALESCE(g.graded_decisions, 0) AS graded_decisions,
    COALESCE(g.graded_hands, 0) AS graded_hands,
        CASE
            WHEN f.hands >= 200 AND COALESCE(g.graded_decisions, 0) >= 100 AND COALESCE(g.graded_hands, 0) >= 50 THEN GREATEST(0::numeric, LEAST(1000::numeric, round(1000::numeric * g.avg_quality)))::integer
            ELSE NULL::integer
        END AS skill_score,
        CASE
            WHEN f.hands >= 200 AND COALESCE(g.graded_decisions, 0) >= 100 AND COALESCE(g.graded_hands, 0) >= 50 THEN 'evaluated'::text
            ELSE 'N/A'::text
        END AS skill_status
   FROM f
     LEFT JOIN g ON g.user_id = f.user_id;;
revoke all on public.ig_poker_player_metrics from public,anon;
grant select on public.ig_poker_player_metrics to authenticated;
comment on view public.ig_poker_player_metrics is 'N/A skill until at least 200 verified hands, 100 graded decisions and 50 graded hands; owner-only via invoker RLS.';
