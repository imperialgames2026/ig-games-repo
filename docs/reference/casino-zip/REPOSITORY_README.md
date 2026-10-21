# Imperial Games

> **Build identity warning (2026-10-17):** This working tree is a security-focused React/TypeScript staging **scaffold**, not the complete original Imperial Games frontend. The original 390-entry app remains in `ig-games.zip` at the repository root. It includes roughly 291 frontend source paths and 61 legacy Base44 Edge Function entrypoints that still require careful migration. Do **not** deploy the scaffold over the existing casino or merge this PR expecting all casino features to exist.
>
> GitHub CI is configured to check both `npm run build` for the staging scaffold and a separate clean build of `ig-games.zip`. No successful CI execution has yet been observed. Existing production/Pages settings should remain unchanged while migration is unfinished.

React + TypeScript + Vite application with optional Supabase authentication and three free-play demo games.

## Local development

Requires Node.js 20 or later.

```bash
npm install
npm run typecheck
npm run build
npm run test
npm run dev
```

Copy `.env.example` to `.env.local` and fill in the Supabase project URL and public anon/publishable key. Never expose a service-role key in a Vite environment variable. Configure email confirmations and authorized redirect URLs in Supabase Auth.

## Scope and security

The app currently provides a demo lobby, games, and authentication UI. It is **not** a real-money casino, and no real-value payment, redeemable wallet, game settlement, or privileged blockchain transactions are implemented. Read-only IGN Devnet token inspection and a Superadmin role-gated planning dashboard have been added on the integration branch. All game outcomes are client-side demonstrations and must never be used for financial settlement. The demo randomness is not certified or uniformly sampled for gambling use.

Before production launch: add server-authoritative game settlement and an immutable double-entry ledger, database RLS policies and role checks, idempotent payment processing, identity/compliance controls, end-to-end tests, monitoring, deployment configuration, and independent security review.

## Status

Build and tests must pass in CI before considering a merge into `main`.

## Staging connection

The browser client defaults to the Imperial Games staging Supabase project using a public publishable key. Override via `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for a different environment. Supabase Auth email confirmation and allowed redirect URLs must be configured for the deployed domain. No secret credentials are committed.

## IGN Devnet Wallet and Royal Treasury (integration branch)

The **Wallet** page now includes an IGN Solana Devnet read-only token viewer. Enter any Solana public address or connect a Phantom wallet to read the balance of the IGN Devnet mint. Wallet connection only retrieves a public address: no signatures, transfers, custody or linking to a Supabase identity. Devnet RPC uses `getAccountInfo` and `getTokenAccountsByOwner`; public RPC access, browser connectivity and user sessions must be tested in a deployed environment.

The **Admin** page includes the **IGN Royal Treasury** read-only working allocation dashboard for authenticated **Superadmin** users. Its role check queries the canonical `public.user_roles` table through existing Supabase RLS self-read. Non-Superadmins see an access-denied message. The current dashboard reads live **mint supply only** (not any multisig wallets or allocation accounts) and uses static approved budget figures; do not interpret budget categories as chain-reconciled wallet positions.

**No IGN token transactions or wallet funding flows are implemented.** Mainnet mint, market price, paid gaming, staking, deposits, and token settlement remain disabled. Tests reside under `src/lib/ign/*.test.ts`; manual staging steps are documented in `docs/blueprints/IGN_WALLET_TREASURY_STAGING_QA.md`.
