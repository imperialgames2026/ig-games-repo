# Android identity and signing readiness

Permanent package: `llc.imperialgaming.games`. Display name: **Imperial Games**.
Version remains `0.1.0-practice` (code 1). APK-first testing and reward redemption
disabled remain the approved scope. Historical APK reports retain their original IDs.
This package installs separately from the old `.dev` application and does not
update or automatically migrate its local data. Do not uninstall it as a workaround.
Repository configuration has no conflicting registration; Play availability is unverified.

Nathan owns the existing key, reportedly alias `imperialgames`, at
`/home/imperialist85/AndroidSigning/imperial-games-release.jks`. This change neither
reads nor replaces that key and does not configure release signing. Keep private
material and local key properties outside Git, chat and build artifacts.
Doodle coordinates readiness review; a specific signing operation still needs
Nathan's approval.

Before requesting that approval, record:
- Exact source commit, clean source status, package, version and unsigned APK SHA-256.
- Exact-commit tests, compiled manifest and embedded bundle verification.
- Native authentication, physical-device, visual/accessibility and private acceptance results;
  isolated emulator smoke does not establish hosted authentication acceptance.
- Reviewed dependency findings; passing inventory is not security release approval.
- Confirmation of Nathan's protected key storage and backup; public certificate SHA-256
  and alias verification through his local tooling, without sharing passwords or key files.
- The precise artifact, signing action and destination being approved. Publication remains
  a separate decision; Play internal testing follows private APK acceptance.

No release key was generated, imported, read, copied or used by this identity change.
No hosted Auth settings, permissions, backend configuration or redemption behavior changed.

## Owner-authorized local signing candidate

Nathan confirmed `llc.imperialgaming.games`, superseding the earlier
`com.imperialgaming.app` decision, and authorized a local signed candidate using
his existing key/configuration. This new package installs separately from both
previous identifiers; no automatic data migration occurs. Version remains
0.1.0-practice, code 1. No public distribution or production readiness approval.
Signing tooling may consume the existing protected local configuration temporarily;
no credentials belong in this repository. Record the actual signed artifact and
certificate evidence separately from source-only signing/publication gate metadata.
