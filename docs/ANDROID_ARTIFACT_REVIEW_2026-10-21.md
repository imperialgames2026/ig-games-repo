# Uploaded Android artifacts: inspection and source-control decision

Inspected 2026-10-21. Static archive inspection only; neither package was installed,
executed, signed, published, or treated as evidence that PR #34 is release-ready.

## Files supplied by the owner

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `android(1).apk` | 146486917 | `3c19f7f022f27134805af97cc3d718140d80e1e9aaec6706b47e181d8acc2dee` |
| `android(1).aab` | 139977736 | `182add57f1cc7759ed5800ab91be0715ce1fe86b831589439f1ddb976d771ea3` |

The APK's binary Android manifest identifies:

- Package: `com.base697dc67abbb768c5bbbab5d5.app`
- Application class: `com.wix.WixApplication`
- Version name/code: `2.115978.0` / `2`
- Minimum/target Android SDK: `26` / `36`

Both archives contain `index.android.bundle`, Hermes bundles, Wix assets, and
native React Native libraries. The AAB manifest contains the same package ID,
and its `base/assets/index.android.bundle` is byte-for-byte identical to the
APK's `assets/index.android.bundle`. No filename containing `capacitor` was
found in the APK archive. These observations identify a different native
packaging stack; they do not prove runtime behavior or backend compatibility.

## Decision

Do not commit these compiled packages into the React/Vite source tree or copy
them into `public` / `dist`. They are not needed to repair the Cloudflare build
or to build the new Capacitor shell. Both exceed GitHub's 100 MiB regular-Git
file limit. Keep the originals in owner-controlled artifact storage; any
future distribution should use a separately reviewed release/artifact channel.

Record their identity and checksums here for migration reference. Do not adopt
the old application ID, signing identity, or embedded runtime as the new app
without reviewing ownership, update continuity, and source provenance.

The `.gitignore` additions prevent accidental commits of APK/AAB/APKS output,
local signing keystores, and generated Android build directories. They do not
remove any existing tracked files or change hosted services.

Reference: https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github

## Cloudflare build repair

The failed source SHA was `02faca50855f3d8319a80aa079ce6c3edda6755b` on
`feature/android-capacitor-practice-shell`. An earlier edit wrote literal
`\n` characters instead of line breaks into `pages/Login.jsx`. The resulting
line comment swallowed the native guard and recovery condition, leaving an
unmatched `else`. The Android workflow had the same escaped-newline defect.

Repair: restore actual line breaks in both files. Preserve browser Auth behavior
and the native email-callback restriction; do not change hosted Auth redirects.
Add a separate, secret-free CI job for source compilation and mocked Auth
regressions before the secret-gated APK job.

Local verification used Node 22.16.0 and TypeScript 5.8.3: all 14 regression tests
passed. YAML parsing, shell syntax, missing-key rejection, and configured-key
acceptance also passed. The original files reproduced parser failures.
These checks are not a successful full Vite build, emulator run, hosted login
test, or Cloudflare deployment. Those results must be checked separately on
the resulting commit. No dependency upgrades or backend writes are part of
this repair.
