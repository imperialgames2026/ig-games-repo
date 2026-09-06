# Imperial Games — Supabase migration status

The Base44 archive is preserved as the migration source. The browser no longer depends on the Base44 SDK, and the migration branch contains the Supabase foundation.

Completed foundations:
- Supabase Auth/session integration.
- Base44-compatible entity facade for the existing UI.
- Supabase financial schema with RLS.
- Server-only wallet/transaction mutation boundary.
- Function dispatcher for the existing `base44.functions.invoke(...)` call surface.
- Compatibility `app_records` store for non-financial legacy entities.
- Idempotency, game-round and staking-cycle foundations.
- Storage buckets for profile media and private KYC documents.

The production gate is server-authoritative game settlement. Existing game pages contain legacy client-side wallet deltas; those must be replaced by wager/outcome/settlement Edge Functions before real-money play is enabled. The original 61 Base44 functions remain the behavioral source for that conversion.

Deployment also requires the actual Supabase project ref and secrets. Never commit service-role keys, payment secrets, custody keys, seed phrases, or webhook secrets.
