# Mobile release hardening

This narrowly scoped follow-up is based on PR34 commit
`b7d1a6a761f7c9ace4089c9d2a950d7b818b878f`. It does not update the active owner's
branch, reconcile main's reward changes, switch Auth modes or approve publication.

Android run 39585935779 succeeded on that base: web regression, debug/unsigned
release build and small-phone/API35, large-phone/API36, tablet/API35 native smoke.
Those are base-commit results, not native acceptance of this follow-up.

## Changes

- Remove unused direct dependencies jspdf, html2canvas and react-quill. No source
  imports/references were found across the checkout. This removes the critical
  jspdf finding and its unused PDF/editor dependency chains without replacing UI.
- Require clean committed source before stamping mobile release metadata.
  Previously only package files and android/ were checked, allowing unstaged,
  staged or new React files to be bundled under an unrelated clean commit SHA.
  All tracked changes and nonignored untracked files now stop the build.
  Ignored generated output remains allowed. Build in a clean isolated checkout.
- Add regression tests using disposable Git repositories and include them in
  Android's secret-free web-regression job. No CI permission or branch allowlist
  expansion is made.

## Local validation

- Locked dependency installation succeeded.
- 28 mobile tests passed, 0 skipped; includes four source-state tests.
- 141 application Node tests passed, 0 skipped.
- Production Vite build passed.
- npm audit changed from 67 findings (1 critical, 32 high, 31 moderate, 3 low)
  to 62 (0 critical, 32 high, 27 moderate, 3 low). Remaining findings are not
  waived or assumed harmless. Dependency release review remains open.

## Required reminder to Nathan

Before moving from test/mock mode into real authenticated mode, confirm permanent
app identity, signing owner, distribution channel and reward-redemption scope.
Repeat before publication for any unresolved decisions. This reminder does not
authorize credentials, hosted callback edits, signing or publication.

No hosted changes, transactions, real funds or customer-data imports occurred.
The 23 deferred games remain excluded. Continue full native Auth/lifecycle/game
acceptance and reconcile PR33 through PR34's owner before a mobile release.
