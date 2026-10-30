# Imperial Campaign RPG — data and action boundary

Status: schema design only. This document defines the initial persistence contract; it does not create or deploy tables.

## Design goals

- Reuse the existing Supabase Auth identity.
- Keep campaign tables isolated from wallet, wager, token, and NFT records.
- Let the authenticated client read only its own safe character projection and published content.
- Keep encounter state, inventory authority, rewards, and action events server-controlled.
- Apply an accepted action, state revision, and event record atomically.
- Make retries idempotent and stale actions explicit.

## Proposed campaign schema

Use a dedicated `ig_campaign_v1` PostgreSQL schema. If the project’s exposure settings or migration conventions require the tables to live in `public`, retain the same names with a campaign prefix and the same access contracts. Do not add campaign fields to legacy `app_records`, `wallets`, or `transactions`.

| Relation | Purpose | Client access |
| --- | --- | --- |
| `content_versions` | Published, immutable campaign rules and content package versions | Authenticated read of published versions |
| `characters` | Owner, name, content version, progression, attributes, and current non-transferable loadout | Owner read through a safe projection; no direct client writes |
| `inventory_items` | Server-owned item instances, counts, origin, and consumption state | No direct table access |
| `encounters` | Active/finished encounter state, participant IDs, state revision, and content snapshot | No direct table access |
| `action_requests` | Idempotency key and canonical request hash/result for retries | No direct table access |
| `action_events` | Append-only accepted action results, rolls, state diffs, and revision sequence | No direct table access; filtered replay via Edge Function |
| `mission_completions` | One completion/reward record per character and mission repeat policy | No direct table access |

Every owner reference points to `auth.users(id)`. Use UUID primary keys and timestamptz server timestamps. Store rules and content versions explicitly on characters and encounters. JSONB is appropriate for versioned content payloads and compact action/state diffs, but core keys (owner, encounter, revision, request ID, status, timestamps) remain typed columns with constraints and indexes.

## Row and function access

- Enable RLS on every exposed relation.
- Grant authenticated clients only `SELECT` on published `content_versions` and an owner-filtered safe character view. The owner policy uses `auth.uid() = owner_user_id`.
- Revoke direct `INSERT`, `UPDATE`, and `DELETE` from `anon` and `authenticated` for all campaign state and reward relations.
- Keep encounter state, inventory, request ledger, event log, completion rows, and internal projections in a non-exposed schema where supported. If they must be in `public`, enable RLS and provide no client policies; document that service-only access is intentional.
- The client invokes an authenticated Edge Function using its Supabase session JWT. The function derives the user from verified claims; it never accepts a user ID as authority.
- A narrow database transaction routine may be used for atomic compare-and-apply. It must have a fixed `search_path`, be owned by a controlled role, and have execution revoked from `anon` and `authenticated`; only the trusted function service role may execute it. Avoid general-purpose elevated SQL routines.

## Action request and transaction

Request fields:

- `encounter_id`: UUID
- `request_id`: UUID generated once by the client and reused for network retries
- `expected_revision`: integer the client last observed
- `action`: a schema-validated typed intent such as `move`, `attack`, `interact`, `use_consumable`, or `end_turn`
- Optional action-specific target IDs or map coordinates; never a roll, DC, AC, damage, resource total, reward, or replacement user ID

The authenticated Edge Function:

1. Verifies the JWT and validates the request shape and size.
2. Loads the trusted encounter and participant state.
3. Resolves duplicate `request_id`: return the stored original response if its request hash matches; reject reuse with a different payload.
4. Rejects stale `expected_revision`, wrong turn, invalid target/range, insufficient movement/resources, or completed encounters without a state change.
5. Generates rolls and calculates the complete outcome from the pinned rules/content version.
6. Calls one narrow transaction routine that rechecks the revision and actor, applies the state diff, appends the event with the next revision, records the idempotent response, and commits.
7. Returns only the requesting player’s allowed state projection and accepted event.

Database uniqueness and row locking are the final guards against concurrent requests. The event sequence is the recovery source; clients may reconnect using their last revision. A spectator projection must be a separately filtered response that omits hidden enemy intent, private inventory, credentials, and player-only controls.

## Initial integrity constraints and indexes

- Unique `(owner_user_id, character_id)` is not required; character ownership is expressed directly by `characters.owner_user_id`.
- Unique `(encounter_id, revision_after)` for accepted event order.
- Unique `(owner_user_id, request_id)` for retry identity, with a stored canonical request hash.
- Foreign keys from encounter participants, items, events, and completion records to their parent rows.
- Nonnegative checks for level, XP, HP, stack counts, resources, and movement counters; maximum HP must be positive and current HP cannot exceed it.
- Index active encounters by participant and status; index events by `(encounter_id, revision_after)`; index inventory by owner and status.

## Data lifecycle

A character starts with server-granted non-transferable practice equipment. An encounter snapshots character statistics and equipped item definitions at mission start so balance changes do not rewrite an active match. On completion, one transaction records the mission completion and grants non-transferable practice XP, currency, and items. Crafting and transferable assets remain out of scope until ownership, consumption, and replay are proven.

## Before implementation

1. Confirm current Supabase CLI and migration workflow against the canonical repository.
2. Create a cost-approved development database branch or another isolated test target; do not trial campaign DDL on the shared staging database.
3. Implement the schema in a versioned migration and inspect security/performance advisors.
4. Build the authenticated action Edge Function and narrow transactional database routine.
5. Add replay and concurrency checks before the client route.
6. Connect the campaign route behind the existing approved-game gate only after the backend boundary is reviewed.

No tables, functions, secrets, deployments, or production/staging data were changed for this design.
