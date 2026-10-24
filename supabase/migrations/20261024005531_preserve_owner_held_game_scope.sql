-- Reconcile a separately deployed slot catalog with the owner's held-game list.
-- Keep the prototype schema and practice history; do not publish the held games.
update public.ig_practice_game_catalog set is_active=false
 where route in ('/PlayAztecTreasure','/PlayBalloons','/PlayCactusCassidy','/PlayCosmicCrown','/PlayDiamondDynasty','/PlayEmeraldEmpire','/PlayExternal','/PlayFarmageddon','/PlayGoldenDragon','/PlayHotPot','/PlayImperialGold','/PlayImperialLightning','/PlayLuckyFortune','/PlayMysticForest','/PlayNeonNights','/PlayOceanTreasure','/PlayPhoenixFire','/PlayRoyalRuby','/PlaySapphireStorm','/PlaySlide','/PlaySlots','/PlayStellarRush','/PlayTwist');
alter table public.ig_practice_game_catalog add constraint owner_held_games_inactive
 check (not is_active or route not in ('/PlayAztecTreasure','/PlayBalloons','/PlayCactusCassidy','/PlayCosmicCrown','/PlayDiamondDynasty','/PlayEmeraldEmpire','/PlayExternal','/PlayFarmageddon','/PlayGoldenDragon','/PlayHotPot','/PlayImperialGold','/PlayImperialLightning','/PlayLuckyFortune','/PlayMysticForest','/PlayNeonNights','/PlayOceanTreasure','/PlayPhoenixFire','/PlayRoyalRuby','/PlaySapphireStorm','/PlaySlide','/PlaySlots','/PlayStellarRush','/PlayTwist'));

-- The existing service-only spin RPC must enforce the catalog as well as Edge.
-- This closes direct service entry and deployment-window races without changing
-- outcomes, practice balances or the preserved historical implementation.
do $hold$
declare target regprocedure:='public.ig_slot_practice_spin_v1(uuid,uuid,text,integer,integer,jsonb,jsonb,integer,bigint)'::regprocedure;
 definition text; guarded text;
begin
 select pg_get_functiondef(target) into definition;
 if definition !~* '\mLANGUAGE plpgsql\M' then raise exception 'Unexpected slot entry point language';end if;
 guarded:=regexp_replace(definition,'\mbegin\M',
  E'begin\n if not exists(select 1 from public.ig_practice_game_catalog where backend_slug=''ig-slot-practice-v1'' and slug=p_game and is_active and practice_only and not real_wagers_enabled) then raise exception ''Game is held for release'' using errcode=''42501'';end if;','i');
 if guarded=definition then raise exception 'Slot entry point was not guarded';end if;
 execute guarded;
end $hold$;
notify pgrst,'reload schema';
