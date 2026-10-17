# Phase 1 — Base44 compatibility retirement register

Generated inventory: `scripts/audit-frontend-integration.py` (CI artifact `frontend-integration-audit.json`).

## Findings

- 285 original JavaScript/TypeScript source files are audited for parity. The original 291-path tree includes other file types.
- 81 active JSX pages are registered through `pages.config.js`.
- The initial inventory found 67 static `base44.functions.invoke(...)` calls and 347 `base44.entities.*` accesses. These are call sites, not 414 unique backend implementations.
- `api/base44Client.js` already maps six core entity names to Supabase tables: User, UserWallet, Transaction, WeeklyWager, WithdrawalRequest, TokenPack.
- Other entities use `app_records` through the compatibility adapter. This requires RLS and ownership review per entity.
- Legacy functions are dispatched through a single `api` Edge Function with a `functionName` field. Each supported name must be checked against deployed server-side handlers, role authorization and validation.

## Migration sequence

1. Export the audit artifact and group the 67 function call sites by name, file and risk level.
2. Inventory all entity names from the 347 accesses. Distinguish read-only UI queries from user-owned writes and financial/admin mutations.
3. Verify Supabase schema, Edge Function routing, grants and RLS before changing call sites.
4. Migrate low-risk read-only calls first, preserving the original screen behavior.
5. Move any wallet, game settlement, payments or administrator writes behind tested, explicitly authorized server-side functions. Never implement financial balance changes as direct client updates.
6. Add route/browser tests for public pages, authenticated pages, admin-only pages, read/write workflows and failed authorization.
7. Remove the compatibility adapter only after the inventory is zero or every remaining call is explicitly approved and tested.

## Release gate

The source-parity audit and Vite build are necessary but insufficient. Phase 1 remains open until migration classification, backend authorization tests and functional browser tests pass. Keep `integration/casino-zip` separate from `main`.
