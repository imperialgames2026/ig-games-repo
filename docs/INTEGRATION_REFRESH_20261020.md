# Integration refresh — 2026-10-20

Baseline: main 599e54db02e89658e46a65b16292d741215b1a76, containing merged PR12 (4d7423b) and PR16 (cf3a9bf). PR15 is now cc974478c2291fd708d28d30b6e364d213af44bd. The prior local rehearsal 88b02bd is historical and must not be reused as the current baseline.

## Identity reconciliation

Current main has 88 recorded migrations / 28 functions: the PR13 87/27 snapshot plus 20261020162817_server_owned_mines_practice.sql and ig-mines-practice v1. All 87 shared SQL checksums and 27 shared function source checksums match PR13's snapshot.

The earlier 88/28 rehearsal instead added pending 20261019203000_payment_preparation_requests.sql and ig-payment-requests. Combining current main and PR15 would require 89 migrations / 29 functions, preserving both distinct additions, newer wallet/admin v3, originals, and all pending statuses. Payment SQL sorts before Mines. PR15 alone still lists 85/27 and cannot replace the current manifest.

PR13 now incorporates main, hashes the Mines handler, preserves the Mines SQL checksum and keeps all local-backend/browser/main checks. Existing backend-provenance.json is the historical 87/27 live readback: the added Mines source is from the reviewed merged repository, not a new live connector readback. A future full source-to-hosted reconciliation must verify it separately.

PR12 already independently incorporated the same activeChoice accessibility fix. PR14 is now regression-only against main: it expands saved prediction/reload coverage from coin to hash dice, plinko and wheel, without duplicating the implementation fix.

## Unresolved Mines findings

Both findings remain present in main and the published Mines branch cf3a9bf. Published branch/PR inspection found no newer correction; unpublished active work cannot be ruled out. No competing Mines fix was made.

- https://github.com/imperialgames2026/ig-games-repo/pull/16#discussion_r4327553555 : commitments live only in a useRef Map; accept falls back to returned state after reload. A replaced server hash plus matching revealed seed can become its own verification baseline.
- https://github.com/imperialgames2026/ig-games-repo/pull/16#discussion_r4327553567 : the submitted client seed is not bound to the retained commitment; the server-returned seed can replace it while still passing the board verifier.

Necessary owner follow-up: persist a user/round-scoped commitment before sending start, include the submitted client seed, reject changed or missing commitments for active/ended verification, and add browser regressions for reload/lost response with a substituted server hash and substituted client seed. A fresh valid board proof alone is insufficient. Do not label reloaded outcomes locally verified without this binding. Existing happy-path Mines tests do not establish those protections.

## Remaining boundaries

No live mutation, deployment, credential changes or production cutover performed. PR15's prior partial-deployment and payment retry findings also remain in cc974478. Hosted preflight credential failure and Base44 authoritative-source/export inputs remain unresolved; green local packaging is not hosted deployment proof. Recheck heads before any further integration, and coordinate the Mines follow-up with its owner.
