# VIP wheel publication and atomic wallet rewards

The owner clarified that **a player can win and collect the same reward again on
another spin**. Prize sections are never removed after a win. Uniqueness belongs
to the earned spin `(user_id, level)`, not the reward, section, amount or currency.

## Delivered behavior

The Reward Wheels dashboard saves drafts independently from published wheels.
A superadmin can publish a saved stage or pause it. Publication checks the exact
draft revision and current publication revision; it copies the complete prize
pool into a separate snapshot. Subsequent draft edits do not change active odds
or prizes. Published odds are visible to players, including excluded sections
with weight 0. Publication and pause events have private, server-owned audits.

Automatic settlement supports explicitly configured **IGN, IGD and IGT** wallet
credits, using the existing public wallet mappings: IGN → `cent_balance`, IGD →
`igd_balance`, IGT → `igt_balance`. The old `ID` label is not converted or guessed.
Every enabled section must have a positive exact amount and one of these units.
Amounts retain eight decimal places. Other units, free bets, game spins and XP
multipliers can stay in drafts with weight 0; publishing rejects enabled prizes
whose fulfillment is unsupported. This does not implement external transfers,
withdrawals, custody or general real-money game readiness.

The player selects a stage and spends its next saved level spin. The server:

1. Resolves `auth.uid()` and locks the actual active session, user, profile and
   canonical role. Anonymous, banned, excluded, expired-session and tester writes
   are denied; no actor, outcome, amount or currency is accepted from the client.
2. Locks the earned spin and returns its existing receipt on retry.
3. Locks the current published wheel, verifies the displayed revision and checks
   that it is active. Paused or changed wheels do not consume the saved spin.
4. Chooses a weighted ticket with `pgcrypto.gen_random_bytes` and rejection
   sampling, then credits only the selected wallet, writes a bonus transaction and
   stores an immutable owner-readable receipt in the same database transaction.

A failure rolls back all three effects. Separate spins can select the same
section, each with its full reward. A concurrent retry of the same spin returns
one identical receipt and cannot pay again. No wager-based XP, free spins or
other wallet fields are awarded by this settlement.

The interface displays the recorded result, collected-reward history and the
remaining saved spins. An interrupted request retains the exact level/revision
in browser storage and recovers its receipt; recovery cannot spend a second
level spin. The wallet toolbar refreshes after a confirmed credit. Wheel slice
sizes are a visual layout; displayed weight percentages determine probabilities.
The system uses server-generated randomness, not a claim of independently
verifiable or committed-seed fairness.

## Deployment and initial state

Recorded migration `20261021032722_vip_wheel_atomic_redemption.sql` is deployed to
`qonqemhljgxlwpghkxhn`. Public RPC wrappers use SECURITY INVOKER; actor-bound
privileged implementations remain in the unexposed internal schema. No function
accepts an arbitrary target user. Draft settings keep their existing private
staff-read/superadmin-write access. Published configuration is public; receipts
are owner-only. No new Edge Function is required.

All three wheels initially remain paused because the inherited draft prize
pools contain unresolved ID/free-bet/multiplier entries. No current settings were
replaced, no player spin was consumed and no customer balance was credited by the
migration. The owner can explicitly configure supported prizes and publish each
stage from Admin → Reward Wheels. No customer data was imported; all 23 held game
routes remain held.

## Verification

Hosted transactional tests passed and rolled back all fixtures: repeat prizes on
separate spins, same-spin replay, exact decimal credits, one ledger entry per
spin, rollback after simulated ledger failure, stale/paused/unearned denial,
canonical authorization, owner isolation, session revocation/expiry and audit
atomicity. Supabase's security advisor returned zero findings. All 101 recorded
migrations match their reviewed sources (18 exact and 83 historical differences
of two terminal newlines); 30 Edge Functions are unchanged.

Offline tests cover supported prize configuration, repeat-win availability,
receipt validation, identity binding, retry identity, publication authorization
and interrupted-request recovery. New isolated Auth/browser cases exercise repeat
wins, 12 concurrent requests for one spin, all three explicit wallet currencies,
receipt history, reload recovery and admin publish/pause/draft separation. Final
CI and public deployment evidence is recorded in the release PR.
