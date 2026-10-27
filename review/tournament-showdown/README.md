# Natural all-in showdown and tournament consolidation — unwired review source

No runtime, SQL mutation, stack, driver/UI edit or new deployment is included.
Preserved prior evidence is untouched. This candidate uses ONLY existing seven
handlers, actual authenticated call callbacks and the approved owned async SQL
provider's READ-ONLY observations. It never writes cards, outcomes, stacks,
clocks, seeds, receipt payloads or table status through operator SQL.

## Fixture and invocation contract

Source owner adds a finite `showdown` phase to the existing real GoTrue fixture
creator:18 fresh actual players plus one canonical superadmin. Descriptor is
fixture-plan.json. Use returned UUIDs/tokens and @example.invalid accounts,
never invented auth.users rows or production credentials. Account phase and
run/provider ownership are checked; canonical admin provisioning remains the
existing approved setup step. No extra image/service/port/resource is needed.

```js
const observed = await tournamentShowdown({
  run, users: actualShowdownUsers, call: actualAuthenticatedHttpCall,
  db: existingApprovedOwnedSqlProvider, maxCycles:3, record,
});
```

Imports/invocation without approval cannot run callbacks. No CLI or automatic
integration exists. Source owner independently reviews and integrates only
when ready to execute in the approved synthetic stack. `call` uses existing
real GoTrue/Edge JWT transport and exact expected status; network/timeout or
unexpected phase fails closed. No auto-rotated receipt on ambiguous transport.

Create uses scheduled_mtt, maxPlayers18, capacity9, explicit tableCount2 and
1000startingStack. Current admin handler restricts SNG to a single full table,
so18-player SNG is deliberately NOT used. startAt is a short future timestamp;
bounded natural wait (under4seconds) honors actual start checks, no deadline
fixture. Blind level7200seconds avoids artificial schedule advancement.
Registration and start repeat prove no duplicate entries/grants/tables; actual
HTTP assignment must produce18 unique seats across two tables.

## Natural legal hand path

For each active table with at least two funded seats, current seated owner
starts; actual turn actor submits allin/amount0 with original actionID/version.
Response must accept exactly that stack amount and next version. Two journal
component rows must debit stack/credit escrow with net0 and exact actor/request
correlation; replay returns original response and adds nothing. No folds are
used to force elimination. Forced blind all-ins naturally need no action.

After all funded players are all-in, actual HTTP advance progresses existing
showdown/preflop→flop→turn→river (at most3streets). Server computes settle awards
from its actual cards. Budget oracle checks all awards address eligible seats,
nonnegative integer chips sum to escrow, each seat receives its award delta,
escrow clears, native settle journal stack credit matches pot and escrow debit
matches -pot. System settle rows remain system entries; initiatedBy records
which actual HTTP actor requested it, without inventing a journal actor.
Repeated settle is expected409 (not a fictitious second200/idempotency API)
and adds no credit. Authenticated completed replay must be available.

This validates payout accounting and actual showdown path, not an independent
hand-ranking algorithm. Multiple side-pot recipients are not automatically
classified as a tie. A tie is marked only with equal stakes and multiple actual
positive award recipients; rare tie/side-pot combinations stay unobserved.

## Natural elimination and consolidation

After completing all current tables, a currently funded actual participant calls
existing sync. Native logic eliminates zero stacks, clears their assignment,
and moves surviving actual stacks without test overrides. All18 entry records
must remain, with NULL table/seat for eliminated and matching actual live seat
for each survivor. Configured capacity stays9; at<=9survivors exactly one ACTIVE
seat-bearing table must remain (old empty table records/history need not be
deleted). Moved actor table associations are observed, not guessed. Relocation
journal net0 and exactly2posts per observed move are checked. Entire event pool
must remain18000 before/after every hand and sync, zero fees and global live
ledger reconciliation remain required.

Eliminated users' old current snapshot must deny403, but their own frozen-roster
completed hand replay must succeed. This tests actual historical authorization
without adding an owner-resolution endpoint or widening current table access.
Native sync replay uses current assignment: it returns200 if still running or
409after finished; either path must leave audit postings unchanged.

Maximum3 cycles (initially at most2tables/cycle). Normal ties or split winners
may leave more survivors; no unbounded stochastic loop, arbitrary winner,
conservation-breaking stack redistribution or reset is permitted. Result records
all hands, actor/action traces, awards, movement, historical accesses and cycles.
PASS_BOUNDED_MULTITABLE_SLICE requires actual showdown, elimination and cross-
table consolidation. Otherwise INCONCLUSIVE_NATURAL_OUTCOME, with exact missing
observations. Champion completion is a separate boolean and remains missing
unless naturally observed. fullAccountingAcceptance/publicRefund stayfalse.

## Offline checks and remaining gates

```bash
node review/tournament-showdown/offline.test.mjs
node --check review/tournament-showdown/phase.mjs
```

Offline pure budgets/classification/source guards are NOT real hand/tie/HTTP
coverage. Actual execution remains pending. Current preset creator is outside
seven-handler stack; no eighth endpoint is added. Simultaneous showdown-submit
races, all rare side-pot/odd-chip/hand-ranking outcomes, refund policy and full
release review remain separate. No hosted rollout authority or public money
feature is introduced by this test source.
