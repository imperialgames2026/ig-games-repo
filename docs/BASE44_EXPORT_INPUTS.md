# Inputs still needed for actual Base44 data migration

Only application archives were found in the saved repository/library files. The
ZIP contains 390 entries, including 61 Base44 backend functions and 23 entity
definitions. It contains no CSV, JSONL, database dump or customer-data export.
Source recovery and local integration tests do not prove customer-data migration.

Start with a **read-only export inventory**, not unrestricted customer records:

1. Export date/application/environment, available entity names, row counts,
   schema/field types, source primary keys and ownership/relationship fields.
   Identify shared/public catalog entities explicitly. Missing ownership must
   not imply public visibility. Counts and field names are sufficient first.
2. Authentication migration capability: whether Base44 supports a documented
   user/identity export or federation handoff. Later migration needs stable user
   IDs, normalized login identifiers, provider identity links and verification
   state. Do not request plaintext passwords or assume portable password hashes;
   if no supported credential transfer exists, plan an account-claim/reset flow.
3. For entities approved for migration, an allowlisted export with stable source
   IDs, owner IDs, relationship IDs, lifecycle/status fields and timestamps.
   Agree retention and exclusions before exporting chats, support content or
   other personal data. Use schema-only or synthetic samples to build mappings.
4. For financial reconciliation only after scope approval: authoritative balance
   snapshots and immutable ledger identifiers, currency/precision definitions,
   totals, status and linkage to pending withdrawals/rewards. These are needed
   to reconcile, not to execute transactions or convert token models. Identify
   the system of record before mapping the older project's exchange/transfer
   tables, which staging does not contain.
5. Storage inventory: source object ID/path, owner ID, entity reference, content
   type, byte length, checksum and public/private classification. Actual files
   are needed only when an approved transfer starts. KYC document contents are
   unnecessary for the initial mapping/audit and should not be broadly exported.
6. Non-secret configuration inventory: provider names, sandbox/live designation,
   enabled features and callback domains. Secrets belong in an approved secret
   setup flow, not in a source/customer export.

The smallest next user input is the location or availability of a supported
Base44 read-only export and which environment contains the authoritative customer
data. Neither Supabase project has been established as the production cutover
target. No production approval is needed to continue local schema/mapping work.

Staging credentials are no longer a prerequisite for local Auth/REST/browser
verification: disposable local users cover signup, login, canonical roles, RLS,
profile reads/writes and session restoration. A later test of deployed Edge
Functions, Storage, Realtime, email/provider configuration or staging multiplayer
flows needs a separately authorized disposable staging fixture; local tests do
not silently authorize creating live accounts or invoking financial operations.
