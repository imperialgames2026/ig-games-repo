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
