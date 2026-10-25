# Unity primary-button input review

Base: main `e1a1d90e6f5f9d7de7291e34a90d994897ee6b45`. No overlapping open input correction was found. PR67 remains a separate draft lifecycle change.

The actual frame event handlers reproduced PR70 discussion_r4365774385: middle/right sequences emitted bets, including mismatched press/release buttons. Both press and release must now use button 0. Touch contacts retain their pointer IDs, including secondary fingers, so pinch handling remains intact. The server clock, outcome authority and practice-only restrictions are unchanged.

Seven handler regressions cover secondary buttons, mismatched releases, subsequent primary recovery, mouse/touch/pen taps, drag, cancellation and pinch. The existing bundled-Unity multiplayer browser scenario now additionally requires right/middle clicks to emit neither a bet event nor a mocked wager request before the touch wager. All external browser requests are intercepted or aborted.

Local checks: 24 focused table/input tests; 181 application tests excluding biometric comparison validation; 25 replay tests; production build. The dedicated create-triggered review workflow runs these allowed regressions and the bundled Unity shared-table browser scenarios on the exact verification ref. Existing gates remain unchanged. Biometric components, Android builds, hosted writes and deployment are not part of this review.

Real browser backgrounding and physical Razr acceptance remain unverified. Larger-viewport lifecycle evidence belongs to PR67's separate source revision and must not be treated as validation of merged main's lifecycle behavior.
