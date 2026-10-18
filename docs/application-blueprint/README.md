# Imperial Games — Application Blueprint

> Status: Working reference. This page documents the intended application and does not imply that listed features are implemented or verified.

## Vision
Build a cohesive Imperial Games application combining the existing codebase and approved legacy functionality, with a consistent user experience, secure backend operations, and testable releases.

## Reference library
- [NotebookLM research and planning notebook](https://notebooklm.link.google/9LMINVRmcjuI) — external reference; source documents have **not** yet been imported or verified.
- Add exported NotebookLM source documents, notes, screenshots and approved designs under `docs/application-blueprint/references/` after reviewing them for permissions and secrets.
- Record each source's title, date, origin, and the requirements derived from it.

## Functional blueprint (draft; confirm against source documents)
### Player experience
- Authentication, account/profile management, and protected player routes.
- Game discovery, gameplay, session status and transaction history.
- Responsive layouts and accessible interactions.

### Game settlement and wallet integrity
- Authoritative server-side game settlement and wallet mutations.
- Atomic balance updates, immutable ledger/audit records, idempotency and replay protection.
- Explicit authorization, validation, concurrency safeguards, and reconciliation tests.
- No client-controlled balances, payouts or privileged operations.

### Payments
- Verified payment-provider events and explicit transaction state transitions.
- Secrets held only in protected server configuration.
- Refund, reversal, dispute and failure handling documented and tested.

### Roles and administration
- Superadmin: full authorized platform administration.
- Admin: scoped administrative tasks.
- Read-only tester: view-only access; cannot change balances, payments, game outcomes, users or configuration.
- Enforce permissions on the server and database, not just in UI.

## Engineering standards
- Supabase Auth, Postgres/RLS and Edge Functions as appropriate for protected backend operations.
- Document schema changes and migration plans; run automated build, integration and security tests.
- Keep work on `integration/casino-zip` until verified; do not merge into `main` without review.
- Never commit credentials, private keys, personal/financial data or unlicensed proprietary source material.
- Treat notebook research as design input, not as authorization to deploy gambling or payment functionality; verify legal and provider requirements before launch.

## Decisions and open questions
- [ ] Import and review NotebookLM exports and underlying sources.
- [ ] Identify exact screens, workflows, visuals and game mechanics intended.
- [ ] Distinguish required features from inspiration and speculative ideas.
- [ ] Confirm supported jurisdictions, product model and payment constraints.
- [ ] Map approved requirements to issues, acceptance criteria and tests.
- [ ] Review implementation status before claiming feature completion.

## How to use this blueprint
When planning changes, cite the relevant reference and update this page with decisions. Prefer small reviewed pull requests with acceptance criteria and test evidence. The blueprint is guidance; security controls and verified source code remain authoritative for implementation behavior.
