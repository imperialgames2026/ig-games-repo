# 3D practice verification — October 23, 2026

The tested flow is React practice controls → immutable local outcome → Unity Web presentation → completion telemetry, with independent local practice-chip settlement.

| Boundary | Evidence |
|---|---|
| Local rules | Eight Node tests pass: immutable messages, rejection sampling, single-zero pocket list, pass-line transitions, payouts and manifest validation |
| Existing app regression | All 162 npm tests pass |
| Web build | Vite production build and targeted ESLint pass |
| Lightweight 3D | Chrome desktop 1280×900, portrait 412×915 and landscape 915×412: roulette and craps rounds, no page errors and no horizontal overflow |
| Unity build | Unity 6000.3.6f1 WebGL release export succeeded on Mini-Imp |
| React → Unity | Actual runtime emits ready and completion events for both game types; re-entry preserves balance/history with no errors |
| Failure recovery | Missing manifest falls back to playable lightweight 3D; early exit while loading no longer produces a removed-canvas error |
| Wallet separation | No wallet/API/database call in prototype; visual callbacks do not settle chips |
| Android package | Existing mobile release guard stops packaging: expected 101 migrations, current manifest has 104. Guard unchanged; no APK produced |
| Android device | ADB did not list a connected phone during the checks; physical device performance is unverified |

Source and runtime are isolated from current production game routes and Android signing files. The prototype supports roulette straight-number/outside bets and craps pass line only. Screenshots were inspected and used to correct lettering orientation, table framing and stripped primitive-mesh errors. This report does not claim that all Imperial Games titles have been converted, or that production deployment or physical Razr performance has passed.
