# Native WebView transport follow-up — October 22, 2026

Run 39730659342 built source bed9851 successfully and passed 72 mobile and 150
application/backend Node tests plus the production web build. All three native
profiles then failed before scenarios at native_webview_cdp. The bounded reports
identified an actual harness compatibility defect:

    Browser.setDownloadBehavior: Browser context management is not supported.

The downloaded large-phone failure artifact 12405208234 matched its archive digest
(d35a0f88cb58ea02b18d08719aea24b5cd85422a90c47a830327a1f298a051e2).
Pre-launch IPv4/IPv6 isolation had succeeded. No app scenario pass is claimed for
that run. This new CDP failure is separate from the older undiagnosed API36 hang.

Correction: retain bounded external ADB model/process/socket readiness and command
execution. After the installed APK's exact socket is present, enumerate the single
isolated emulator through Playwright's Android adapter, then select the verified
socket and check package/PID again. Enumeration, selection, page attachment and
cleanup have explicit deadlines. Do not use the desktop connectOverCDP entry point:
Playwright 1.57's Android adapter supplies WebView-compatible context behavior.
No private Playwright API, monkey patch, dependency update, new driver installation,
forwarding rule, firewall change or assertion skip is introduced. All nine scenario
groups, the additional confirmation-resend check, lifecycle cycles and error checks
remain mandatory. Fifty-three local handler/policy/isolation/transport tests pass;
new exact-source native validation is still required.

Primary implementation inspected:
https://github.com/microsoft/playwright/blob/v1.57.0/packages/playwright-core/src/server/android/android.ts
https://github.com/microsoft/playwright/blob/v1.57.0/packages/playwright-core/src/client/android.ts

The source-reconciliation document describes the earlier CDP attempt; this note
supersedes its transport description only. Product/authentication/release gates are
unchanged. No hosted changes, signing or distribution occurred.
