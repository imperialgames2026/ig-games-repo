# Continuous practice roulette and mobile input

Roulette is house-operated. Each database-timed cycle lasts 30 seconds: betting accepts wagers for 27 seconds; the final 3 seconds are locked while the wheel presents the recorded result; settlement consumes the round's stakes and credits winning practice-chip returns before the next cycle opens. The database clock runs every second through pg_cron, including with no players connected. Scheduler timing is second-granularity; clients never reopen betting ahead of the authoritative snapshot.

The result is written once when betting closes and reused at settlement. Row locking, a unique game/round event, existing per-player request IDs and atomic debit/settlement prevent duplicate rounds, retry charges and overspending. Only the restricted internal scheduler advances roulette. Player spin/claim requests are rejected. Roulette no longer has the old 24-seat shooter queue; craps retains its existing shooter behavior. No crypto or redeemable wallet is involved. Existing active bets and balances were preserved when enabling the clock.

Clock broadcasts contain only a public phase invalidation signal. Clients refetch the authenticated table snapshot; they never accept outcomes or balances from a broadcast. Existing polling recovers missed signals. This avoids polling every phone at animation frame rates. Shared result timestamps align Unity presentation to the landing deadline, and old results restore instantly after reconnecting.

Touch hit testing now runs in the isolated frame against the actual camera/cloth plane. It uses the server lock rather than Unity's old mouse-emulation and animation lock. C# input is disabled to prevent duplicate submissions. Pinch gestures adjust camera zoom without placing chips. An expandable fullscreen table offers landscape orientation where supported; the wager, countdown, join/round action and lock reason stay over the scene. Craps can accept the next server-approved wager while the previous result is still animating. The local practice lab uses the same input bridge.

## Evidence

- Isolated PostgreSQL 18: 100 users joined and submitted 100 simultaneous wagers in 2.402 seconds. Thirty duplicate retries did not add debits; twenty racing settlement ticks created one result/settlement. Late bets and player-triggered spins were rejected. Payouts occurred only after landing and matched exact expected totals. Three empty rounds advanced with nobody seated. This is a database concurrency test, not a claim that 100 physical phones or production network load were tested.
- Hosted migration: `20261024024944_continuous_practice_roulette`, recorded readback committed with its checksum. Six house-driven rounds observed with 30/27-second timings and zero failed scheduler ticks. Security advisors added no new findings.
- Unit suite: 178 tests. Screen-ray tests cover both games, both camera modes, three viewport aspects and three zoom levels.
- Actual Unity browser checks use touch input and controlled shared API responses, exact server values, deduplicated replay and 2D recovery. Fullscreen controls exercised. No test account wagers were inserted into the hosted project by the test harness.
- Unity v3 adds deadline-based presentation duration and wall-clock catch-up. Asset checksums are in the versioned manifest.

The 2D felt/cards retain wager types not yet offered by the 3D scene. The old Android package must be updated to receive the new frame input and controls; app ID and original signing key remain unchanged. The backend timer already runs independently of the package.
