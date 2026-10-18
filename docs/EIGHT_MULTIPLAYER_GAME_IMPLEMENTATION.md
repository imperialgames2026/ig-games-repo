# Imperial Games — Eight Multiplayer Practice Games

## Scope and release status

This branch focuses ONLY on multiplayer Texas Hold'em, Omaha, Blackjack, Baccarat, Craps, Roulette, Crash, and Trenball. It contains **server-authoritative, nonredeemable practice-chip staging implementations**. It is **not a licensed real-money casino**, is **not ready for a public APK**, and is **not approved to merge into production**.

All browser-facing legacy game settlement is blocked unless the corresponding game route uses a reviewed Supabase Edge Function. Never re-enable the Base44 generic mutation service.

## Game-by-game implementation

| Game | Route | Backend | Shared betting and settlement |
|---|---|---|---|
| Texas Hold'em | /PlayPoker | poker-table-v1 | 6 seats, forced blinds, server turns, private 2-card hands, flop/turn/river, call/check/raise/fold/all-in, side pots |
| Omaha | /PlayOmaha | poker-table-v1 + Omaha SQL variant | 6 seats, 4 private cards per player; EXACTLY 2 hole and 3 board cards used at showdown; same server turn engine |
| Blackjack | /PlayBlackjack, /PlayMultiplayerBlackjack | ig-blackjack-practice | 7 seats; common six-deck shoe; main hand, Perfect Pairs side wager; individual Hit/Stand, server dealer draws and resolves |
| Baccarat | /PlayBaccarat | ig-shared-event-practice | Communal 8-deck hand; Player, Banker and Tie; third card rules; Banker commission; ties push Player/Banker |
| Craps | /PlayCraps | ig-multiplayer-practice | Shooter/side bettors; Pass/Don't Pass, Field, Any Seven, Place 4/5/6/8/9/10; point and seven-out |
| Roulette | /PlayRoulette | ig-multiplayer-practice | European single zero; straight-up numbers, odd/even, red/black, high/low, dozen, column |
| Crash | /PlayCrash | ig-shared-event-practice | Same live multiplier round as Trenball; server-authoritative automatic cashout at fixed 1.5/2/3/5/10x thresholds |
| Trenball | /PlayTrenball | ig-shared-event-practice | Red (<2x), Green (>=2x), Moon (>=10x) predictions on the **same** Crash outcome |

All payouts quoted in the interface refer ONLY to fictional nonredeemable practice chips. Rounding of fractional chips is down to the nearest whole practice chip. No financial wallet balance is read or credited.

## Safety controls

- The Supabase staging project is pinned to `qonqemhljgxlwpghkxhn` for newly developed Edge Functions.
- Endpoints verify the user's Supabase JWT, eligibility, exclusion and authorized role. Signed-in read-only tester accounts can view where allowed, but cannot participate.
- Game state is held on the server, not computed from a user's submitted dice, cards, multiplier or outcomes.
- Server RPCs are service-role-only, and the underlying game tables have RLS with no direct browser mutation policies.
- Shared betting phases are enforced using the database clock and row-level locks.
- Repeat-request IDs are idempotent; changed Blackjack stake/target with the same ID is rejected.
- Poker's seed commitment is withheld until the completed hand. Each authenticated player only receives their own private hole cards. Omaha has an independent exactly-two-hole-card evaluator.
- Crash and Trenball use one result, not two separate random draws.
- Game data and payments are isolated from real wallets, crypto custody, payout processing, and withdrawal approvals.

## Staging validation performed

- GitHub Actions Node test suite guards every approved game route, financial wallet isolation, random-outcome logic and Omaha rule source; Vite build has passed with eight-game routes.
- Rollback-only staging SQL transactions tested multiplayer Craps/Roulette, betting deadlines, side-bet settlement, idempotency, leave/rejoin, shooter permissions and roles.
- Rollback-only staging SQL transactions tested Crash/Trenball and Baccarat multiuser betting, early resolution rejection, deterministic same-round replay and atomic settlement.
- Rollback-only staging SQL transactions tested Blackjack multiple seats, main and Perfect Pairs bets, early deal rejection, player turns, dealer settle, repeated resolution, and a changed-bet UUID rejection.
- Rollback-only staging SQL transactions tested Omaha 4-card dealing, deck-offset-aware flop, Hold'em 2-card dealing, and variant segregation.
- The original poker deck offset bug was fixed by explicitly recording dealt-seat count for Hold'em and Omaha.
- All test transactions were rolled back, leaving no artificial wagers or user balances.

## Still required before claiming production end-to-end validation

1. At least two *actual authenticated browsers* playing each game concurrently, on mobile and desktop, including network interruptions and session expiry.
2. Independent third-party poker-hand evaluator cross-validation, card-secrecy and RNG audit, probability/payout tests over large distributions and adversarial state testing.
3. Concurrency/load tests for the server action endpoints; fraud, bot and abuse controls, tournament operation review, race tests and logging.
4. Blackjack advanced rule variants (splits, doubles, insurance), if planned: these are NOT enabled and should not be displayed as playable.
5. Crash manual cashout is NOT implemented. Its classic mode uses **server-stored preset automatic cashout** only.
6. Real-money gambling, sweepstakes and digital-asset compliance/legal/licensing review; wallet signing and settlement, KYC/AML, age and geographic rules.
7. Full dependency and supply-chain remediation, independent penetration test, and signing/QA for standalone APK distribution.

**Do not merge or publicly launch for redeemable wagering based only on these staging checks.**

## Repositories

- Implementation: imperialgames2026/ig-games-repo, branch integration/casino-zip.
- Review: draft pull request #2. This is a review boundary, not an authorization for production merge.
