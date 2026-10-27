# Bounded payout extension — source review, no runtime execution

This is separate from the preserved passing08bd18b2 run. It does not modify
that evidence, main-site driver, UI, active handlers, SQL schema, existing
native runner or image/service/port/resource inventory. No stack or Docker
operation was performed while preparing it.

## Integration into the SAME approved stack

After the baseline lifecycle and before browser phases, create two distinct real
GoTrue payout-phase users from the owner's finite fixture plan (phase:'payout',
@example.invalid emails, actual returned UUIDs). Do not reuse lifecycle/browser
accounts or clear native history. Actor-specific native seats must be absent;
Blackjack must have no foreign current-round wager when clock fixtures change.
Normal leave calls release controllers/seats at the end. No table/history reset
or outcome backfill occurs. If another actor controls a live round, fail rather
than replace their identity, state or cards.

```js
const attempt = createManualCashoutAttempt({
  origin:'http://127.0.0.1:54321', anon,
});
const extra = await payoutExtension({
  run, players: actualPayoutUsers, call: actualAuthenticatedHttpCall,
  attempt, db: existingApprovedAsyncSqlProvider,
  maxBlackjackRounds:12, maxCrashRounds:6,
});
```

Imports/construction do not fetch or spawn. Same approval interlock, exact run
and existing async provider ownership checks apply. No extra images, services,
ports, keys, privilege changes or public endpoint are needed. The raw attempt
adapter handles only actual authenticated local Crash cashout HTTP; it returns
status/body so a documented timing422 can be recorded rather than fabricated
as success. Invalid identity, unrelated status or network failure fails closed.
Do not log tokens. Known200 paths still use owner's original actual HTTP call.
No runtime CLI or automatic driver import is installed by this patch.

## Native Blackjack discovery, bounded at12 rounds

Both actual users wager2 main chips plus1 perfect-pairs chip, each original
request replay verified not to debit twice. Controller deals real shuffled
cards; turn actors hit below17 and stand otherwise (max30 total actions).
No card/dealer/outcome is selected, overwritten or forged. Actual native hand
history feeds an independent bookkeeping oracle that computes Ace totals,
natural/push/win/lose/bust main returns and mixed/colored/perfect/miss pairs
returns. Returned chips and whole-table credited balance must match, and exact
resolve replay must not post again. Native history is retained.

Discovery stops early when main positive/zero and sidebet positive/zero are all
observed, or at the hard cap. Every observed status/type is reported, alongside
ALL unobserved main/pair subbranches. A rare pair/blackjack/push not seen within
the bound remains missing; no assertion or sample fixture fills that branch.
The offline oracle tests demonstrate arithmetic only, not live branch coverage.

## Positive manual Crash cashout, bounded at6 native rounds

The test operator reads only native committed round number/outcome/duration for
eligibility discovery; it never reads seeds. Eligible outcome>=2 gives timing
headroom. Ineligible/settled rounds advance through native tick with clock-only
fixtures, never by replacing queued outcomes or seeds. This eligibility lookahead
is an explicit privileged SYNTHETIC TEST technique, not player functionality or
fairness proof. It must not be generalized to production.

Actual user joins, posts10-chip manual bet via HTTP and retries its original key.
Clock fixture preserves native duration while placing start about3.4seconds in
the past (roughly1.2x). Native server timestamps determine actual cashoutX and
paidUnits. Timing may miss; only expected22023/HTTP422 messages count as an
unobserved attempt, never as a successful cashout. Other errors abort.

A200 must agree across actual response, stored bet, floor(10*cashoutX), actual
balance credit and exactly one linked journal credit. Exact cashout retry adds
no row. Report actual paid amount, multiplier, profit/loss and transport time;
positive credit does not inherently mean positive profit. Native round finishes
normally. If bounded discovery yields none, manualCrash.observed=false and the
missing case remains explicit. Clock/lookahead fixtures keep fairnessVerified
false even after a successful payout. No seed/outcome/duration override occurs.

## Two missing independent-session races

- Different request IDs refill the same fresh actual player's Craps account
  from a declared50chip fixture: exactly one request succeeds, one fails native
  threshold/cooldown, one500chip grant posts and ending balance is550.
- Different request IDs compete for one10chip Roulette balance: exactly one
  succeeds, one fails insufficient funds, one wager journal post and ending0.

These are privileged native SQL concurrency probes, not HTTP session races.
They use the SAME approved async container provider; distinct PostgreSQL PIDs,
XIDs and server-time overlap are mandatory. Test expectations never replace
missing evidence. Final outstanding wager is settled by native house tick,
then normal HTTP leave/reconciliation. Fixture balance adjustments are journaled
and explicitly synthetic, not untracked grants or real financial operations.

## Truthful output and remaining gates

Result status BOUNDED_PAYOUT_DISCOVERY includes observed/unobserved branches,
real actor/request traces and two race records. It deliberately keeps
fullAccountingAcceptance:false and publicRefund:false. No public refund API or
operator correction fixture is invented/enabled. All other game payout branches,
public cancellation/refund policy, unmodified-clock fairness and remaining
coverage from baseline still require explicit review. Owner merges evidence only
after actual execution; do not relabel source checks as runtime acceptance.

Offline checks only:

```bash
node review/payout-extension/offline.test.mjs
node --check review/payout-extension/phases.mjs
node --check review/payout-extension/attempt.mjs
```
