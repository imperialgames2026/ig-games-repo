# 3D practice verification — October 23, 2026

The tested flow is React practice controls → immutable local outcome → Unity Web presentation → completion telemetry, with independent local practice-chip settlement.

| Boundary | Evidence |
|---|---|
| Local rules | Eight Node tests pass: immutable messages, rejection sampling, single-zero pocket list, pass-line transitions, payouts and manifest validation |
| Existing app regression | All 167 npm tests pass after reconciling main 39eebb4 |
| Web build | Vite production build and targeted ESLint pass |
| Lightweight 3D | Chrome desktop 1280×900, portrait 412×915 and landscape 915×412: roulette and craps rounds, no page errors and no horizontal overflow |
| Unity build | Unity 6000.3.6f1 WebGL release export succeeded on Mini-Imp |
| React → Unity | Actual runtime emits ready and completion events for both game types; re-entry preserves balance/history with no errors |
| Failure recovery | Missing manifest falls back to playable lightweight 3D; early exit while loading no longer produces a removed-canvas error |
| Wallet separation | No wallet/API/database call in prototype; visual callbacks do not settle chips |
| Android package | Debug APK assembled successfully from source 325cc854005afe04db534b9c6f7e958c55a5a5f0 after merging main 39eebb4; existing release guard passed unchanged |
| APK contents | Original app ID llc.imperialgaming.games; all embedded Unity asset SHA-256 values match the tested build; both practice entry and frame are present |
| Android device | ADB did not list a connected phone during the checks; physical device performance is unverified |

Source and runtime are isolated from current production game routes and Android signing files. The prototype supports roulette straight-number/outside bets and craps pass line only. Screenshots were inspected and used to correct lettering orientation, table framing and stripped primitive-mesh errors. This report does not claim that all Imperial Games titles have been converted, or that production deployment or physical Razr performance has passed.

The isolated debug APK is 13,247,627 bytes. SHA-256: `156fa04a167dade615a8b0449893e0258b2a2f27681aa1c00cfe44a42c5fcc88`. It was built without installing it on a phone or changing production signing configuration. The earlier 101-versus-104 migration packaging block was resolved by incorporating the newer main release guard, rather than modifying that guard in the prototype.


## Interactive felt revision

Replaced the separate betting card with a wager input and native table hit testing. Repeated taps aggregate chips without a placement-count cap; Clear refunds the current reserved bets and Undo removes only the latest placement. Bet templates persist and reserve fresh stakes between rounds; underfunded templates pause. Craps contracts remain reserved until resolved, with queued Clear. Added enlarged branding without LLC, extra chip banks, pass-line conditions/payouts, colored roulette outside fields, zoom and a fixed action dock.

Unity was freezing when controls outside its frame received focus. `runInBackground` now permits those controls while document visibility explicitly pauses hidden pages. Completion gates reopening the table, with outcome/payout logic remaining in React. New browser checks use actual projected felt taps and observe changing native wheel angles and dice positions, plus mid-action screenshots. Both renderers passed at desktop and 412×915 layout. All 172 unit tests, targeted component lint and production build passed. Updated runtime uses the v2 asset directory to avoid cached v1 content. The earlier APK evidence above applies to the previous build; this visual revision has browser verification and is not installed on a physical phone.

## Existing multiplayer phone layout correction

The phone screenshot showed `MultiplayerPracticeTable`, not `/TableLab`. Its mobile fixed-height cockpit allowed nonshrinking controls to squeeze the felt into a clipped banner. Scoped multiplayer overrides now preserve the table's natural height, permit document scrolling, and keep the roulette grid horizontally scrollable with touch-size number fields. Roulette's closed-betting status now refers to the wheel instead of a craps shooter. This does not connect local Unity outcomes to multiplayer settlement.

`npm test`: 172 passed. Production build passed. A browser fixture renders the actual roulette felt with the built production CSS and 420px of controls: at 412×915 the felt remains 486px high; at 915×412 it remains 436px. Both preserve at least 240px for the board, position controls below it, and avoid page-wide horizontal overflow. Run `npm run build` then `LAB_CHROME=/usr/bin/google-chrome node tests/rouletteMobileLayout.browser.mjs`. This is layout verification, not an authenticated phone session or deployed APK verification.
