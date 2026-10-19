# Imperial Poker Analytics and Skill (N/A–1000)

Status: staging database and profile UI complete; event ingestion and score grading remain pending.

## Player profile
VPIP = voluntarily enter pot preflop / hands dealt (forced blinds and antes excluded).
PFR = preflop raises / hands dealt.
3-Bet = three-bets / valid opportunities.
Fold-to-3-Bet = folded when facing 3-bet / faced 3-bet.
Flop C-Bet = flop continuation bets / opportunities.
Fold-to-C-Bet = folds / faced flop C-bet.
Steal = steal attempts / steal opportunities.
Blind Defense = defended blinds / defense opportunities.
Showdown win = showdowns won / showdowns seen.
Hands won = hands won / hands played.
Aggression factor = aggressive bets+raises / calls, null when no calls.
Context includes total verified hands and BB net; stakes or volume do NOT improve skill score.

All rates with zero opportunities show N/A. Owner RLS protects private stats.

## Skill (not a gambling reward)
N/A until 200 verified hands, 100 versioned post-hand graded decisions, and grades across 50 different hands.
After thresholds, score = round(1000 * mean verified decision quality between 0 and 1).
This is a tentative decision-quality proxy, not a calibrated human intelligence/intuition claim. Grading models must be validated against independent poker decision evaluations. No skill bonuses for membership, IGN balances, betting volume, risk, or hand review purchases. Distinguish scoring from HUD play-style indicators. Any public profile sharing should be opt-in.

## Source tables
- public.ig_poker_completed_hands: server settlement archive, owner-only.
- public.ig_poker_hand_facts: authoritative per-hand event flags; user writes denied.
- public.ig_poker_decision_grades: versioned post-hand evaluator grades; user writes denied.
- public.ig_poker_player_metrics: SQL security-invoker view with owner RLS.
- components/poker/PokerPlayerAnalytics.jsx: visible on Profile and ProfileStats.

## Blockers before live analytics
1. Trusted server hand archive writer from poker-table settlement; existing action table is not hand-scoped, so add explicit hand IDs to verified actions.
2. Compute VPIP, preflop raising, opportunity denominators, board and position metrics from hand action timelines; replay-safe ingestion. Do not calculate from client screen actions or legacy Base44 approximations.
3. Async post-hand grading through Past Played Hands only. Version/calibrate evaluator by variant and opponent state.
4. Statistical validation, RLS and idempotency tests and sample-size confidence reporting.
5. No automated scoring or production feature activation until these tasks pass.
