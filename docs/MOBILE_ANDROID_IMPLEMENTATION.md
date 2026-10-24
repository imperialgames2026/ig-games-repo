# Android practice shell — implementation branch

Base source: `1a58d9064775297b297bacbc6de6a5beae21cf05` (PR32 merged).
Backend remains `qonqemhljgxlwpghkxhn`; practice-only, 23 games excluded.
This branch is **not** a signed APK or release-ready native application.

## Permanent identity

Owner-approved package: `llc.imperialgaming.games`; display name: **Imperial Games**.
This installs separately from `com.imperialgaming.practice.dev`; existing app data
is not automatically transferred. Keep the development installation and its data.
No conflicting registration was found in repository configuration. Play Console
availability and external registrations have not been verified.

Nathan retains his existing signing key; Doodle coordinates exact-candidate review.
See [signing readiness](ANDROID_SIGNING_READINESS.md). Identity approval does not
approve signing, distribution or hosted callback changes.

## Capacitor 8 toolchain

Node 22+, Android Studio 2025.2.1+, Android SDK API 24+; Capacitor 8
targets API 36. The supported Capacitor major is 8 as inspected on
2026-10-21. Pin matching patch versions across core, CLI and Android
when first installing, then commit the generated lockfile.

## Local shell setup (isolated feature branch only)

```bash
npm ci
npm install --save-exact @capacitor/core@8 @capacitor/android@8
npm install --save-dev --save-exact @capacitor/cli@8
# Review exact resolved versions and commit package-lock.json.
VITE_SUPABASE_URL=https://qonqemhljgxlwpghkxhn.supabase.co npm run build
node scripts/verify-mobile-bundle.mjs
npx cap add android
npx cap sync android
npx cap open android
```

Never set `server.url`: ship bundled `dist` assets, not a live-hosted webview.
Do not store service-role credentials, signing keys or customer data in app.
Do not approve hosted callback changes or expose actual money movement.

## Mandatory blockers before even private distribution

- Validate full merge-head CI and hosted compatibility/readbacks on exact SHA.
- Review native Auth callback host/path validation, cold/warm entry, session
  refresh, reset-password, logout and isolated backend tests.
- Prove Android debug emulator launch, offline and background/resume behavior.
- Check safe areas, back button and accessibility, practice-state idempotency.
- Verify private signing custody and separately approve exact callback changes.
- Confirm the generated Android project and package lockfile are committed.
- Run Android CI and save APK SHA-256, version, source SHA and acceptance matrix.

Do not install packages, create a native project or sign/publish any
artifact by treating this document alone as evidence that those steps passed.
