# One Imperial Games application

`ig-games-repo` is the executable application. Its root React/Vite frontend,
Supabase Auth integration, reviewed backend package and tests form the working
baseline. The companion `casino-zip` repository remains intact as source history;
it is not a second service or frontend to install alongside this app.

## What was combined

The application already contains the original casino frontend and the companion
repository's migrated account screens, player analytics, practice leaderboard,
Crash service and poker bot lab. This consolidation preserves those newer active
implementations and makes the remaining design library available from this one
checkout:

- 21 design, poker and historical audit documents, plus the source repository's
  README, are retained byte-for-byte in [the reference library](reference/casino-zip/README.md).
- All 301 JavaScript, TypeScript and CSS paths from the companion's editable
  `original-app/src` are mapped to active files or an explicit replacement.
- All 16 companion function entrypoints and 25 migration files are accounted for
  against the main application's backend. Provider KYC functions are deferred
  for this tester-chip release. Differing legacy migration histories are not
  replayed in parallel with the reviewed main baseline.
- The identical `ig-games.zip` archive is retained once at the root; the existing
  `legacy-frontend` preserves the original source for comparison.

[The machine-readable manifest](repository-consolidation.json) records source
commit `0ad8fbbac3f2cace14ec40264e299faf46a4053d`, reference checksums and every
mapping. It does not require a sibling checkout at runtime.

## Integration decisions

| Companion source | Main application |
| --- | --- |
| `original-app/src/` | Existing root frontend; retain migrated Supabase-aware versions. |
| `src/App.tsx` and its React 19 scaffold | Separate demonstration app; do not run it as another product. |
| `components/SupabaseSignIn.jsx`, `VerifiedLayout.jsx` | Active `pages/Login.jsx`, `lib/AuthContext.jsx` and `Layout.jsx`. |
| `pages/Verified*.jsx` | Canonical routes backed by integrated verified components. |
| Client-only `lib/crapsRound.js` | Server-backed craps practice UI and its current tests. |
| `lib/practicePoker.js` | Active Hold'em/Omaha table transport to `poker-table-v1`. |
| `lib/practicePokerEvents.js` | `poker-events-v1` is retained; player event UI is reviewed as part of this test release. |
| Old single-game practice catalog | Main approved practice catalog and explicit route gates. |
| `migration/legacy-overlay/` | Historical partial migration; avoid replacing the complete active app. |
| Payment/custody/KYC provider plans | Retained design references; outside tester-chip scope. |

The older four-player smoke SQL automatically selects existing user identities.
It was not promoted into the executable test suite. Authenticated poker checks
must use explicit test fixtures and preserve private-card and chip invariants.

## Verify the consolidation

```sh
node scripts/audit-repository-consolidation.mjs
# Optional: also compare every recorded source checksum with a companion checkout.
node scripts/audit-repository-consolidation.mjs --source /path/to/casino-zip
```

The audit checks imported document/archive hashes, active frontend replacements,
backend path mappings and the sole application entrypoints. It does not establish
authenticated backend or gameplay readiness; run the build, application tests
and actual isolated-session checks separately.

The current product direction is a tester-chip site: registration, player
accounts, game discovery, practice gameplay and operator testing. Real-world
currency, deposits, withdrawals and redeemable rewards are excluded. No remote
repository deletion, production deployment, Git push or environment publication
is part of this consolidation.
