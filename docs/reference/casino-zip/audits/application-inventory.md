# Imperial Games legacy ZIP inspection — 2026-10-17

## Evidence
Inspected user-uploaded `ig-games (1).zip` as a ZIP archive. It contains **390 entries**, including:
- Original React 18 / JavaScript JSX / Vite application: `package.json`, `package-lock.json`, `index.html`, `src/App.jsx`, `src/main.jsx`, `vite.config.js`, `tailwind.config.js`.
- Extensive casino frontend: blackjack, poker, roulette, slots, staking, wallet, KYC, admin, and rewards pages/components.
- `src/api/base44Client.js` and `src/lib/AuthContext.jsx`: existing Base44 integration.
- `base44/functions/*/entry.ts`: game outcomes, blackjack, crash, wallet gifting, staking, payment checkout/webhook, audit, KYC, and more.
- `base44/entities/*.jsonc`: UserWallet, Transaction, IGTLedger, CryptoTransfer, StakingPosition, StakingPool, SweepstakesEntry, and other entity definitions.

## Confirmed gaps relative to target
- Legacy archive contains Base44 SDK and Vite plugin, not a completed Supabase migration.
- No `supabase/config.toml` or `supabase/functions` entries found in the ZIP.
- The temporary root TypeScript scaffold on this branch does **not** reproduce the legacy app; do not merge or deploy it as the application.
- No tests or build success verified in this audit.

## Critical security observation
`src/App.jsx` contains an `ExcludedGuard` that treats a failed `base44.auth.me()` request as allowed (`.catch(() => setStatus('ok'))`). This is fail-open frontend behavior; server-side exclusion enforcement must be authoritative and fail closed.

## Migration plan
1. Import the legacy ZIP's original frontend source **without overwriting it with the placeholder scaffold**. Preserve `package-lock.json` and its React 18 versions until dependencies are audited.
2. Run reproducible npm install/build/lint/typecheck and record failures.
3. Inventory every Base44 function and entity, map to Supabase schema/RLS/Edge Functions, and prioritize transaction-critical operations.
4. Build server-authoritative atomic, idempotent ledger/game settlement; use RLS and authenticated role claims; test replay and concurrent payouts.
5. Harden exclusion, KYC, payments, webhook verification, admin access, and sensitive logs.
6. Reconcile with `docs/blueprints/solana-casino-platform.md`; prototype on Devnet only after financial/legal gates.

## Status
**Legacy archive inspected; not yet migrated or built.** Scaffold files are provisional, and the full legacy source has not been committed to this branch.
