# VIP level spins and admin wheel settings

This documents the initial draft-only release. The subsequent publication and
wallet-credit settlement implementation is in `VIP_WHEEL_REDEMPTION_20261021.md`.

The owner specified one reward-wheel spin per reached VIP level and corrected the
current maximum to **34**, not 24. Stages are:

| Stage | Earned levels | Maximum level-earned spins |
| --- | --- | --- |
| 1 | 1–11 | 11 |
| 2 | 12–24 | 13 |
| 3 | 25–34 | 10 |

Level 1 includes the first saved spin at registration. Each spin retains the stage
of the level that earned it, even when the player's current rank later changes.

## Supabase implementation

Recorded migration `20261021030929_vip_level_spins_and_wheel_settings.sql` adds an
owner-readable, client-immutable `ig_vip_level_spins` ledger. `(user_id, level)` is
unique; stage is a generated column. Trusted wallet XP updates issue every crossed
level once, including skipped levels. XP decreases/replays cannot duplicate a
grant. Editing the VIP catalog does not grant a spin, and a later XP update only
earns thresholds actually crossed during that update. A spin already earned is
not revoked when thresholds change. No wallet money columns are changed.

Signup enrollment runs after the canonical role bootstrap; anonymous users are
excluded and conversion to a registered account enrolls them. Existing eligible
Supabase accounts enroll from authoritative wallet XP. This is not an import of
Base44 users, histories, files or balances. Eligibility is checked against canonical
roles and profile exclusion, not user metadata. Testers cannot earn new progress
spins, and excluded users cannot earn/read them. API roles and service-role clients
cannot insert, update or delete grants. All grant helpers are private trigger
implementations with empty search paths and revoked client execution.

`ig_vip_wheel_settings` stores three staff-readable draft configurations.
Superadmins can edit 2–24 sections per wheel: reward name, exact amount string,
unit, notes and integer weight. Amounts retain 16 whole digits and 8 decimal
places without floating-point conversion. Weight 0 excludes a section; displayed
odds are weight / total weight. Preview slice sizes show section layout, not odds.
Updates use revision predicates, backend validation and atomic private audit
records in `internal.vip_wheel_settings_history`. Actor, time and revision are
server-owned. Other admins are read-only; players cannot read private drafts.

The dashboard has `/AdminRewardWheels`, a navigation link, a link from `/AdminVIP`
and the retained legacy wheel manager entry point. Every wheel's unsaved draft is
preserved independently while switching tabs. Stale saves keep the draft and
require reloading instead of overwriting another edit. The player `/VIP` and
`/Bonuses` screens show actual saved spins and their earned history.

## Prize configuration and remaining settlement

Ten editable sections per stage are seeded from the old source as private drafts.
Legacy ID labels remain ID; no ID/IGD/IGN/IGT conversion is assumed. Free-bet amounts
remain zero until configured; extra-spin game/stake and XP multiplier duration
still need complete rules in the editor. The old BTC jackpots retain weight 0,
and the old forced jackpot at global spin 500,000 is not implemented or displayed.

Saving draft settings does **not** activate draws, consume spins or credit money.
The player screen explains that earned spins stay saved while prizes and reward
fulfillment are completed. Atomic server-side draw/redemption and supported reward
settlement remain migration work; arbitrary text units are not executable payout
instructions. None of the 23 games on the non-migration list are activated.

## Verification

The hosted transactional suite verified stage boundaries 11/12/24/25/34, skipped
levels, replay/decrease safety, catalog-only edits, anonymous registration,
owner isolation, tester/exclusion denial, client grant/consume denial, exact
amounts, superadmin-only edits, revision conflicts and atomic audit history.
All fixtures and test changes rolled back. The security advisor returned no
findings after deployment. The reviewed backend has 100 migrations / 30 functions.

Offline coverage adds six tests for stage counts, precision, invalid configuration,
owner identity, canonical admin authorization and retry/conflict handling. Two
authenticated browser cases cover actual saved-spin counts/history, account
isolation, edits on all three wheels, persisted decimal amounts, stale drafts and
read-only admin behavior. Final CI and publication evidence belongs to this PR.
