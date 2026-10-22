# Android direct-APK testing

Owner direction, 2026-10-21: bypass Google Play for now and work on a directly installable APK. Play Console, Play App Signing and store submission are not prerequisites for the current private APK test. This document does not approve public distribution.

Current source uses the owner-approved `com.imperialgaming.app` / **Imperial Games**
identity. The retrieved build below is historical and retains its original provisional
identity. See [current signing readiness](ANDROID_SIGNING_READINESS.md).

## Retrieved build

- Source commit: `b7d1a6a761f7c9ace4089c9d2a950d7b818b878f`.
- Workflow run: https://github.com/imperialgames2026/ig-games-repo/actions/runs/39585935779
- Build artifact ID: `12340160305`.
- Artifact: `imperial-games-android-b7d1a6a761f7c9ace4089c9d2a950d7b818b878f`.
- Archive SHA-256: `abef6449b1eb03b3cca597ef6496ffa5419d30e59be3dc8284f913a8a4fa57e1`.
- APK in the artifact: `imperial-games-practice-debug.apk`.
- Owner download filename: `Imperial-Games-Practice-Test-b7d1a6a.apk` (renamed without changing bytes).
- APK size: `6495744` bytes.
- APK SHA-256: `8c027c337c5114b5f85648df71512adead3199cb89501ca844c9b4a96018dc73`.
- Application ID: `com.imperialgaming.practice.dev` (provisional development identity).
- Application name: `Imperial Games Practice DEV`.

The downloaded build archive matches GitHub's recorded SHA-256 digest. All five entries in its SHA256SUMS were checked and matched. The embedded Capacitor configuration and release metadata match the external build metadata: bundled assets, no server.url, canonical backend `qonqemhljgxlwpghkxhn`, practice mode, disabled legacy operations, 100 migrations and 23 held games. The APK was not rebuilt, re-signed or modified during retrieval.

## Native smoke evidence

The three downloaded result.json files report `passed: true` for the same source commit:

| CI device profile | Artifact ID |
| --- | --- |
| Small phone | 12339576223 |
| Large phone | 12340695377 |
| Tablet | 12339686133 |

Each smoke archive was checked against the corresponding GitHub artifact digest. Each result records these four checks:

1. Bundled React login renders inside the native Capacitor WebView.
2. Unapproved recovery is rejected without a hosted Auth mutation.
3. Background/resume returns to the bundled login.
4. Bundled login reloads without connectivity.

These are emulator smoke checks, not physical-device certification, full game acceptance, or successful hosted authentication. Each result explicitly records `hosted_auth_acceptance: false` and `publication_approved: false`. Screenshots were retained as evidence; the small-phone login screenshot was visually reviewed.

## Private test installation

Use only the debug APK for this initial test, not the unsigned release APK or the AAB. Download it to the Android test device, open the file, and permit installation from that specific browser/file application if Android requests it. Do not disable Play Protect or device security globally. Keep testing to dedicated practice accounts and never supply server/admin keys.

Native signup and email recovery are intentionally disabled. Existing password sign-in still requires hosted acceptance; it has not been demonstrated by the smoke tests. Real-value features remain disabled. Dependency audit findings, including a reported critical finding, are unresolved; this is not a production security sign-off.

If Android reports a conflicting package/signature, record the error rather than erasing app data or uninstalling an existing installation as a workaround. A temporary CI debug certificate is not the durable release/update identity.

## Direct release gates (no Google Play dependency)

Before a public website download, finish native authentication and role/game/lifecycle/accessibility acceptance, review dependency vulnerabilities, reconcile the shared web/mobile baseline, obtain owner approval of the permanent app ID, and use a securely backed-up owner-controlled release signing key. Verify the signed artifact and its certificate fingerprint, preserve version/signing continuity and previous artifacts, then obtain private tester acceptance and publication approval. Do not silently use the debug key for production.

No keystore, signing password, compiled APK/AAB, customer data or server credential is committed by this document. The uploaded old Wix/React Native binaries are not the source of this APK. No hosted Auth/database, domain, payment or release-signing setting was changed.

References:
- https://developer.android.com/distribute/marketing-tools/alternative-distribution
- https://developer.android.com/studio/publish/app-signing
- https://developer.android.com/tools/apksigner
