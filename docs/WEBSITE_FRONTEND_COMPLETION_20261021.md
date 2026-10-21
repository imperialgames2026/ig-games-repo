# Tester-chip website frontend

Completed October 21, 2026 (America/New_York) in the working draft. This pass
implements website changes; it does not deploy or publish the site. The original
Imperial Games artwork, dark palette, pink/purple accents and gold details are retained.

## What is finished

- **Home and discovery:** a branded landing page with the original artwork,
  featured games and clear poker/account entry. The game library has one
  collection of 20 approved practice descriptions, search, category filters,
  persistent filter URLs and a useful no-results state. Signed-in game entries
  require matching active, practice-only records; failed catalog reads have
  a retry state and do not enable unconfirmed games. Held routes stay held.
- **Poker entry:** visitors can browse the lobby before signing in. Hold’em and
  Omaha entries, room IDs and pasted invite links lead to the correct internal
  table route and retain the intended room through sign-in. Invalid invites,
  event loading/failure/empty states, registration success, unassigned seating
  and read-only accounts have distinct messages. A failed list refresh does not
  erase a confirmed registration.
- **Account and recovery:** branded sign-in/signup screens, confirmation fields,
  password visibility, accessible labels and busy states. Recovery explains
  missing/expired links and offers a direct way to request another. Real local
  signup, sign-out and replacement-password authentication were checked.
- **Profile and support:** recoverable profile-loading failures, keyboard avatar
  controls and clear form labels. Support has loading/error/retry/closed-ticket
  states, guards stale conversation responses, keeps the same idempotency ID on
  an unchanged uncertain retry, and preserves saved-success feedback when the
  following list refresh fails.
- **Navigation and accessibility:** consistent dark controls regardless of OS
  theme; predictable mobile tabs; Escape/outside-click menu dismissal; route
  titles, heading focus and scroll handling; visible keyboard focus; reduced-motion
  support; branded page-loading and account-verification states. Missing links
  retain site navigation and offer recovery paths instead of an internal error page.
- **Tester guidance:** room-owned starting stacks, reconnects, free timebanks,
  host/hand controls and account eligibility are explained in a usable guide.
  Financial URLs remain informational aliases without purchase, deposit,
  withdrawal, transfer, redemption or paid-extension forms.

## Verification

| Check | Result |
| --- | --- |
| Explicit lab frontend build | Pass, `npm run build:lab`; output in ignored `dist-lab/`. |
| Offline regression suite | **187 passed**, no failures or skips. Includes invite parsing and preserved authorization/fairness/backend-packaging guards. |
| Built-site desktop/mobile browser suite | **100 passed**, retries disabled. Includes search/filter persistence, catalog failure/retry, sign-in gates, account/support contracts, poker invites/registration states, 320px navigation, finance aliases, keyboard focus and interrupted page recovery. |
| Additional browser contracts | **17 passed**: profile/name/avatar behavior, read-only role restrictions, Originals results, saved predictions, Mines secrecy and substituted-proof denial. APIs were intercepted locally. |
| Real disposable local services | **32 distinct authenticated checks verified**: 29 existing cases passed in the first batch, one updated guide-copy assertion passed on targeted recheck, and two extra real signup/sign-out/recovery cases passed. This is not described as one clean 32-case batch. |
| Visual checks | Desktop and phone Home, Games, Poker, Tester Chips, sign-in and 404 pages showed no horizontal overflow or page errors; 320px checks are included in the browser suite. |
| ESLint, whitespace, consolidation | Pass. All 301 original frontend mappings and 22 exact-byte reference documents remain accounted for. |
| Full typecheck | Still fails on inherited project typing debt. The new navigation focus typing issue found during this pass was corrected; no checks were disabled. See the machine-readable report for the observed count. |

The initial catalog-error browser fixture used a retryable server status and
outlived its assertion timeout. It now models a missing/unexposed catalog with
404 while retaining the complete error → retry → empty assertions. The final
100-case run passes with retries disabled. The authenticated guide test now
checks the updated “a new seat starts” copy without changing its wallet or poker-link assertions.

## Local review and boundaries

The real local test stack was restarted through the existing isolated helper:
98 generated migrations and 21 practice handlers, real Auth, Storage, REST and
Edge Runtime. It remains a disposable local environment, with schedules and
Realtime disabled. The local website can be started with:

```sh
npm run test-site:backend
npm run test-site:dev
```

That workflow forces local connection settings even when hosted settings exist
in the shell. Start commands must be rerun after an environment restore; live
processes do not survive a snapshot. See [the local workflow](LOCAL_TEST_SITE.md)
for the build and authenticated-test commands.

This work does not establish hosted email delivery, hosted schema/function
parity or hosted poker readiness. Those are separate from the finished website
pass. The existing poker engine still uses the documented manual street/showdown
and host-next-hand controls. Bot provisioning, tournament lifecycle/load work,
hand archival ingestion and the 23 held games are not newly claimed complete.

No hosted accounts, bots, schema, functions, Auth settings, provider operations
or hosting settings were changed. Earlier changes were preserved and no
application changes were pushed or published.

## Evidence

- [Website validation and build report](reports/website-frontend-20261021.json).
- [Real local service results](reports/website-real-services-20261021.json).
- Current logs: `/tmp/ig-website-public-final.log`, `/tmp/ig-website-offline.log`,
  `/tmp/ig-website-contract.log`, `/tmp/ig-website-build.log`,
  `/tmp/ig-website-real-auth.log`, `/tmp/ig-website-real-auth-onboarding-recheck.log`
  and `/tmp/ig-website-real-account.log`.
- Visual artifacts: `/tmp/ig-website-desktop-home.png`,
  `/tmp/ig-website-mobile-home.png`, `/tmp/ig-poker-mobile.png` and
  `/tmp/ig-poker-guide-mobile.png`.
