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
Subsequent cycles retry unfinished items. No IDs, credentials or exception details
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
