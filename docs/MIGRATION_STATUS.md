# Imperial Games — Base44 → Supabase Migration Status

## Source snapshot

The uploaded `ig-games.zip` is the migration source of truth. It contains 390 files, including 79 pages, 184 React components, 61 Base44 backend functions, and 23 Base44 entity definitions.

## Work completed

- Supabase client dependency and Vite configuration are in place.
- Core Supabase schema exists for profiles, wallets, transactions, weekly wagering, withdrawals, and token packs.
- Auth is now Supabase Auth rather than Base44 Auth.
- Frontend Base44 calls now pass through a Supabase compatibility facade while legacy entities are being converted.
- Direct browser writes to wallet balances and the transaction ledger are blocked.
- Security-hardening, game-round, house-edge, reward-policy, and hourly staking-distribution foundations have been added.

## Migration gates

1. Convert the 61 Base44 backend functions to Supabase Edge Functions and atomic Postgres operations.
2. Replace every client-side game balance mutation with server-authoritative settlement.
3. Add the complete entity/table model for poker, multiplayer tables, chats, quests, VIP, KYC, referrals, tournaments, and crypto transfers.
4. Build the authoritative real-time table/game service for Poker, Blackjack, Baccarat, Craps, and Roulette.
5. Implement custodial crypto address assignment, monitoring, confirmation, withdrawals, reconciliation, and secure signing boundaries.
6. Deploy migrations/functions to the real Supabase project and run end-to-end, security, failure/retry, and accounting tests.

## Important

The application is being migrated deliberately rather than declaring the project finished while financial mutations are still client-controlled. The target production system must never trust a browser-supplied payout, balance, private key, seed phrase, or corporate-governance action.
