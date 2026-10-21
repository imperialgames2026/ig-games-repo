# Casino ZIP reference library

The executable Imperial Games application is at this repository's root. This
directory brings the companion repository's design, poker, migration and audit
documents into that same checkout. It is a reference library, not a second app.

Sources were copied without editing from
[`imperialgames2026/casino-zip`](https://github.com/imperialgames2026/casino-zip)
commit `0ad8fbbac3f2cace14ec40264e299faf46a4053d`. Exact paths and SHA-256 checksums
are recorded in [the consolidation manifest](../../repository-consolidation.json).
Its [original repository README](REPOSITORY_README.md) describes the smaller,
separate scaffold; those commands are historical context for that repository.

Source documents retain their original dates, branch names, runtime claims and
planned financial features. They are design/history evidence, not current test
results or instructions to activate a deployment. The current release uses
tester chips only, with no purchases, withdrawals or redeemable prizes.

## Design and product references

- [Imperial Games blueprint](IMPERIAL_GAMES_BLUEPRINT.md)
- [Platform architecture](blueprints/solana-casino-platform.md)
- [Dashboard and treasury visual design](blueprints/IGN_TREASURY_AND_DASHBOARD_DESIGN.md)
- [Poker, blackjack and roulette rules](game-engines/poker-blackjack-roulette.md)
- [Poker tournaments and ring games](game-engines/poker-tournaments-and-ring.md)
- [Poker staging session procedure](game-engines/POKER_STAGING_TEST.md)
- [Four-player bot laboratory](game-engines/POKER_AI_BOT_LAB.md)
- [Fairness design](provably-fair.md)

The `audits/` directory preserves historical implementation findings. The other
`blueprints/` documents preserve future payment, custody, identity and token
proposals, which are outside the tester-chip release.

Run `node scripts/audit-repository-consolidation.mjs` from the repository root to
verify reference integrity and that every source frontend path has a retained or
replacement implementation. The main app does not need a sibling `casino-zip`
checkout to build or run.
