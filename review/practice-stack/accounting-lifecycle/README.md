# Bounded real-stack lifecycle candidate — not executed

These modules are unwired review source. No runtime results, containers,
listeners, network requests, credentials, SQL or downloads were produced.
The only checks run are offline pure helper/source tests and JS syntax.
This does not alter the separate native Unix-socket runner or its guards.

## Integration contract after explicit approval

Site owner integrates into the separately reviewed stack driver only after all
pinned images/import bundles, actual GoTrue/PostgREST/Edge setup, app closure,
ledger/seat/binding/resolver source review and runtime/setup approvals are met.
No active manifest, handler, UI or published SQL is changed by these files.

```js
const db = createContainerSql({
  run, id: exactCreatedDatabaseContainerId,
  image: exactLocallyInspectedDatabaseImageId,
  approvedRun: run,
});
const result = await settlementAcceptance({
  run, players: distinctLifecycleUsers, call: actualAuthenticatedHttpCall,
  db, operatorCorrectionFixture: false,
});
```

The runtime driver already requires IG_SYNTHETIC_STACK_APPROVED=1 and reviewed
configuration; these module interlocks do not grant approval. Construction and
imports do not spawn anything. Provider execution calls only `docker inspect`
and bounded `docker exec -i <exact ID> psql` through existing approved Docker
access. It never starts/pulls/builds/installs or changes permissions. Do not use
it as another route around any future denial.

Provider checks exact64hex containerID, pinned sha256imageID, run label, expected
name, running state, only run-private network, no published DB port, privilege,
host bind or persistent mount; PGdata tmpfs required. SQL connects via container
Unix socket to its `postgres` database, not host/remote DSN. Each async exec uses
a real independent psql process. Concurrent cases require server PID, XID and
clock intervals proving actual transaction overlap; JS/client timing does not
count. Timeout/identity/overlap/failure aborts the phase; never auto-relax guards.
Privileged SQL is a test-operator interface, never a player endpoint.

`players` must be two actual GoTrue-created identities with captured UUIDs,
phase:'lifecycle' and synthetic @example.invalid email, distinct from browser
fixtures. `call(user, slug, body, expectedStatus)` must be owner's actual local
HTTP helper using each user's validated token, exact allowlisted gateway and
actual Edge engine. No fake response/Node adapter. Never print tokens/passwords.
Run before browser journeys; module requires no prior native wager receipts.
It does not reset existing fixtures. An aborted run must be disposed through
owner's run-owned cleanup, not resumed by clearing production/native data.

## Implemented future phase source

- Holdem/Omaha: actual create/join/start/snapshot/turn actor/fold/replay. Native
  stacks+escrow conserve2000 and committed returns0.
- Baccarat: actual player/banker/tie stakes, actual controller resolves after
  fixture deadline advance; replay does not add a payout. Controller field is
  authoritative shooterId, not an invented controllerId.
- Blackjack: actual join/main stake/deal/stand until showdown/resolve/replay.
  Payout credit matches stored hand returns, including possible zero/push.
- Roulette:37actual number wagers and exact retries guarantee a positive native
  settlement; same actual HTTP request dispatched twice charges once. Two
  independent operator DB tick sessions settle native outcome/payout once.
- Craps: actual shooter field stake/roll/replay; native dice determine result,
  credit matches native settled bet. Zero return is valid, not positive-payout
  coverage. Same refill request races through two independent SQL sessions and
  grants500 once after explicit synthetic balance fixture.
- Crash/Trenball: actual joined user bets committed round (auto,red,green), then
  real native house tick races settle once. Only clock deadlines are changed;
  committed outcome, seed, duration and paid_units are not overwritten. This is
  accounting/phase coverage, NOT fairness proof or positive manual cashout proof.
- Native SQL same-charge race, insufficient-funds transaction rollback, ending
  live-to-ledger consistency and exact request posting trace. Wager netdelta
  must equal -units; Poker settlement netdelta across components must be0.
  Payout credits match native recorded returns; independent game math/fairness
  validation remains a separate requirement.
- Optional explicit operatorCorrectionFixture:true performs linked one-chip
  refund against an actual traced roulette wager and rejects duplicate
  compensation with rollback. Default false. An additional distinct real lifecycle operator identity with
  canonical superadmin role is required and recorded as audit actor. This requires separately approved
  synthetic operator fixture permission and is NOT a public refund/cancellation
  policy/API. Ordinary practice user refund remains unsupported.
- Final ordinary HTTP leave actions release shared controllers/seats; the extra
  receipt-race wager settles before leaving. No data deletion/reset occurs.

SQL fixture clock/balance changes are deliberate approved-lab test mutations,
not player functionality, source fixes, hosted changes or real game-history
acceptance. Source-only review does not authorize running them.

## Truthful result and remaining work

Result status is PASS_BOUNDED_LIFECYCLE only after actual future execution.
It keeps fullAccountingAcceptance:false and publicCancellationRefund:false;
it must not replace blanket settlementLedgerConcurrency:false in the parent
acceptance report without an independently reviewed coverage merge. Positive
manual Crash cashout, all Blackjack/sidebet/payout branches, public refund
eligibility, failed/unauthorized actor permutations, real Auth tournament seat
transitions and Realtime still need targeted phases. Auth/RLS acceptance remains
in owner's existing real HTTP/browser suite; this module does not duplicate it.
Missing state, action phase, controller, receipt, role or server evidence fails
closed. No snapshots/not-found unlock legacy actions.

Offline validation only:

```bash
node review/accounting-lifecycle/offline.test.mjs
node --check review/accounting-lifecycle/container-sql.mjs
node --check review/accounting-lifecycle/settlement.mjs
```

No executable CLI or automatic integration is provided. Parent driver owns
resource creation, approvals, real Auth fixture generation, error cleanup and
safe credential handling. All actual phase execution remains pending.

Child-process failure handling is part of the provider contract: one settlement
path clears its timer, destroys stdin and stops only its exact child on failure.
Spawn/stdin/stdout/stderr errors are handled before input is written; late EPIPE,
error and close events cannot escape or settle again. Offline fake-child tests
cover spawn failure, EPIPE/synchronous write errors, timeout, late events and
successful close/timer cleanup. Fake timers may emit Node's experimental API
warning; no real timer wait or Docker process is involved in these tests.
