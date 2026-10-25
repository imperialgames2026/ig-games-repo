# Multi-table poker verification — 2026-10-24

No deck, hand-history or replay mixing was found in the tested cases. No game-engine or database-schema changes were needed.

## Checks completed

- Six interleaved tables, alternating eight-seat Hold'em and six-seat Omaha, ran three successive hands each. All 18 deck roots and 936 card hashes were distinct. The test deliberately reused the same test seed across tables to exercise the table/hand context binding.
- Each dealt/opened card matched that table's expected deck position. Completed replays passed the browser verifier; archived hands were fetched again after subsequent hands and matched the saved records exactly.
- Cards from another table, cards from a later hand, another table's action frame and a mismatched table snapshot were deliberately substituted. Verification rejected each substitution.
- Three actual iframe table components ran together in the multi-table desk, using controlled API responses backed by the database-generated fixtures. Separate histories, visible-card proofs, browser commitment pins and replay controls stayed isolated. Rapidly selecting an older hand and then a newer one did not allow a late response to overwrite the selected hand.
- Five rollback-only hosted runs each exercised four active tables over three hands: 60 hosted test hands in total. These checked the deployed PostgreSQL functions, actual pgcrypto card/root hashes, complete replay chains, hole/board positions, folded-card privacy, historical roots and cross-table access denial. Every run rolled back its test tables, seats, hands and actions.
- Three hosted requests were submitted together using independent database connections. The connector completed the requests serially; these results establish interleaved multi-table correctness, not a production throughput benchmark or a measured twelve-table concurrency limit.

The database tests use controlled settlement awards to focus on deck assignment and replay integrity. They are not a replacement for hand-ranking tests, a randomness-distribution audit, a production load test or an independently witnessed shuffle proof.

## Repeating the checks

`npm run test:replay` includes the six-table/three-hand regression and negative cross-table proof cases.

`npm run test:poker:multitable` generates fresh synthetic fixtures, opens three table views in Chromium, exercises their replay controls and checks delayed responses. It also checks the SSRCR literature at desktop and phone widths. Install the locked Playwright Chromium browser first, or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to an existing compatible browser. The script prints its temporary screenshot directory. The browser check is part of the existing `browser-ui` CI job.

`supabase/tests/poker_multitable_replay_rollback.sql` is the hosted four-table regression. It requires eight existing Auth identities as foreign-key-backed fixture seats and rolls back all test changes. It does not change those identities or their balances. The final result reports success only after all assertions pass and the test transaction is rolled back.

The user-facing Fairness Manifesto describes supported practice-poker protections, the exact visible-card verification input and the limits of commitment verification. Poker's full shuffle seed remains private so folded opponents' cards cannot be reconstructed.
