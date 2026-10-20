# Mines backend migration — 2026-10-20

The original Mines handler returned its entire mine layout and seed before a player selected a tile. The old page also decided outcomes and wrote wallet balances in the browser.

`PlayMines` now uses `ig-mines-practice`, a JWT-verified staging function over a server-only atomic database API. It preserves the 25-tile board and selectable 1–24 mines in free practice. Coins, monetary wallets, prizes and tokens are not changed.

- A server seed is committed before the player submits a client seed. Rejection-sampled HMAC values drive a partial Fisher–Yates shuffle, binding the layout to both seeds and the mine count.
- Active responses contain only the commitment, chosen tiles and public round state. The server seed and full layout are revealed after a mine, clearing every safe tile, or stopping the round.
- Owner checks, canonical roles and exclusion apply on every request. Testers may read their state but cannot mutate games. Direct table access and authenticated execution of the server RPC are revoked.
- Requests bind their UUID to the action, expected version, tile and seed. Exact retries return the original receipt; changed payloads and stale moves are rejected. The database locks each round and permits one active round per user.
- The page resumes the server's active round after reload. Unacknowledged requests retain their original key for retry. Completed boards are independently verified in the browser against the saved commitment before displaying a result.

## Validation

Five Node tests cover independent Python-generated shuffle vectors, transcript tampering, identity binding, input rejection and error handling. A live staging rollback regression passed for board secrecy, ownership, immutable retries, version guards, duplicate tiles, mine/clear/stop outcomes, tester/exclusion denial and unchanged financial rows. The app build and reviewed package preparation pass. Browser CI additionally exercises commit, pick, reload and final proof rendering with controlled API responses; it is separate from live HTTP E2E.

Staging migration: `20261020162817_server_owned_mines_practice`. Function: `ig-mines-practice` version 1, JWT verification enabled. The reviewed backend now has **88 recorded migrations and 28 functions**. The route audit reports **44 game routes: 16 practice-backed, 28 blocked**.

This change does not implement financial Mines wagers, reconcile the remaining slot paytables or complete the other legacy business functions. Production and historical Base44 customer data are not changed.
