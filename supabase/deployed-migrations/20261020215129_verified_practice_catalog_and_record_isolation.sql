-- The existing app_records table is empty in staging. Public catalogs use
-- explicit reviewed tables; missing ownership must never imply public visibility.
alter policy "app records read own" on public.app_records using(owner_user_id=(select auth.uid()) or public.is_admin_or_superadmin());
alter table public.ig_practice_game_catalog drop constraint ig_practice_game_catalog_backend_slug_check;
alter table public.ig_practice_game_catalog drop constraint ig_practice_game_catalog_route_check;
alter table public.ig_practice_game_catalog add constraint approved_practice_backend_route check ((backend_slug,route) in (
 ('provably-fair-v2','/PlayDice'),
 ('ig-originals-practice','/PlayCoinFlip'),
 ('ig-originals-practice','/PlayHashDice'),
 ('ig-originals-practice','/PlayLimbo'),
 ('ig-originals-practice','/PlayPlinko'),
 ('ig-originals-practice','/PlayWheel'),
 ('ig-mines-practice','/PlayMines'),
 ('poker-table-v1','/PlayPoker'),
 ('poker-table-v1','/PlayOmaha'),
 ('ig-blackjack-practice','/PlayBlackjack'),
 ('ig-shared-event-practice','/PlayBaccarat'),
 ('ig-multiplayer-practice','/PlayCraps'),
 ('ig-multiplayer-practice','/PlayRoulette'),
 ('ig-crash-v2','/PlayCrash'),
 ('ig-crash-v2','/PlayTrenball')
));
insert into public.ig_practice_game_catalog(slug,name,description,category,backend_slug,route,is_active)
values
 ('dice','Practice Dice','Two dice with a server commitment and a reproducible fairness proof.','instant','provably-fair-v2','/PlayDice',true),
 ('coin-flip','Coin Flip','Choose heads or tails and verify the revealed server outcome.','instant','ig-originals-practice','/PlayCoinFlip',true),
 ('hashdice','Hash Dice','Choose high or low and verify the HMAC-derived result on your device.','instant','ig-originals-practice','/PlayHashDice',true),
 ('limbo','Limbo','Set a target and reveal a reproducible practice multiplier.','instant','ig-originals-practice','/PlayLimbo',true),
 ('plinko','Plinko','Follow twelve independently derived steps and verify the final position.','instant','ig-originals-practice','/PlayPlinko',true),
 ('wheel','Wheel','Choose a color and verify the committed twenty-slot wheel result.','instant','ig-originals-practice','/PlayWheel',true),
 ('mines','Mines','Pick tiles on a hidden server-owned board, then stop and verify its proof.','instant','ig-mines-practice','/PlayMines',true),
 ('poker','Texas Hold’em Poker','Shared practice tables with private hole cards and server-controlled hands.','cards','poker-table-v1','/PlayPoker',true),
 ('omaha','Omaha Poker','Four-card Omaha using exactly two hole cards and three community cards.','cards','poker-table-v1','/PlayOmaha',true),
 ('blackjack','Multiplayer Blackjack','Shared seats and a server-controlled dealer using imaginary chips.','cards','ig-blackjack-practice','/PlayBlackjack',true),
 ('baccarat','Multiplayer Baccarat','One shared eight-deck hand with server-controlled third-card rules.','table','ig-shared-event-practice','/PlayBaccarat',true),
 ('craps','Multiplayer Craps','Shared server dice with shooter turns and imaginary practice bets.','table','ig-multiplayer-practice','/PlayCraps',true),
 ('roulette','Multiplayer Roulette','A shared single-zero wheel with server-owned practice results.','table','ig-multiplayer-practice','/PlayRoulette',true),
 ('crash','Multiplayer Crash','A server-timed shared multiplier and automatic practice cashout.','instant','ig-crash-v2','/PlayCrash',true),
 ('trenball','Multiplayer Trenball','Color predictions on the shared server-timed Crash round.','instant','ig-crash-v2','/PlayTrenball',true)
on conflict(slug) do update set name=excluded.name,description=excluded.description,category=excluded.category,
 backend_slug=excluded.backend_slug,route=excluded.route,is_active=true,practice_only=true,real_wagers_enabled=false;
comment on table public.ig_practice_game_catalog is 'Reviewed zero-wager games only. Practice chips have no cash value; no financial settlement is enabled.';
