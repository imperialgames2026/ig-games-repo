# VIP catalog migration

The existing `components/casino/VIPHelper.jsx` specification is preserved exactly
in `config/vip-levels.seed.json`: 34 levels, seven tiers, starting at Beginner / 0
XP and ending at Eternal X / 10,000,000,000 XP. The runtime hard-coded helper was
removed so published threshold changes cannot disagree with player displays.

`ig_vip_catalog` is a singleton, publicly readable configuration document. One
atomic update publishes all 34 levels. The database checks contiguous ordered
levels, names/tier fields, zero initial XP, strictly increasing integer thresholds
and the JavaScript safe-integer limit. Authenticated clients can only update the
`levels` column and only when canonical `public.is_superadmin()` authorizes them.
The service uses revision predicates to prevent lost edits; unchanged retries can
confirm a previously committed save. Actor, timestamp and revision are server-set.
Private `internal.vip_catalog_history` records each committed revision atomically.
The internal trigger is not an exposed RPC; all client execution is revoked.

`/VIP`, profile and wallet cards, progression, tier explanations and level-up toasts
share the live catalog. A level-up toast requires increasing XP for the same user
under the same catalog revision. Loading/errors do not display a maximum rank.
Wallet XP is owner-scoped and read-only. The stale `wallets.vip_level` field is not
used to calculate the displayed VIP rank. `/AdminVIP` and the retained legacy VIP
tab use the same dedicated editor; admin roles may read, only superadmins publish.
The player-profile badge and bonus-screen VIP labels use the same derived rank.
Absent locked-bonus balances no longer show the old 5,600/8,000 sample amounts.
This display correction does not enable the legacy quest or wheel claim handlers.

Recorded hosted migration: `20261021020409_dedicated_vip_catalog.sql`. Exact
recorded statement bytes are stored in deployed-migrations and checksummed in the
reviewed manifest. This brings the reviewed set to 99 migrations / 30 functions.
Hosted rollback role tests passed; the security advisor returned zero findings.
Five offline VIP tests cover all threshold boundaries, malformed schedules,
canonical authorization, revision retries and account-safe celebrations. Two
authenticated browser cases exercise player ranks, all tiers, profile consistency,
superadmin edits, stale drafts and ordinary-admin read-only behavior against the
isolated replayed backend. CI results belong to the PR for this change.

## Remaining owner rules

- Wager-based XP is documented in the old source as 1 XP per 1 ID wagered.
  Practice rounds have zero monetary wagers and do not award this XP. No conversion
  between ID/IGD/IGN/IGT is invented here, and no legacy customer XP is imported.
- Level-up, weekly and monthly bonuses have no approved per-level amounts or
  complete currency/eligibility/claim rules. Old inactive forms cannot determine
  those economics. The VIP page states that bonus claims are not launched.
- The owner resolved wheel stages as levels 1–11 / 12–24 / 25–34, with one
  saved spin per level reached. See `VIP_REWARD_WHEELS_20261021.md` for the
  implementation and admin prize editor. The 23 held games stay on hold.
- Referral, quest and IGT staking financial settlement and provider-backed live
  payments remain separate migration work. This release does not claim that the
  entire application migration or real-value launch is complete.
