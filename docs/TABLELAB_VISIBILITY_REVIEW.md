# TableLab background-round correction (draft)

Baseline: main `0d32d24a863026e3eff36dec0ea663d3fb9e2ff6`, merged Unity PR63.
The real React page against a synthetic same-origin iframe failed the new browser
regression: after document visibility was set hidden and fake time advanced
60 seconds, roulette with auto off had one history entry instead of zero. The
old 30-second watchdog settled while hidden. Its automatic scheduling also had
no visibility guard.

The timing controller now preserves the pending round and remaining visible
watchdog time, defers hidden completion messages until resume, and rejects play
and bet callbacks while hidden/disposed. Automatic rounds restart a full
1.4-second delay after resume; no hidden elapsed time is replayed. Generation
checks reject canceled callbacks, and clearing pending state before settlement
keeps completion/watchdog races exactly once. Outcomes and settlement rules are
unchanged. Unmount discards callbacks and timers, rather than settling afterward.

Verification:
- `npm run test:tables`: 27 deterministic timing and existing practice-rule tests.
- Start Vite on loopback port 4191, then `npm run test:tables:visibility`.
  Requires Chromium (`LAB_CHROME` overrides `/usr/bin/chromium`); `LAB_URL`
  overrides the loopback URL. Four real React-page scenarios use a synthetic
  iframe, synthetic document visibility and fake browser time. All nonlocal
  requests are blocked. Roulette/craps with auto on/off preserve hidden balances,
  defer completion, and do not catch up after a hidden inter-round delay.
- Production Vite build passed. Focused source checks passed. ESLint does not
  include this JSX page in its current configuration; no JSX lint pass claimed.

This is not physical Razr or actual Unity background/resume acceptance. Remaining
acceptance: on the actual device/browser and real Unity renderer, hide mid-spin
and mid-roll for 35–60 seconds, hide during the automatic-round delay, repeat
hide/resume, switch away/unmount, and confirm presentation, audio, one settlement,
retained craps point/bets, and no unseen new rounds. Also exercise lightweight and
reduced-motion modes. No APK, signing, installation, hosted writes or credentials
were used. Footer and unrelated website changes remain unchanged. Draft only;
merge/deployment and device acceptance are separate gates.


## Additional validation

The application regression command from package.json passed 170 tests with only
`tests/kycValidation.test.mjs` excluded because it exercises comparison-result
normalization. No comparison worker or biometric suite ran. Focused visibility
regressions remained green. Review found no additional reproducible defect in
round identity, generation invalidation, reentrant completion or disposal.

The existing lightweight renderer flow passed. The existing actual Unity flow
loaded and exercised roulette but timed out selecting `Roll dice · 10 chips`.
The same command on unchanged main `0d32d24` failed at the same assertion; this is
not attributed to the timing patch and is not marked passed.

The additional opt-in `npm run test:tables:unity-visibility` uses actual bundled
Unity WASM and a 640×480 headless Chromium viewport with software WebGL. It injects
only practice bet callbacks and document visibility events; it does not mock
Unity motion or completion. All external requests are blocked. It uses real
35-second waits and requires Unity completion (watchdog-only settlement fails).
All four cases passed. It checks roulette/craps, auto off/on, paused motion and balances while hidden,
one completion after resume, and inter-round hiding without restart/catch-up.

Important limits: at 1280×1000, two attempts reached watchdog settlement without
a Unity completion, so the completion assertion failed. This may be runtime
capacity; it is not certified as fixed or harmless. The smaller viewport is an
explicit bounded test, not a performance claim. Genuine tab switching was also
probed without visibility overrides: both foreground and background tabs remained
`document.hidden=false`, `visibilityState=visible`. No DISPLAY or Xvfb is available.
Thus real OS/browser backgrounding and Razr acceptance remain blocked by this
headless-only environment and must be performed elsewhere without changing these
permissions. No denied remote access was retried.

## Reconciliation with Unity v3 and continuous multiplayer roulette

Merged main `608cc1e214fab880a5fe9c187380ce4725dca214` into the draft,
retaining v3 assets, felt hit handling, shared renderer, and continuous server
roulette. The package script conflict combines both owners' table tests.
The visibility controller is scoped to local TableLab rounds; it does not pause
or replace the autonomous multiplayer server clock. No Android diff from main.

Local merged-tree validation: 174 application tests (same explicit biometric
exclusion), 31 focused table tests, four synthetic visibility browser scenarios,
and production build passed. Dedicated exact-head Actions validation is provided
in tablelab-visibility-review.yml using a verification ref; existing workflows
and required gates are unchanged. It runs the permitted application regression
set, focused tests, build, synthetic lifecycle, actual Unity visibility, and the
shared multiplayer Unity browser fixture. CI results are recorded in the PR.
