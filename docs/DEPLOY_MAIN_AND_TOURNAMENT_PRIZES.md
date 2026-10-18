# Imperial Games — build/deploy from main (public frontend not yet provisioned)

## Verified
- GitHub repository source: imperialgames2026/ig-games-repo, branch main.
- Vite React build: npm ci && npm run build (output dist), supported by GitHub Verify app build CI.
- SPA routing: vercel.json provides index.html fallback.
- Supabase staging project: qonqemhljgxlwpghkxhn; tournament Edge Functions check this project explicitly.

## Vercel deployment prerequisite
Connect the Vercel plugin/account and authorize the Imperial Games repo. Import the repository with Production Branch = main and Vite framework. Configure Vercel environment variables, all client-safe:
- VITE_SUPABASE_URL = URL of the **approved** Supabase project used for practice-only frontend.
- VITE_SUPABASE_PUBLISHABLE_KEY = corresponding publishable/anon key, NOT service-role secret.
- VITE_ENABLE_LEGACY_EDGE_FUNCTIONS = false.

Deploy to an isolated preview hostname until authenticated browser smoke, E2E tournament and tenancy validations have passed. Then connect the intended custom domain after explicit review. Do not point production UI to an unreviewed production database, and do not treat GitHub merge as website deployment.

## Prize payout preview capabilities (branch feature/tournament-prizes-100-spots)
- Superadmin creates 0-100 contiguous award positions for each saved tournament preset; constrained by the event's seat capacity.
- Currencies: PRACTICE, Imperial Games accounting tokens, major fiat and crypto denominations; up to 12 fractional digits for awards. The total configured amount is a **draft** only.
- Choose display currency separately; supported reference sources are CoinGecko public API for selected listed crypto and open.er-api.com for fiat FX. Rates may be stale/unavailable and are marked indicative, never applied to financial settlement.
- Internal tokens and unsupported assets never claim an independently verified market price.
- A payout revision log and SHA256 event snapshot preserve the original administrator-configured amounts for audit.
- A logged-in player's /PokerTournamentPrizes?eventId=... page displays **published** practice-only prize ladders as unredeemable informational previews.
- None of these changes credit wallets, pay tournament prizes, allocate escrow or enable real-money money movement.

## Further controls before a live casino launch
Regulatory/custodial permission by jurisdiction; independent game fairness checks; 30-table concurrent load and elimination testing; audited history and payout calculations; money movement/AML limits and chain finality validation; account recovery and security penetration testing.

## Release from main
1. Merge reviewed feature PR to main after GitHub CI passes.
2. Connect/authorize Vercel and import main; configure environment variables.
3. Deploy isolated preview and verify routes, sign-in, tournament presets, awards, currency quote fallbacks and eight-game practice routes.
4. Launch real-money functionality only after separate licensing, independent certification, custody and compliance gates.
