Target: October 31, 2026 for a fully tested and accepted private Android APK; November 1–7 for stabilization. Owner: your Android and iOS working section. Play internal testing follows APK acceptance. Public stores are not the immediate Halloween mobile priority; iOS is future preparation, not a third codebase.

# Current position and external gates

[Draft PR 35](https://github.com/imperialgames2026/ig-games-repo/pull/35) removes unused packages responsible for the critical dependency finding and corrects mobile build provenance. All 169 local tests, the mobile asset build and remote web CI passed. [PR 34](https://github.com/imperialgames2026/ig-games-repo/pull/34) passed its Android build and three emulator smoke tests. PR 35 native tests were skipped by the existing branch restriction and remain unverified until run after integration. The app is not release-ready: 32 high dependency findings and full native Auth/device acceptance remain.\
Settled October 21: create a new app identity separate from the old Wix app; Nate retains signing-key ownership; private APK acceptance comes before Play internal testing; wallet-credit reward redemption stays unavailable until Nate initiates it later. Exact package/bundle identifiers remain technical finalization.\
Nate confirmed Doodle as signing/readiness coordinator, with his explicit approval required for each release. The intended workflow presents the APK version, checksum and test evidence for explicit release approval, then uses protected signing storage. Signing access is not configured, and credential setup, actual signing and publication require their applicable specific approvals. Never place private signing material in chat, source or app artifacts.\
Nate has Google Play Console and a D‑U‑N‑S number. Verify its account type, verification and production access when preparing the later Play stage; do not create a duplicate account. Apple enrollment is future iOS preparation and is not a blocker for private Android testing.\
Future public-store availability depends on enrollment, policy compliance, testing and review. If Google's newer-personal-account rule applies, calculate its 14-day qualifying closed-test period from the actual test start; private APK testing does not establish that clock. [Google requirement](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)\
For future submissions, allow review lead time. [Google review timing](https://support.google.com/googleplay/android-developer/answer/9859654) External TestFlight first builds also require review, and beta approval is not public App Store approval. [TestFlight](https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers/)

# Daily checklist through Halloween

## October 21

- [ ] APP: reconcile draft PR 35 with PR 34 and current main; preserve PR 34's Android/emulator evidence, run PR 35 native tests after integration and triage the 32 remaining high audit findings.

- [x] DECISIONS SETTLED: new app identity separate from Wix; Nate owns the signing key; private APK first, Play internal only after acceptance; wallet-credit redemption unavailable until Nate initiates it later.

- [ ] DONE WHEN: exact permanent identifiers, source and reproducible APK build outcome are recorded. The identity direction is settled; do not accidentally publish the provisional development ID.

## October 22

- [ ] APP: install the current APK and test cold launch on small/large Android screens. Separately track Mac/Xcode access, iOS native project and simulator build as future preparation.

- [ ] NATE ACTION NEEDED: confirm Android devices/testers and access arrangements. Signing-key ownership is settled; Doodle's confirmed signing role still requires specific setup approval and protected storage, not keys in chat.

- [ ] DONE WHEN: executable native Android smoke evidence exists for the current candidate. Missing iOS build access is a future iOS dependency, not a private APK blocker.

## October 23

- [ ] APP: apply the four settled decisions before real authenticated testing; finalize identifiers and obtain any required approval for specific hosted Auth changes. Do not repeat the resolved four-decision reminder.

- [ ] APP WITH MAIN: test approved native confirmation/recovery links, signup, login, refresh, logout, session expiry and account isolation.

- [ ] DONE WHEN: real authenticated native flows pass using isolated test accounts, without client-side privileged secrets.

## October 24

- [ ] APP: reconcile shared contracts and complete core APK navigation/game journeys; prepare accurate privacy/support material. Store age ratings, screenshots and reviewer access are conditional future submission preparation.

- [ ] NATE ACTION NEEDED: review the private APK acceptance scope. Store submission scope/disclosures and publication approval come later, after APK acceptance and readiness of the chosen channel.

- [ ] DONE WHEN: a testable APK candidate and acceptance checklist exist. No public-store submission is due merely to meet Halloween.

## October 25

- [ ] APP: physical Android testing plus supported tablets; keyboard, safe areas, rotation, back navigation, offline/reconnect, background/resume and interrupted Auth. iPhone testing is future iOS preparation.

- [ ] DONE WHEN: clean-install and repeat-use critical journeys pass with device, OS and build recorded.

## October 26

- [ ] APP WITH MAIN AND LAB: verify included game actions, balances, histories, settlement and permissions against the agreed backend/poker contracts.

- [ ] DONE WHEN: no state divergence or duplicate actions/credits after retries; native testing is not substituted by browser smoke.

## October 27

- [ ] APP: resolve exploitable dependency issues; test session leakage, unauthorized access, privacy/deletion behavior and disabled legacy endpoints.

- [ ] APP: screen readers, contrast, touch targets and text scaling.

- [ ] DONE WHEN: no unresolved critical/high security or privacy blocker; nonapplicable audit findings have evidence.

## October 28

- [ ] APP: feature freeze; rebuild the private Android APK candidate from the agreed source, record its checksum and run regression. Prepare other platform candidates only for a separately ready future stage.

- [ ] APP: rehearse rollback/forward-fix and safe feature disablement.

- [ ] DONE WHEN: candidate evidence, signing custody and recovery procedures are clear.

## October 29

- [ ] NATE ACTION NEEDED: acceptance testing on clean installs and upgrades.

- [ ] APP: verify private APK acceptance evidence. Store review/production access remain separate future distribution gates, not proof of APK readiness.

- [ ] DONE WHEN: zero release-blocking APK defects and named acceptance. Play internal testing may follow full APK acceptance; public-store approval is a later gate.

## October 30

- [ ] APP: verify the exact APK, backend, support and disabled redemption behavior against the settled decisions. Prepare any signing request with version, checksum and test evidence; do not reopen the four choices.

- [ ] NATE ACTION NEEDED: approve the specific signing/distribution action when the private APK is ready. Publication remains separate; Doodle's signing role is confirmed, but signing access is not yet configured.

- [ ] DONE WHEN: explicit private Android APK GO/NO-GO. Private testing is labeled accurately, not “full public launch.”

## October 31

- [ ] APP: distribute only tested, authorized private APK builds; verify install through login, game and history on the delivered version. Play internal follows acceptance, not the calendar alone.

- [ ] APP: monitor crashes, authentication and integrity; stop affected rollout if critical failures occur.

- [ ] DONE WHEN: the private APK meets its agreed acceptance criteria, with outstanding scope stated. Public-store availability is not this milestone.

# November polish week

- [ ] **November 1:** crash/Auth/integrity triage; fix high-impact defects first.

- [ ] **November 2:** keyboard, safe-area, layout, accessibility and touch-feedback polish.

- [ ] **November 3:** measure and improve startup, reconnect, battery/network behavior.

- [ ] **November 4:** clean-install/upgrade/full-game regression. If the APK is fully accepted, prepare the authorized Play internal stage; any later qualifying closed-test/production-access dates depend on actual eligibility and test start.

- [ ] **November 5:** retest fixes and update support material; prepare truthful store screenshots/release notes only for the future store stage.

- [ ] **November 6:** prepare a signed patch candidate through the specifically approved workflow and authorize its private distribution. Any later store rollout requires that channel's review and approval.

- [ ] **November 7:** acceptance against the agreed feature inventory; unresolved functional or regulatory work remains blocked, not “small tweaks.”

# Distribution and financial scope

Private Android APK testing is the selected first stage, not a fallback. Play internal testing follows full APK acceptance; iOS TestFlight and public stores are future stages, not equivalent to private APK completion. Wallet-credit reward redemption stays unavailable until Nate initiates it later. No customer imports or 23 held games are introduced by this plan.\
Actual redemption mechanics determine policy treatment. Obtain appropriate product/legal review rather than assuming “practice” or “sweepstakes” labels guarantee approval. [Apple gaming rules](https://developer.apple.com/app-store/review/guidelines/) · [Google gambling policy](https://support.google.com/googleplay/android-developer/answer/9877032/) · [Google blockchain policy](https://support.google.com/googleplay/android-developer/answer/13607354?hl=en)\
Verify current SDK requirements before submission: [Android target API](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en-EN) and [Apple SDK requirements](https://developer.apple.com/news/upcoming-requirements/?id=02032026a).
