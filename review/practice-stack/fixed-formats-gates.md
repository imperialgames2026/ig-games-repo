# Fixed-format candidate gates

This is an isolated review candidate, not a hosted migration or release.
Configured Holdem formats are exactly 2, 4, 6, 8 and 9. Seven occupants may
sit at an eight- or nine-capacity table. Omaha remains six with four cards.
Existing unsupported configurations require explicit administrator review;
neither SQL nor UI should silently convert them.

The original five GLB/PNG pairs are preserved byte-for-byte; provenance is in
`docs/poker-format-assets.json`. WebGL uses actual model seat anchors. PNG
fallback uses a separate accessible roster, without guessed image coordinates.
Missing capacity on legacy snapshots means the established Holdem8/Omaha6
format only. New selected formats require the new capacity RPC and must never
silently fall back to the old factory.

The preserved 08bd18b2 runtime evidence and aebc1874 bootstrap remain prior
evidence. They do not demonstrate fixed-format or nine-seat acceptance.

Before the next approved synthetic run:

- Review selected-capacity tournament-entry integrity and service-role tests.
- Pin the updated proposal in a new bootstrap, independently verify its hash,
  and stage exactly the same seven already-approved Edge handlers.
- Preserve a clean immutable source commit; driver must enforce that commit.
- Run payout, tournament and all-five-format HTTP/browser assertions with the
  existing images, ports and resource caps. Review screenshots separately;
  asset loading and element counts alone do not establish usable framing.
- Verify final journal reconciliation and run-owned cleanup.

Before any separate hosted rollout authorization:

- Read actual target definitions/ACLs/constraints and resolve unsupported
  existing event/preset formats without automatic customer-data rewrites.
- Review selected SQL order: existing dependencies, journal, fixed capacities
  (superseding old eight-entry proposal), receipt binding, resolver.
- The capacity RPC/schema must precede the matching Edge/client source.
- Account separately for the still-active hosted Slots handler and verify a
  reviewed parking gate. Review scaffolding is not deployed enforcement.
- Keep pending KYC migrations, unselected financial schema and unrelated review
  ancestry out of the rollout. No blanket manifest migration application.
- Realtime and resolver HTTP remain outside the approved seven-handler runtime
  slice. Public refund/cancellation APIs are unsupported, not silently passed.

Main merge, production deployment and Android alignment remain gated by actual
acceptance evidence and a coordinated approved release set.
