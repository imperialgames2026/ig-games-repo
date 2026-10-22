# Android identity and signing readiness

Permanent package: `llc.imperialgaming.games`. Display name: **Imperial Games**.
Current source version is `0.3.0-private` (code 3). APK-first testing and reward redemption
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
previous identifiers; no automatic data migration occurs. The earlier authorized candidate was
0.1.0-practice, code 1; that is a historical record, not the current version. No public distribution or production readiness approval.
Signing tooling may consume the existing protected local configuration temporarily;
no credentials belong in this repository. Record the actual signed artifact and
certificate evidence separately from source-only signing/publication gate metadata.

## Explicit unsigned preparation

`npm run android:release:unsigned` passes `-PimperialUnsignedRelease=true` to
Gradle. In that mode the build skips reading `android/key.properties` entirely
and cannot configure this project's release signing from that file, even when it
exists. Do not move, rename, delete or alter owner signing files to build unsigned.
Use a clean isolated checkout without external signing init scripts or other
configuration injections. Verify the resulting artifact is unsigned before handoff.

The ordinary Gradle release path is intentionally unchanged: when an existing
valid owner-local properties file is present it selects release signing. It is
therefore not an unsigned-only operation and needs signing authorization. This
change supplies no signing or publication approval and creates no key.

For every candidate, record its actual manifest version, source commit, APK digest
and (if separately authorized and signed) public certificate fingerprint. Current
source version 3 does not prove a version-3 artifact is installed or accepted.
Retain version-1 and version-2 records with their original source/checksums.
