# Imperial Games Poker — Tournament, Sit & Go and Ring Table Architecture

**Scope:** Supabase staging; practice chips only. These specifications do **not** enable real-value buy-ins, withdrawals, tournament prize distribution, or rake.

## Game formats
- **Scheduled multi-table tournament (MTT):** Superadmin creates draft, schedule, registration and late registration windows, max entries, starting stack, blind/ante schedule, optional breaks, and payout *display* structure. Registration closes at configured cutoff. Seated players are balanced with deterministic seat transfers between hands, avoiding movement of a live hand. Hand-for-hand synchronization and final table consolidation are mandatory before any award logic is enabled.
- **Sit & Go (SNG):** fixed 2–10 seats for single table; tournament starts only when full and all participants have confirmed readiness. Optional multi-table SNG requires the MTT table-balancing service. No unattended start when the seat capacity is not met.
- **Ring / cash-style table:** 2–6 seats in v1 (future 9/10 seats), cash-style voluntary buy-in/top-up between hands only, cash-out only between hands, configured blinds and min/max practice-chip stack, no rake initially. A ring table is not a tournament; chips are tracked independently of tournament stacks. Real financial cash games are expressly out of scope.

## Superadmin tournament builder fields
- `name`, `format` (scheduled_mtt, sit_and_go, ring), `game` (nl_holdem), `max_players`, `seats_per_table`, `starting_stack`
- `small_blind`, `big_blind`, optional `ante`, `blind_levels` (sequence: level, small, big, ante, durationSeconds, breakAfterSeconds)
- scheduled_mtt: `start_at`, `registration_open_at`, `late_registration_minutes`; SNG: `start_when_full`; ring: min/max practice-chip buy-in and idle policy
- payout template with percentages and minimum field thresholds is *configuration only*. The payout engine must independently validate payout sums, tie-handling, fee rules and actual funding.
- `max_reentries`, `reentry_cutoff_level`, `allow_rebuy` and `add_on`: disabled pending verified atomic stack transactions.
- Administrative actions: create draft, validate, publish, pause, cancel, close registration, force break, safely drain a table (never change cards or modify a live pot). Every action is audited with actor, old/new config version, time, reason and idempotency key.

## State machines and invariants
- Tournament: draft -> registration -> seating -> running -> paused -> finished / cancelled.
- MTT: atomic unique entry per registration; seat reservations; waitlist; deterministic movement between hands; exactly one table owns each entry; one active hand per table; total chips = initial stacks + authorized rebuys - disclosed fees.
- SNG: registration -> ready -> running; start only at capacity; no late join after start.
- Ring: open -> accepting_seats -> playing -> draining -> closed; join/leave/top-up only with row locks and table not actively dealing.
- **Disconnects:** retain seat and authoritative stack; reconnect via authenticated snapshot with private hole cards limited to user, table revision, action deadline; timeout auto-check if legal, otherwise fold; never auto-call/raise. Disconnect never permits double entry or a duplicate stack.
- **Concurrency:** every join, seat move, chip transaction, action, street advance, showdown and payout must commit as one DB transaction with a version check and idempotency key. Uncontested chips are returned before rake; side pots, dead blinds, odd chips and rake caps are explicit.
- **Fairness:** CSPRNG shuffled decks committed before deal; server-only seed/deck access; commitments and full histories verified post-hand; no admin control to edit deck/seed after start.
- **Anti-collusion:** flag chip dumping, soft play, synchronized betting, shared account/device indicators. Human review and appeal before punitive actions. Preserve privacy and applicable consent requirements.

## Mandatory acceptance gates
1. Unit/property-based tests for all hand rankings, side pots, split pots, odd chips, raises and short all-ins.
2. Parallel 100+ simulated clients: exactly-once join, action, seat move and awards; reject stale versions without lost chips.
3. Process kill/restart and reconnect from persistent state; no hole-card leakage through Realtime, REST, logs or Admin.
4. Timers and clock-skew tests, scheduled starts, late-reg cutoffs, all-in and bubble transitions, final-table consolidation.
5. Practice-chip conservation by event-sourced ledger replay. Staging e2e with real Auth identities and permission-denial tests.
6. Independent security review before real-value modes. No production merge without passing CI.

## Dependency caveat
The current `poker-table-v1` API/database migration is a **staging prototype**, not a finished multiplayer hand. It does not yet fully implement showdown invariants, button/blind edge cases, side-pot refunds, or crash-recovery transactionality. Do not enable live tournaments against it until these requirements pass.
