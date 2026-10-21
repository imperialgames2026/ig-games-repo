# Mobile release hardening

Original follow-up: PR35 commit `24b1463781c41e57644ecd920ad450bac9a73873`, based on PR34 commit `b7d1a6a761f7c9ace4089c9d2a950d7b818b878f`.

## Changes carried into PR34

- Remove unused direct dependencies jspdf, html2canvas and react-quill. The original review found no source imports/references. This removes the critical jspdf finding and its unused PDF/editor dependency chains without replacing UI.
- Require clean committed source before stamping mobile release metadata. All tracked changes and nonignored untracked files stop the build; ignored generated output remains allowed. Build in a clean isolated checkout.
- Add four source-state regression tests using disposable Git repositories.
- Resolve the workflow overlap by preserving PR34's newer Ubuntu 24.04 runners, read-only permissions, designated native-build branch, pre-launch network isolation, expanded nine-scenario emulator matrix and pause/resume sequencing. Add PR35's source-state tests without reverting any of those fixes.

## Historical validation, not integrated-candidate acceptance

PR35 originally passed 28 mobile tests and 141 application Node tests, production Vite and stamped asset builds. Its native jobs were skipped. Its audit reported 62 findings: 0 critical, 32 high, 27 moderate, 3 low. These numbers are historical; obtain the new exact-lock inventory rather than assuming the registry has not changed.

PR34's previous native evidence remains attached to exact source `d55971ab0d5184045b8d68cc00869b4021f6264b`, not to this new integration. Native build and three emulator jobs must run again on the integrated source. No old green result is transferred to a new source SHA.

## Owner decisions settled October 21

The supplied daily checklist supersedes the original PR35 reminder to repeat four decisions. New identity separate from Wix; Nate retains the signing key; private APK acceptance before Play internal; wallet-credit redemption stays unavailable until Nate initiates it. Do not reopen these choices. Exact permanent identifiers remain technical finalization.

Doodle is the signing/readiness coordinator. Signing storage is not configured, and each credential-setup/signing/distribution operation still needs its applicable specific approval. Never request or commit private signing material.

Main `6be0f674` contains PR33 wallet-credit reward changes and is not blindly merged into the practice mobile branch. Reconcile that behavior with the settled disabled-redemption requirement before a shared source freeze. No hosted Auth, database, customer-data, signing or public distribution changes are included here.
