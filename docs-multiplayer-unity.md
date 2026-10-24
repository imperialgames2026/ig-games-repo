# Shared practice Unity integration

Unity is now the default presentation on PlayRoulette and PlayCraps. Existing 2D felt remains selectable and is the recovery path if Unity fails to load. The backend, authentication, roles, table membership, practice-chip balance and round settlement are unchanged.

The presentation adapter accepts validated `lastResult` data and derives a stable UUID from the game and shared round. Repeat polls use the same presentation ID. It copies and freezes result values; it does not draw outcomes or credit chips. Confirmed `publicBets` totals become amount-labelled scene markers. A tap maps to an existing server target and passes through the existing authenticated `placeBet` action. An in-flight guard prevents rapid taps from duplicating submissions. Only server responses update the displayed table/balance.

Unity currently supports pass-line taps and roulette single numbers (including green 0), red, black, even and odd. Other active wagers remain visible in the existing server panels; craps betting cards and 2D felt retain the other bet types. No local repeat-bet, refund, clear or undo behavior is attached to multiplayer funds. Existing server wager lifecycles apply. The local practice lab remains separate.

Validation: 177 unit tests pass; production build and targeted component lint pass. Browser checks on actual Unity at 412×915 use controlled authenticated API responses, confirm exact bet requests, confirmed markers, server result values, deduplicated replay and 2D fallback. No hosted account wagers were submitted in these tests. Run `npm run build`, serve the preview on 4193, then `LAB_URL=http://127.0.0.1:4193 LAB_CHROME=/usr/bin/google-chrome npm run test:multiplayer:unity`.
