-- Enable only the five remaining games authorized by the owner. Other 23 stay on hold.
alter table public.ig_practice_game_catalog drop constraint approved_practice_backend_route;
alter table public.ig_practice_game_catalog add constraint approved_practice_backend_route check((backend_slug,route) in (
 ('ig-final-practice','/PlayDarts'),
 ('ig-final-practice','/PlayDiceZone'),
 ('ig-final-practice','/PlayHiLo'),
 ('ig-final-practice','/PlayTowers'),
 ('ig-crash-v2','/PlayRocket'),
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
insert into public.ig_practice_game_catalog(slug,name,description,category,backend_slug,route,is_active) values
 ('darts','Darts','Server-owned weighted dart zones with a reproducible round proof.','instant','ig-final-practice','/PlayDarts',true),
 ('dice-zone','Dice Zone','Choose an inclusive zone from 1 to 100 and verify the committed roll.','instant','ig-final-practice','/PlayDiceZone',true),
 ('hilo','HiLo','Predict the next card, keep future cards hidden and verify the completed transcript.','cards','ig-final-practice','/PlayHiLo',true),
 ('towers','Towers','Climb nine hidden floors using server-owned moves, then reveal and verify the board.','instant','ig-final-practice','/PlayTowers',true),
 ('rocket','Rocket','Rocket entry to the shared server-timed Crash practice flight.','instant','ig-crash-v2','/PlayRocket',true)
on conflict(slug) do update set name=excluded.name,description=excluded.description,category=excluded.category,backend_slug=excluded.backend_slug,route=excluded.route,is_active=true,practice_only=true,real_wagers_enabled=false;
