# Isolated practice acceptance harness

Review/test tooling only. It does not deploy or apply SQL to any hosted project.
The CLI exposes plan-only mode; actual execution requires a reviewed run config,
explicit startup approval and `IG_SYNTHETIC_STACK_APPROVED=1`. A clean immutable
frontend commit, exact source/bundle/helper inventory and bootstrap hash are
checked before startup. No automatic image pulls or cache-miss downloads occur.

The approved slice uses actual local GoTrue, PostgREST, EdgeRuntime, PostgreSQL17
and Chrome with synthetic `example.invalid` accounts. Five pinned images and
SDK 2.57.0/2.57.4 integrity records are specified in `images.json` and
`dependency-acquisition.json`. Acquisition/cache setup requires separate review;
local `../approved-runtime-acquisition` caches are not source artifacts.

Only loopback 54321/4173 are exposed. DB has no host port, uses fresh tmpfs, and
all five containers total 2432 MiB. One browser worker runs serially. Cleanup is
restricted to exact owned run IDs/labels; unrelated resources are preserved.
Temporary JWTs/passwords exist only inside the disposable run and are excluded
from evidence. Do not reuse production credentials, projects or data.

The SQL assembly source is `review/real-auth-practice/build_bundle.py`. Generated
combined SQL is not a migration or published source artifact. To reproduce the
current pinned artifact offline, from the repository root:

```sh
python3 -c "import runpy; from pathlib import Path; m=runpy.run_path('review/real-auth-practice/build_bundle.py'); Path('review/practice-stack/reviewed-app-bootstrap-fixed-formats.sql').write_text(m['build']())"
```

Expected SHA256: 7281d021e17c22a4066a3897ddaaf7e7217a159ac8cd507803cbd58f45860ad8.
Assembly reads hash-pinned sources only; it does not connect to a database.
The selected order is journal, fixed capacities, receipt binding, resolver.
The superseded eight-seat proposal and unselected financial proposal are not
part of the current assembly. Staged bundles/caches, generated combined SQL,
logs, credentials and run evidence must stay outside source publication.

Observed local evidence is bounded: eight game journeys, accounting/races,
selected payout branches, free tournament seating, and fixed 2/4/6/8/9 formats.
This is not full accounting/fairness or a release gate pass. Native SQL controller
fixtures and clock adjustments are reported explicitly; cron/Realtime are not
verified by those fixtures. Rare payout branches, full tournament elimination,
admin preset creation and resolver HTTP require additional acceptance. Public
refund/cancellation APIs are unsupported. Hosted Slots parking remains open.

See `fixed-formats-gates.md`. No main merge, hosted rollout or Android release
is authorized by importing or executing this source alone.
