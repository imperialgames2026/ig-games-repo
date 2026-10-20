> Catalog/isolation follow-up: staging now has 90 migrations / 29 functions and 13 SQL suites. See [CATALOG_RECORD_ISOLATION_20261020.md](CATALOG_RECORD_ISOLATION_20261020.md). Counts below describe the account integration commit.

# Account backend integration — 2026-10-20

This integration preserves current main's profile names, immutable display names,
avatar storage, canonical authorization, Originals and Mines. It incorporates the
account-flow and payment retry work from PR15 and PR19 without replacing the newer
backend manifest or profile implementation. PR20 already merged the isolated
database/Auth/Storage verification and Mines proof-binding fixes.

## Deployed staging state

Project: `qonqemhljgxlwpghkxhn`. There are 89 recorded migrations and 29 reviewed
functions. `20261020204117_payment_preparation_requests.sql` is the exact recorded
SQL; its checksum was compared with the CLI-created implementation before export.
No production project changes were made.

Updated functions, all with JWT verification enabled:

| Function | Version |
| --- | ---: |
| poker-table-v1 | 12 |
| ig-multiplayer-practice | 4 |
| ig-shared-event-practice | 2 |
| ig-blackjack-practice | 3 |
| ig-crash-v2 | 2 |
| ig-payment-requests | 1 |

All six deployed sources were read back and matched byte-for-byte. The existing
five sources were checked against their previous reviewed source before replacement.
Browser compatibility includes both SDK client headers. The explicit local-only
practice flag remains restricted to the disposable `http://kong:8000` target.

## Account behavior

- Supabase password reset/recovery works through the dedicated recovery page.
  Token refresh and user-update events preserve an in-progress form while the
  identity is rechecked. Missing sessions show signed-out state; other errors
  continue to fail closed.
- Transaction history reads only the verified owner's actual ledger rows.
  Fairness history recalculates revealed practice outcomes. Self-exclusion uses
  the existing protected handler, with explicit player confirmation.
- Payment preparation records, lists and cancels owner-scoped requests. The
  database locks canonical eligibility before mutation or retry and rejects
  altered retry payloads, anonymous/excluded/tester accounts and invalid networks.
  Private definer routines sit behind service-only invoker wrappers. No wallet
  balance, transaction, deposit address, custody operation or payout is created.
- A successful save followed by a history refresh failure remains successful.
  An uncertain save retains its original retry UUID. Deployment recovery also
  checks downloaded function bytes and JWT settings before skipping an already
  deployed function; an unrelated changed version stops the deployment.

## Verification and remaining scope

Live staging rollback assertions passed for canonical signup, support ownership,
payment replay/conflicts, cancellation replay/ownership, exclusion, tester denial,
RPC grants and unchanged balances. All fixture changes in that suite rolled back.
Offline tests, packaging and build are checked alongside the combined CI suites.
The isolated workflow now also runs the newer wallet/admin, profile, Originals
and Mines rollback suites, for 12 transactional database suites in total.

The security advisor categories remain unchanged: intentional server-only tables
with no browser policies, the existing authenticated IGN definer routine, and
leaked-password protection disabled. No new exposed definer routine was introduced.

This is a practice release. There are still 28 blocked game routes and archived
business functions without complete Supabase parity. Base44 historical customer
data requires the actual export and source inventory described in
`BASE44_EXPORT_INPUTS.md`. Production data import/cutover and financial provider
execution are unfinished. Existing JavaScript typing errors remain visible in
the expanded typecheck configuration; they have not been suppressed.
