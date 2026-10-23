# Deletion-only retention client

`cleanup.py` is a standalone standard-library Python client. It calls only
`worker_expired` and `worker_purged`; it never requests evidence URLs, downloads
images, imports the comparison worker or requires model files. The server checks
the existing worker credential, expiry and outstanding upload-grant fence.

After separate deployment/operations approval, an operator can run
`python3 cleanup.py --config /protected/existing-config.json --once`, or omit
`--once` for a 60-second loop. This PR does not install a service, access that
configuration, create credentials or run a hosted cycle. Configuration must be a
regular, non-symlink file with no group/other permissions and the existing
`anon_key` and `worker_token` fields. The client restricts its own actions; it does
not claim that the existing server credential is deletion-only.

One cycle processes the server's bounded batch of ten. A failed deletion does not
stop other items; failures produce a generic message and nonzero one-shot exit.
Unfinished items become eligible again after their persisted retry deadline. No IDs, credentials or exception details
are logged. Existing comparison-worker deployment and scheduling are untouched.
Run the isolated tests with:

```sh
python3 -B -m unittest discover -s services/kyc-retention -p test_cleanup.py
```

The proposed reconciliation migration keeps deletion tombstones indefinitely.
Every successful sweep schedules another check one hour later, including rows
already marked deleted. This removes uploads that finish after token expiry and
a previous purge; the original deletion timestamp and audit event remain intact.
A deletion timestamp records a completed sweep, not proof that an in-flight
upload can never reappear. Physical cleanup still requires a running client.

Deploy the proposed lifecycle and reconciliation migrations before the updated
Edge function, under separate release authorization. Operators must establish
scheduling, failure alerts and backlog/throughput monitoring: ten records per
cycle is bounded capacity, not a guaranteed one-hour deletion SLA. Tombstones
retain submission identifiers so predictable object keys remain reconcilable.

## Readiness, rollout and rollback

No timer/service is installed or enabled by this change. The `systemd/` files are
reviewable templates only. The oneshot runs one bounded cycle and exits; the timer
waits 60 seconds after completion, so a slow batch does not overlap itself.
The loop mode remains available, but do not run it alongside the timer. Configure
the existing protected worker configuration and an operator-approved service
identity before installation; do not reuse a comparison-worker unit or launch
models. Validate templates with `node scripts/test-kyc-retention-schedule.mjs`.

Rollout order under separate approval:

1. Apply the lifecycle, reconciliation and fair-retry migrations (through
   `20261023164745`), retaining existing guards.
2. Deploy the reviewed Edge function. Both retention actions return the additive
   `retention_protocol: "reconcile-v2"` marker without changing the result shape.
3. Validate one synthetic cleanup cycle, then install the standalone client and
   enable exactly one scheduling method only after operator approval.
4. Connect journal/service-failure monitoring and aggregate backlog checks to an
   approved destination. This PR neither sends alerts nor creates live schedules.

The new client refuses an API without the protocol marker and exits nonzero,
even for an empty queue. This makes an old or rolled-back Edge function visible
as `incompatible_api`, instead of falsely reporting healthy durable cleanup.
A purge also requires `result.deleted` to be the boolean `true`; malformed or
unacknowledged results count as failures. The old client's result-only access
remains compatible with the additive API response, but lacks these health checks.

A frontend-only rollback is compatible with the legacy queue response. Retain
the new migration, Edge retention handler and standalone client during that
rollback. **Rolling the Edge handler back to main's old RPC routing stops
reconciliation of previously purged rows.** Retaining the migration alone does
not preserve cleanup. Do not drop the new function/column or redeploy an old Edge
handler as an ordinary rollback. A backend rollback requires a separately reviewed
replacement that preserves retention routing; otherwise hold rollout and have
an operator resolve the failure. The client fails visibly; it cannot repair an
incompatible server or safely substitute the old cleanup contract.

## Failure and backlog evidence

Each cycle emits one JSON journal record with status, a bounded failure code,
selected/deleted/failed counts, `batch_full`, `due_count_lower_bound` and elapsed
seconds. Configuration failure exits nonzero and emits only event/status/failure.
An unexpected cycle failure adds duration but may omit batch counts. In `--once`
mode any cycle failure exits nonzero; loop mode logs the failure and retries after
60 seconds instead of exiting. Records never contain IDs, credentials, provider
error text or evidence. Per-item failures continue through the remaining
batch. A full batch means **at least ten were due when fetched**, not an exact
backlog estimate. A successful empty batch is not proof that future late uploads
cannot reappear. `deleted` counts acknowledged sweeps, including repeat sweeps.

`health.sql` is an aggregate-only read query for an already authorized operator:
it reports due count, first-deletion count, recheck count and oldest due age using
the same fence/recheck/retry eligibility as the server. It also reports retry-waiting
count and oldest waiting age measured from the original eligible time. It creates no browser endpoint
and is tested only against disposable fixtures. Choose an approved monitor to
collect it; this PR does not connect to a hosted database.

Before Storage I/O, the server reserves an attempt and persists a retry deadline:
5, 10, 20, 40, then 60 minutes for successive unfinished attempts. Crashes and
ambiguous responses count as unfinished attempts too. Ordering uses the latest
expiry, upload fence, reconciliation and retry time, followed by ID. Failed early
items therefore yield to older waiting work even if their retry delay expires
during a slow cycle. A successful acknowledgement clears the retry state and
schedules the next hourly reconciliation. Only the current attempt token can
acknowledge completion; stale completions cannot change timestamps or audits.
The token stays inside the Edge handler and service-only database RPC.

The v2 marker requires the fair-retry RPC. The new client rejects v1 servers;
retain the v2 handler and migration during rollback. Existing clients can still
read the additive response but do not enforce this compatibility gate. Do not
run an old retention handler concurrently: its v1 RPC does not reserve attempts.

Alert on failed service runs, missing cycle reports, increasing oldest due or
retry-waiting age, and sustained full batches. An empty due queue can coexist with
unfinished items in backoff; monitor both aggregates. Persistent failures still
require operator intervention even though they no longer monopolize the queue.
The retry intervals are bounded implementation policy, not a production deletion
SLA. Capacity depends on request latency, the ten-item limit and the growing
recurring tombstone set. Approve monitoring ownership, acceptable due/waiting-age
and backlog thresholds, retry policy, and capacity before rollout.
