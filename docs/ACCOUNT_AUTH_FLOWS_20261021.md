# Account flow changes — October 21, 2026

Release baseline: `6be0f674c103e789dbfa3fc08e1ed97fd4650940` (PR 33).
Work branch: `fix/account-auth-flows-20261021`.

## Problem and resulting behavior

The account UI lacked a confirmation-email resend journey and password confirmation at signup. Failed email callbacks could land on the homepage without a useful explanation. Supabase preserves an existing session when an incoming callback is invalid, so a failed recovery link also needs to take precedence over a signed-in password form. Account changes and sign-out need to clear cached private query results.

- Signup checks matching passwords, retains the email for confirmation/resend, and avoids claiming that an account was newly created when the Auth service may have returned an intentionally ambiguous result.
- Unconfirmed sign-in offers confirmation resend. Sign-in does not enforce the new-password minimum on existing accounts.
- Resend and recovery use the existing web callback destinations: the current origin for confirmation and `/ResetPassword` for recovery. Email requests have duplicate-submit protection and a 60-second UI cooldown; Supabase's server rate limits remain authoritative.
- Invalid, expired and reused links show a fixed message, never arbitrary callback URL text. An invalid recovery link cannot display the password-update form using an unrelated existing session. Users can request another link or explicitly continue using their existing account.
- Password updates display the account email, confirm the password twice and recheck the current identity before submitting. A normal signed-in account may also use this page to change its own password, as in the existing flow. Same-account Auth refresh/update events preserve the form and success message; account switches clear the form.
- Sign-out, identity loss and account switches clear the shared query cache. Canonical profile/role checks, server authorization and RLS remain authoritative.
- Post-login navigation accepts internal paths and retains their query/hash, while rejecting external and protocol-relative destinations.

## Verification recorded for this branch

| Check | Result |
| --- | --- |
| Full offline `npm test` suite | 150 passed, 0 failed |
| ESLint on changed application files | Passed |
| Vite production build | Passed; existing browser-data freshness warnings |
| New browser test file syntax and `git diff --check` | Passed |
| Eight new controlled-API browser scenarios | Written; execution pending |
| Existing real local Auth recovery/sign-in integration | Execution pending on this branch |
| Hosted email delivery and real confirmation/recovery links | Pending SendGrid setup |

The new browser scenarios cover signup confirmation/resend, unconfirmed login, recovery cooldown/callback, failed confirmation callbacks, failed recovery with an existing session, password-update success, account switching and sign-out cache isolation. They use intercepted API fixtures and do not create hosted users or send email. Existing CI discovers the file through `playwright.migration.config.mjs`; the helper tests are included in `npm test` and the build workflow.

Local browser verification was not completed: automatic approval review blocked the browser-install follow-up because the usage allowance was exhausted. The review reported a usage/review failure, not an unsafe-action determination. No alternative installation or browser execution was used to bypass that block. Do not treat this document as browser or release sign-off.

## Remaining launch acceptance

The first PR run exposed a separate CI environment failure: [browser job 119343846797](https://github.com/imperialgames2026/ig-games-repo/actions/runs/39635249779/job/119343846797) resolved `ubuntu-latest` to Ubuntu 26.04 and failed during Chromium installation with `Playwright does not support chromium on ubuntu26.04-x64`. No browser scenario executed in that job. All five browser-running jobs are now pinned to Ubuntu 24.04, supported by the locked Playwright 1.57.0 dependency. No test step is skipped or relaxed. This establishes the cause of this CI failure, not the cause of an earlier Codex environment problem.

Run the new browser scenarios and the existing real local Auth suite on the exact candidate SHA, then review their results before merge. Resume SendGrid only when Nate is ready; verify the sender and actual delivery and test fresh, expired and reused links end to end. Agree the mobile callback contract with the app workstream; this change configures no new native redirect.

This change contains no SQL migration, Edge Function deployment, hosted Auth setting, customer-data import or payment/provider operation. The selected backend remains `qonqemhljgxlwpghkxhn`; the older project and held games remain untouched. Three reward-wheel pools remain paused pending their approved prizes and funding rules.
