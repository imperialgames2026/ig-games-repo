# Android permanent identity and owner-controlled signing — 2026-10-22

## Permanent identity

The permanent Android application identifier for the new Imperial Games app is:

`llc.imperialgaming.games`

This is intentionally separate from the old Wix/React Native application and replaces the provisional
`com.imperialgaming.practice.dev` identifier. The visible Android app name is **Imperial Games**.

This identifier is treated as durable. Do not reuse the provisional ID for release builds and do not
change `llc.imperialgaming.games` after signed private distribution begins without a deliberate migration plan.

## Signing custody

Nate owns the Android release-signing key. Doodle remains the signing/readiness coordinator, but each
specific signing/distribution action requires Nate's approval. Private key material, store passwords and
key passwords must never be placed in GitHub, chat, CI artifacts, application assets or release metadata.

The repository now supports owner-local signing through `android/key.properties`, which is gitignored.
If that file is absent, CI continues to build unsigned release candidates. If it is present locally,
Gradle requires all four signing fields and verifies the configured keystore exists before attaching the
release signing configuration.

Start from `android/key.properties.example`. Replace values only on the owner-controlled build computer.

## Owner computer preparation

Preferred owner-controlled location:

`/home/imperialist85/Android/signing/ImperialGames-release.jks`

The signing directory should be owner-only. The keystore itself is not created or committed by this
repository change because its passwords must be chosen and retained privately by Nate. After local key
creation, record the certificate SHA-256 fingerprint in release evidence, not the passwords or private key.

Before any signed private APK is distributed, verify:
- package ID is exactly `llc.imperialgaming.games`;
- release versionCode/versionName and source SHA are recorded;
- APK certificate fingerprint matches the owner key;
- APK SHA-256 matches the approved release evidence;
- the same signing key is backed up securely for update continuity;
- wallet-credit reward redemption remains disabled until Nate explicitly initiates it.

This change prepares signing; it does not itself sign, distribute, publish, or enable hosted Auth/financial features.
