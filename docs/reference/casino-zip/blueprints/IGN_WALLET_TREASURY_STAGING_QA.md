# IGN Wallet + Royal Treasury — Staging QA

**Scope:** React integration branch only, Solana Devnet only. No Mainnet, transfers, staking, deposits, withdrawals, token settlement or real-value gaming. **Deployment not performed by this commit.**

## Prerequisites
- Supabase staging project configured with its **public** URL and publishable key, and `public.user_roles` RLS self-read policy applied.
- An *already approved* Superadmin role entry exists for the specific signed-in Supabase identity. This feature never creates or elevates roles; confirm the correct user in Supabase before any separate assignment.
- Read-only connection to `https://api.devnet.solana.com` from the browser; IPFS logo gateway availability may vary.
- Optional Phantom extension; users can use public-address lookup without it.

## Verification matrix

| Scenario | Action | Expected |
| --- | --- | --- |
| Unauthenticated wallet viewer | Open **Wallet** | Branding, Devnet/test label, live supply on successful RPC; no auth requirement for public RPC |
| No wallet extension | Press **Connect Phantom** | Explain Phantom is unavailable; allow pasting a public address |
| Connect Phantom | Approve public key access | View *Devnet* IGN token balance of connected public key only; no transaction or signature prompt |
| Public address | Paste a valid Solana address, choose **View balance** | Show total over matching IGN SPL token accounts at a confirmed slot |
| Account with no ATA | Query valid owner without IGN accounts | Display **0 IGN**, not an error |
| Refresh | Query same owner again | Fresh RPC balance request |
| Bad address | Paste malformed value | Validation error before RPC |
| RPC rate limit | Fail/mock HTTP 429 | Friendly temporary RPC failure; do not show a fabricated balance |
| Mint read | Live mint matches expected | 10B minted, 9 decimals, mint/freeze authority revoked, token program verified |
| Wrong wallet network | Phantom wallet currently on another network | Viewer still labels and queries **Devnet**; no sends and no Mainnet balance claim |
| Price/circulation | Wallet and Treasury | No USD valuation or inferred circulating supply |
| Guest / Player / Tester / Admin | Open **Admin** -> Treasury | Treasury blocked with deny-by-default message (verify with distinct Auth users) |
| Superadmin | Sign in as Superadmin and open Admin | See nominal allocation bars, Devnet supply status and absence of configured treasury wallets |
| Supabase role query fails | Disable network / mock error | Permission denied, not granted |
| User sign-out / switch | Log out / sign in different user | Treasury view unmounts, role rechecked for newly authenticated user |
| Any account | Inspect network requests | No transfer instructions, private keys, wallet link signatures or admin writes |
| Practice Poker | Run pre-existing tests and two-client staging | Timers, practice chips, server fairness untouched |

## Commands (on a local clone)

```bash
npm install --no-audit --no-fund
npm run typecheck
npm run test
npm run build
```

Test files: `src/lib/ign/ign.test.ts`, `src/lib/ign/devnet-rpc.test.ts`, `src/lib/ign/treasury-access.test.ts`.

## Important technical notes
- Token arithmetic uses `bigint`; raw 10-billion / 9-decimal supply exceeds JavaScript safe integer range. Never convert raw amount to `Number`.
- Wallet lookup is read-only and **not** a signed account-link operation. A public wallet address shown in the UI proves nothing about account ownership.
- `getTokenAccountsByOwner` queries the official public Devnet RPC; public endpoints may rate-limit. Configure an appropriately controlled RPC provider if sustained usage requires it, without exposing secrets in browser environment variables.
- Authorization to *view nominal public planning numbers* is enforced in the UI using authenticated Supabase `user_roles` and RLS. If private treasury records are implemented in the future, they MUST have independent server-side RLS/Edge authorization. Browser visibility controls are not sufficient to protect private data.
- Do not claim current category wallets are funded; approval of a *budget* is not proof of distribution.
- The integration branch has other existing production blockers; do not merge to `main` just because this feature's unit tests pass.
