# Main-site backend publication acceptance

Release base: `0d32d24a863026e3eff36dec0ea663d3fb9e2ff6`. Selected backend: `qonqemhljgxlwpghkxhn`. The older project is excluded. No customer data import, payment execution, Auth credential change or blanket access grant is part of this release.

## Reconciled deployment inventory

The published site had 108 packaged migrations while hosted history had 107. These were different sets: three KYC migrations from PR51 were pending, and two slot migrations from another branch were already deployed but absent from main. The missing slot function is also already deployed. This release records those actual sources without importing the slot frontend or reapplying their SQL. The first slot migration uses the exact recorded statement formatting; the branch copy differed in formatting inside function definitions.

All 107 hosted identities match the reconstructed canonical SQL checksums. All 32 function bodies were inspected. Thirty match the recorded implementation (three legacy files differ only by one terminal newline); KYC and the slot release guard are the two planned function updates. Existing JWT modes are preserved, including the separately signed machine webhook.

Four pending SQL files are explicit in the manifest: KYC profile lifecycle, retention reconciliation, fair retry, and `20261024005531_preserve_owner_held_game_scope`. The proposed package has 111 migrations and 32 functions. No unknown-history guard is bypassed.

## Release behavior

- Customer KYC profile status follows actual submission, cancellation and expiry. Private review pages retain authorization, bounded pagination and redacted internal reservation fields.
- The KYC handler fully decodes bounded images and uses the reviewed 4MP limit. Retention retries yield fairly; minimal tombstones keep late objects eligible for later deletion without repeating the original deletion audit.
- The owner's 23 held routes remain held. A separately activated 13-slot catalog is returned to inactive, with a database constraint and both Edge/RPC checks preventing play. Prototype code and practice history are retained for the Unity overhaul. The 20 approved catalog entries, financial gates and current Unity table prototype are preserved.
- The deletion-only client runs separately from advisory comparison. On Mini-Imp it uses the existing private worker configuration through systemd credentials. Enable and verify its one-shot/timer before changing comparison to `--skip-cleanup`; this leaves exactly one cleanup scheduler. Failures produce aggregate journal records and failed-unit status, without document IDs or secrets. No external email/SMS alert destination is configured by this change.
- KYC platform acceptance derives the replay count from the verified manifest and compares the complete local migration ledger. It no longer fails merely because later approved migrations were added. Privacy checks now run for relevant PRs. Browser jobs retain all assertions and receive enough time for the observed slow Ubuntu package downloads.

## Validation and rollout

Local preparation passed 177 application tests, 12 additional privacy tests, 11 retention-client tests, five comparison-worker tests, package checksum checks, KYC platform preflight and the production build. Full isolated SQL/Auth/Storage/Edge/browser and privacy-platform results are recorded in the release PR; local preflight alone is not deployment approval or hosted acceptance.

Rollout order: recheck hosted drift; apply only the four pending SQL files with the repository's transaction/history guard; deploy only the two reviewed functions; compare source readbacks and role permissions; install and verify the separate retention scheduler; then record deployed identities and publish the verified source. Retain the previous frontend and function sources. Database recovery uses reviewed forward fixes; do not erase migration history or restore over live data. A function rollback must preserve retention v2 routing and the held-game guard.

## Remaining full-launch gates

This remains a practice release. Authenticator PR40 is being reconciled independently and is not activated here. Hosted Auth configuration, callback allowlists and email delivery require verification; the secure dashboard sign-in was not completed. No password, OTP or credential was requested in chat. Lost-factor recovery operations, approved reward-pool configuration, provider/payment execution and external support/monitoring delivery are not certified by this publication. Existing paused programs are not represented as complete business features.

The final release PR records the immutable tested source, actual deployment versions, public-domain verification and any remaining failed or unrun checks.
