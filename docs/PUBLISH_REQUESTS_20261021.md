# Publish verification and request intake

The existing GitHub integration automatically deploys main to Cloudflare Pages
and Vercel. Both reported successful deployments for main `282d087`; that evidence
proves host build/deployment success, not complete legacy feature parity.

This release replaces blocked generic writes/reads on AMOE, PrizeClaims and
AdminSweepstakesAudit. Dedicated `ig_entry_requests` and
`ig_prize_claim_requests` have RLS, explicit owner filters, canonical staff audit
reads and restricted INSERT columns. Actor IDs, creation times and statuses are
server defaults, never caller-supplied. Clients cannot update/delete audit records,
approve entries, fulfill claims or mutate balances. Claims require approved KYC
on the server. Excluded/tester accounts cannot submit; anonymous users cannot
read intake. Other owners and demoted staff cannot read private claim details.
Owners retain access to their own request history. No customer data is copied.

Submission records a request, not entitlement. AMOE starts pending official-rule
review. Claim addresses/network labels are intake details, not provider-validated
destinations. No provider custody, payout, reserve or real-value settlement is
activated. The abuse ceiling is 60 submissions per account/table/hour, serialized
by a transaction advisory lock; it does not define sweepstakes eligibility.
Stable UUIDs are reused after uncertain failures and unchanged retries return the
original owner record. Changed payloads cannot reuse a request ID. Requested
amounts are validated decimal strings with two fractional digits, preserving exact
precision across Postgres, REST and JavaScript. No float-based conversion occurs.

The recorded migration `20261021012551_owner_scoped_sweepstakes_request_intake.sql`
is included byte-for-byte (5332 bytes; recorded MD5
`f82795dcb29b82e460855f126e287f4b`) in the 98-migration reviewed package.
The hosted transactional role-matrix test passed and rolled back all fixtures;
the subsequent security advisor returned no findings. The isolated CI runner now
includes 18 SQL suites and a real browser submission/history/admin-audit test.

Every build emits `release.json` with a full commit SHA, public backend URL,
practice mode, held-game count and reviewed migration count. It includes no keys.
The verifier requires the expected full SHA, six matching SPA entry routes, the
main JS asset and the reviewed backend/scope. It fails if a legacy operation flag
is enabled. Build configuration also refuses publishing that unreviewed flag.

Run after hosting deployment:

```
npm run verify:published -- https://imperialgaming.llc FULL_MAIN_COMMIT_SHA
```

A 403/security challenge must be addressed through the authorized hosting account;
the verifier does not bypass it. App/API checks with real Auth are run separately
in disposable CI. Full migration still requires legacy VIP/rewards/referrals, IGT
staking and provider-backed financial execution/configuration. The 23 explicitly
held games remain excluded; no scope has been silently removed or activated.

## Consolidated announcement hardening

PR29 was reviewed and merged with all checks passing. Its originally pending
source `20261021001029_announcement_content_hardening.sql` was applied through the
connected Supabase service, which recorded version `20261021012941`. The reviewed
package now uses that actual recorded version with identical SQL bytes (2601 bytes;
MD5 `4520402e78dc84ee039ada5181f30f24`). The pending package entry is replaced,
not replayed under a second version. The root source remains historical reference.
Public announcement expiry uses server time; admin archives are paginated; new
rows default inactive; URL authority validation and Unicode limits are reconciled.
