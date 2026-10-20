# Backend-only RLS review — 2026-10-20

Project: `qonqemhljgxlwpghkxhn` (staging). Recorded migration:
`20261020224547_explicit_backend_only_rls_boundaries.sql`.

All 56 flagged tables are backend-owned under the current application architecture.
The review compared live columns, table/column/sequence privileges, policies,
49 referencing SQL routine bodies/owners/security modes/execute grants, committed
frontend references and Edge Function callers. No direct frontend table consumer
or dependent view was found for these tables. Service-only SQL routines and
verified Edge Functions provide filtered player/staff responses. Configuration
without an active application consumer remains private; this change does not
activate deferred integrations or held games.

Each table now has `backend_only_no_client_access`: a RESTRICTIVE policy for ALL
commands TO anon, authenticated USING (false) WITH CHECK (false). RLS stays enabled.
This explicitly documents and enforces backend-only access even if a permissive
policy is later added. Table privileges are revoked from PUBLIC/anon/authenticated;
the latter also blocks TRUNCATE, REFERENCES, TRIGGER and MAINTAIN, which RLS alone
does not protect. The migration aborts on unexpected existing policies or column
grants instead of replacing new access requirements silently.

Actual privilege fixes discovered during the review:

- `idempotency_keys` retained all table privileges for anon/authenticated. These
  obsolete grants, including TRUNCATE, are removed.
- Five owned sequences retained USAGE/SELECT/UPDATE for normal API roles:
  `crash_round_queue_id_seq`, `poker_event_audit_v1_id_seq`,
  `ig_poker_tournament_award_audit_id_seq`, `ig_fb_sandbox_ops_audit_id_seq` and
  `ig_crash_v2_queue_id_seq`. Their client/PUBLIC privileges are removed.
- The other 55 table ACLs and all existing service-role privileges are unchanged.
  In particular, `secure_operation_receipts` keeps service SELECT/INSERT only.

Admin audit access already exists through `ig-admin-command-center` compliance:
it validates the session, canonical admin/superadmin role and exclusion status,
then selects limited audit fields with a server credential. A separate direct
client SELECT policy is unnecessary. Support likewise validates ticket ownership
or staff membership before reading messages. Raw game tables contain private
cards, future outcomes, seeds or receipts that must not be exposed by owner-only
SELECT policies.

| Table | Reviewed purpose and access | Referencing server path |
| --- | --- | --- |
| `admin_action_audit` | Sensitive administrative action history; staff reads use the checked command center. | `internal.admin_mutation`, `Edge: ig-admin-command-center` |
| `crash_round_queue` | Queued future Crash outcomes and secret seeds; admin queue service only. | `Edge: admin-crash-rounds` |
| `crypto_deposit_assets` | Backend deposit asset allowlist and token verification flags. | `Edge: crypto-deposit-preview-v1` |
| `crypto_deposit_networks` | Backend network readiness and destination provisioning configuration. | `provision_pending_crypto_deposit_destinations`, `Edge: crypto-deposit-preview-v1` |
| `crypto_treasury_accounts` | Custody references, addresses and signing configuration; migration/operator managed. | Migration/operator managed; no active runtime consumer found |
| `crypto_treasury_control_policy` | Treasury approval, signing and reserve limits; migration/operator managed. | Migration/operator managed; no active runtime consumer found |
| `crypto_treasury_integration_readiness` | Provider readiness flags; checked operator dashboard reads. | `Edge: ig-admin-command-center` |
| `crypto_withdrawal_policy` | Backend withdrawal screening/approval configuration; checked preview RPC. | `preview_crypto_withdrawal_policy` |
| `idempotency_keys` | Legacy response/retry cache; no active committed frontend or deployed Edge consumer found. | Migration/operator managed; no active runtime consumer found |
| `ig_bj_history` | Blackjack settlement history, returned through checked game state. | `ig_bj_action` |
| `ig_bj_receipts` | Blackjack replay receipts; only the atomic action routine writes. | `ig_bj_action` |
| `ig_bj_seats` | Blackjack seat balances and private cards; filtered game state only. | `ig_bj_action`, `ig_bj_state`, `ig_bj_timeout` |
| `ig_bj_table` | Blackjack deck, future cards and shared turn state; never raw client reads. | `ig_bj_action`, `ig_bj_state`, `ig_bj_timeout` |
| `ig_crash_v2_bets` | Crash/Trenball/Rocket practice bets; actor-scoped backend state/actions. | `ig_crash_v2_action`, `ig_crash_v2_state`, `ig_crash_v2_tick` |
| `ig_crash_v2_history` | Completed shared Crash proofs; selected backend response only. | `ig_crash_v2_state`, `ig_crash_v2_tick` |
| `ig_crash_v2_queue` | Future shared Crash seeds/outcomes; never client-readable. | `ig_crash_v2_fill_queue`, `ig_crash_v2_tick` |
| `ig_crash_v2_runtime` | Current secret seed, crash point and server timing; sanitized state only. | `ig_crash_v2_action`, `ig_crash_v2_state`, `ig_crash_v2_tick` |
| `ig_crash_v2_seats` | Shared Crash practice balances and membership; checked action/state RPCs. | `ig_crash_v2_action`, `ig_crash_v2_state`, `ig_crash_v2_tick` |
| `ig_event_bets` | Multiplayer event practice bets; actor-scoped game routines. | `ig_event_action`, `ig_event_state` |
| `ig_event_results` | Multiplayer event outcomes and retry results; checked routines. | `ig_event_action` |
| `ig_event_seats` | Multiplayer event practice chips and seats; checked routines. | `ig_event_action`, `ig_event_state` |
| `ig_event_tables` | Shared event lifecycle/controller state; checked routines. | `ig_event_action`, `ig_event_state` |
| `ig_fb_sandbox_asset_wallets` | Sandbox custody reservation/address state; verified operator service. | `ig_fb_reserve_sandbox_wallet`, `Edge: ig-fireblocks-sandbox-admin` |
| `ig_fb_sandbox_ops_audit` | Sandbox custody operation audit; verified operator service. | `ig_fb_reserve_sandbox_vault`, `ig_fb_reserve_sandbox_wallet`, `Edge: ig-fireblocks-sandbox-admin` |
| `ig_fb_sandbox_vaults` | Sandbox vault reservations; verified operator service. | `ig_fb_reserve_sandbox_vault`, `ig_fb_reserve_sandbox_wallet`, `Edge: ig-admin-command-center`, `Edge: ig-fireblocks-sandbox-admin` |
| `ig_fb_sandbox_webhook_inbox` | Verified/quarantined webhook payloads; webhook and operator services. | `Edge: ig-admin-command-center`, `Edge: ig-fireblocks-sandbox-webhook` |
| `ig_final_practice_rounds` | Darts/Dice Zone/HiLo/Towers seeds, hidden layouts and receipts; filtered practice RPC. | `internal.final_practice` |
| `ig_mines_practice_rounds` | Unrevealed mine positions, seed and receipts; filtered practice RPC. | `internal.mines_practice` |
| `ig_mp_bets` | Multiplayer practice bets; checked actor-scoped RPCs. | `ig_mp_action`, `ig_mp_state` |
| `ig_mp_events` | Multiplayer round results/replay state; checked RPCs. | `ig_mp_action` |
| `ig_mp_players` | Multiplayer seat state and practice chips; checked RPCs. | `ig_mp_action`, `ig_mp_craps_refill`, `ig_mp_state` |
| `ig_mp_practice_refills` | Practice refill receipts; atomic checked refill routine. | `ig_mp_craps_refill` |
| `ig_mp_tables` | Multiplayer shared table/shooter state; checked RPCs. | `ig_mp_action`, `ig_mp_state` |
| `ig_originals_practice_rounds` | Originals seeds and committed outcomes; reveal only through checked RPC. | `internal.originals_practice` |
| `ig_payment_rail_plan` | Deferred payment integration plan; migration/operator managed. | Migration/operator managed; no active runtime consumer found |
| `ig_poker_lab_bots` | Superadmin practice bot roster; checked bot-lab service. | `Edge: ig-poker-bot-lab` |
| `ig_poker_lab_tables` | Superadmin practice bot-lab table ownership; checked service. | `Edge: ig-poker-bot-lab` |
| `ig_poker_preset_events` | Preset-to-event allocation/retry mapping; tournament service RPC. | `ig_poker_create_event_from_preset` |
| `ig_poker_tournament_award_audit` | Tournament payout configuration edit history; checked save RPC. | `ig_poker_tournament_awards_save` |
| `ig_poker_tournament_awards` | Tournament practice payout ladder; checked admin save/read. | `ig_poker_create_event_from_preset`, `ig_poker_tournament_awards_save`, `Edge: ig-poker-tournament-admin` |
| `ig_poker_tournament_presets` | Tournament configuration and readiness; checked admin/event services. | `ig_poker_create_event_from_preset`, `ig_poker_tournament_awards_save`, `ig_poker_tournament_preset_save`, `Edge: ig-admin-command-center`; additional routines in recorded SQL |
| `ig_support_messages` | Private support messages; service checks ticket owner or staff. | `ig_support_open`, `ig_support_post`, `ig_support_supervisor_rules_watch`, `Edge: ig-support-v1`; additional routines in recorded SQL |
| `ig_support_supervisor_alerts` | Support escalation delivery states; checked supervisor service. | `Edge: ig-support-supervisor` |
| `ig_support_supervisor_decisions` | Support reviewer decisions; canonical verified staff service. | `Edge: ig-support-supervisor` |
| `ig_support_supervisor_queue` | Internal support review work queue; trigger and supervisor service. | `ig_support_supervisor_enqueue`, `ig_support_supervisor_rules_watch`, `Edge: ig-support-supervisor` |
| `ig_support_supervisor_reviews` | Support classifier results/reasons; checked supervisor service. | `ig_support_supervisor_rules_watch`, `Edge: ig-support-supervisor` |
| `ig_support_tickets` | Private support tickets; service filters owner or verified staff. | `ig_support_open`, `ig_support_post`, `ig_support_staff_status`, `ig_support_supervisor_rules_watch`; additional routines in recorded SQL |
| `poker_actions_v1` | Poker action replay/version receipts; backend-only action RPCs. | `poker_action_v1`, `poker_action_v3` |
| `poker_event_audit_v1` | Poker event operation audit; backend-only event RPCs. | `poker_event_create_v1`, `poker_event_publish_v1`, `poker_event_start_v1`, `poker_event_sync_v1` |
| `poker_event_entries_v1` | Poker event registrations/seating; checked event service/RPCs. | `poker_event_register_v1`, `poker_event_start_v1`, `poker_event_sync_v1`, `Edge: poker-events-v1` |
| `poker_events_v1` | Poker event lifecycle and configuration; checked event/admin services. | `poker_event_create_v1`, `poker_event_publish_v1`, `poker_event_register_v1`, `poker_event_start_v1`; additional routines in recorded SQL |
| `poker_seats_v1` | Poker private hole cards, stacks and commitments; filtered backend state. | `poker_action_v1`, `poker_action_v3`, `poker_advance_v1`, `poker_buy_time_v1`; additional routines in recorded SQL |
| `poker_tables_v1` | Poker private deck/seed and lifecycle; filtered backend state. | `poker_action_v1`, `poker_action_v3`, `poker_advance_v1`, `poker_buy_time_v1`; additional routines in recorded SQL |
| `poker_timebank_prices_v1` | Backend time extension/practice-preview configuration. | `poker_buy_time_v1`, `Edge: poker-table-v1` |
| `poker_timebank_receipts_v1` | Paid/practice time extension retry receipts; checked backend routine. | `poker_buy_time_v1` |
| `secure_operation_receipts` | Canonical wallet operation receipts; retain existing service SELECT/INSERT only. | `secure_wallet_operation` |

Verification:

- Hosted rollback role-matrix tests passed: all 56 tables reject direct SELECT,
  INSERT, UPDATE and DELETE under actual anon/authenticated database roles.
  Effective table/column privileges (including TRUNCATE) and owned-sequence
  privileges are absent. Service-role reads across all 56 tables and isolated
  idempotency receipt INSERT/UPDATE/DELETE remain functional.
- The isolated database suite additionally grants client CRUD and adds an
  intentionally permissive policy within a rolled-back transaction. Restrictive
  policies must still return zero rows, modify no rows and reject receipt inserts.
  This grant probe is never run against hosted staging.
- A fresh Supabase security advisor read after application returned no findings.
- The runner includes this coverage as the 16th transactional suite, alongside
  existing admin, support, poker, wallet and practice-game regressions.

[Supabase lint documentation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
