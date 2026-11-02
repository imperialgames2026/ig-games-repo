# Butcher checkpoint — November 2, 2026

## Camp trial

The next slice adds a solo Camp Trial with an 8×8 arena, a training sentinel, health/action/movement display, server-approved step movement, attack animation and concise hit/miss feedback. WASD/arrows step, F attacks, Space ends the turn, and on-screen buttons support the same actions. Tab changes camera. The trial can be refreshed after interrupted requests, abandoned, or exited after a terminal result.

Characters → sign in → select a saved hero → close the character panel → Camp trial. Selecting a hero checks for an active saved trial. A new trial requires an explicit start. The current trial tests weapon attacks; skill actions, progression, rewards, parties and wagering remain future work.

## Trusted state and retries

Only IG Network Lab tests (`jvyzpxjqmymafjapprpp`) is targeted. `butcher-encounters` version 1 verifies the session and derives the owner ID. Clients send start/resume/action intent with request IDs and expected revisions. They never send authoritative health, equipment, damage or dice rolls.

The private encounter tables freeze character/loadout data at trial start. Starting a trial locks equipment changes on that hero. Server code validates movement, range, line of sight and action availability, rolls with the secure RNG, resolves the enemy turn, then atomically commits the final state and ordered events. A stale competing commit does not reveal its discarded roll. Repeated accepted requests return the original stored response without rolling or applying damage again. Completed or abandoned trials release the hero's equipment lock. One active trial per hero, a 200-action bound (with abandon still available), and a 30-start/hour/account lab budget bound practice use.

Migration `20261101180340_butcher_practice_encounters_v1.sql` was generated through the CLI and aligned with the lab's recorded migration version. All new tables use service-only access and RLS; invoker RPC execution is revoked from public, anon and authenticated roles. Poker, wallets, NFT operations and token balances are outside this change.

## Verification and limits

- 31 campaign/rules/endpoint checks and 2 migration/packaging checks passed.
- Transactional database checks passed for start retries, resume, frozen loadouts, equipment locks, ownership isolation, accepted receipt replay, one commit per request, stale/conflicting request rejection, terminal unlock, no automatic restart and the hourly start budget. Test writes rolled back.
- The Unity presentation check uses explicit fixtures without signing in or writing to the lab. It verifies arena geometry, five-foot grid positioning (1.524 metres per tile), smooth movement to the accepted position, one-shot attack playback, duplicate/stale snapshot suppression, invalid snapshot rejection, terminal results and return to camp. It cannot establish an authenticated Unity journey.
- A disposable-account HTTP test runner is included at `scripts/verify-butcher-live.py`. Its attempted run stopped before creating users because the local Supabase CLI lacks lab admin credentials. No disposable users were created. It requires explicit `--run`, pins the lab credential, keeps secrets in memory and removes only the accounts it creates. The signed-in full journey remains pending.
- Earlier source/UI changes were left uncommitted when the ChatGPT app froze; the PC files survived. This checkpoint recovers that work.

The sentinel uses original primitive geometry and the attack uses an owned humanoid animation. The scene is an early prototype. NPC animation, detailed combat feedback, armor replacement, skill actions, progression, missions beyond training, AI narration, multiplayer, marketplace and Android work remain development tasks.

## Recovered checkpoint verification

The final editor presentation pass completed successfully with zero current console errors/warnings. It verifies arena geometry, accepted-position movement, attack playback, one feedback entry per accepted revision, stale/invalid response guards, victory display and camp return. Screenshots use labelled fixtures, not a real account.

The updated Linux player built successfully: 107,361,438 bytes, zero build errors/warnings. Its headless startup probe passed, including the new trial controller/attack state and both character/encounter endpoints. Interactive account-to-trial play remains pending; this does not imply the disposable-account HTTP runner passed.

The same updated native player also passed with OpenGL initialized. This remains a startup check, not an authenticated interactive play test. No current editor errors or warnings were reported after the build.
