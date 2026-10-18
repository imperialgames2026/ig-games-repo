# Casino ZIP feature merge audit

Source: user-uploaded `ig-games(1).zip`, matching the `casino-zip` source application layout.
Target: `integration/casino-zip`, forked from `migration/supabase-foundation`.

## Result

The existing target branch **already contains** the ZIP's React feature groups, including:

- Games and slot components, game pages and lobbies
- Staking screens and staking components
- Support chat, global chat, and support/admin pages
- Casino wallet displays, VIP, quests, bonuses, referrals, and rewards
- Admin panels, user management, KYC, and withdrawal interfaces
- Mobile navigation and shared UI components

The ZIP uses `src/` as its application root, whereas the target repository stores React application files at repository root. Copying the ZIP's `src/` tree as-is would create a second, disconnected application.

## Integration decision

**Retain the target implementations.** The source features are already represented in the target; do not replace Supabase-aware files with older Base44 versions. This is a deduplication decision, not a claim that every runtime workflow works.

The target also already has Supabase Auth, `lib/ProtectedRoute.jsx`, `api/base44Client.js` (compatibility facade), and Supabase Edge Function infrastructure.

## Not merged automatically

- `base44/functions/**`: legacy provider-specific backend implementations. They need per-function conversion and server-side authorization review before activation.
- `base44/entities/**`: legacy schema definitions; compare with the Supabase migrations rather than deploying in parallel.
- `public/sitemap.xml` and `public/robots.txt`: contain the old site domain; importing without reviewing production URL and indexed routes is unsafe.
- `android.apk` and `android.aab`: unrelated, separately downloaded binaries.

## Outstanding launch gates

1. Confirm source-vs-target behavioral differences for each active feature.
2. Audit compatibility functions that use service-role credentials; they must enforce ownership, role and balance invariants server-side.
3. Replace client-side game wallet settlement with server-authoritative outcome/settlement functions before allowing real-money play.
4. Run dependency installation, build, route smoke tests, role/RLS tests and deployment checks.
5. Merge to `main` only after review.

**No Base44 production backend, payment handler, or client-side game settlement was enabled by this audit.**
