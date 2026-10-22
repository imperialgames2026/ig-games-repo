> Identity update, October 22: current source uses owner-approved `llc.imperialgaming.games`
> and **Imperial Games**. Identity decisions below describe the earlier checkpoint;
> signing and publication remain separate gates. See [readiness](ANDROID_SIGNING_READINESS.md).

# Mobile daily checklist execution — October 21, 2026

Source: owner's uploaded `Pasted text(20261021-161936).txt`, SHA-256 `d51d8adc21c61e1b706bf2fbc3e5a3e8a9365bc9ecfa1c57b2485a95e0f0635f`. This is an execution record, not a replacement for the owner's daily checklist.

Target: fully tested and accepted PRIVATE Android APK October 31; stabilization November 1–7. Play internal follows APK acceptance. iOS is future preparation, not an Android blocker or third codebase. Public stores are not the Halloween milestone.

## Settled decisions — do not ask again

New identity separate from Wix; Nate owns the signing key; private APK first; wallet-credit reward redemption unavailable until Nate initiates it. Doodle coordinates signing/readiness, but protected storage is not configured and applicable specific credential-setup/signing/distribution approvals remain mandatory. Do not place private signing material in chat, source or artifacts. Do not create a duplicate Play account.

## October 21 engineering

- PR35 `24b1463` is integrated into the latest PR34 `d55971a` source with both histories retained. The only shared changed file was the Android workflow; preserve the newer isolation tests and add the source-state regression suite.
- Removed unused dependencies and added the full-source cleanliness check from PR35. The generated package lock is reused, not hand-edited.
- Added an exact-lock dependency inventory with source SHA, lock hash, advisory links, affected nodes and remediation hints. Development-only installation does not establish runtime nonapplicability; no finding is waived. Collection success is NOT security acceptance.
- Six inventory unit tests, YAML parsing, shell syntax and minimal-workflow-diff assertions passed locally. Full builds/native tests must be verified remotely on the new integration SHA before recording completion.
- Previous native evidence remains attached to d55971a. Newly running or skipped native jobs must not be described as passing.
- Main remains `6be0f674`; its PR33 enables wallet-credit reward draw paths. Reconcile with the disabled-redemption decision before importing those changes or freezing a shared web/mobile release. Main and hosted services are not changed by this integration.
- Permanent identifiers remain technical finalization; do not publish `com.imperialgaming.practice.dev` as the final app. No owner keystore is accessed and no release signing/publication is performed.

Today's DONE WHEN remains open until the exact permanent identifiers, reconciled source and reproducible APK outcome are recorded. Full native Auth/device acceptance, intended visual presentation and exploitable-dependency remediation are still open; smoke tests do not substitute for them.

## Next dated gates from the owner's checklist

October 22: current-candidate native cold launch and device/tester arrangements. October 23: approved isolated native confirmation/recovery, signup/login, refresh/logout, expiry and account isolation. October 24: shared contracts, navigation/game journeys, privacy/support and acceptance scope. October 25: physical phones/tablets, lifecycle, connectivity, keyboard/safe areas/back/rotation. October 26: included games, balances/history/settlement/permissions and no duplicate actions/credits. October 27: exploitable dependency/privacy/security issues and accessibility. October 28: freeze, checksum/regression and recovery rehearsal. October 29: named owner acceptance of clean installs/upgrades. October 30: exact-candidate review and specifically approved signing/distribution request with GO/NO-GO. October 31: authorized private delivery and verification/monitoring. November 1–7: the owner's stabilization checklist; unresolved functional/regulatory work stays blocked.
