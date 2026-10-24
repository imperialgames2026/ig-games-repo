begin;
do $$ begin
 if exists(select 1 from public.ig_practice_game_catalog where backend_slug='ig-slot-practice-v1' and is_active) then
  raise exception 'Held slot catalog was activated';end if;
 if (select count(*) from public.ig_practice_game_catalog where is_active and practice_only and not real_wagers_enabled)<>20 then
  raise exception 'Approved practice catalog changed';end if;
 begin
  update public.ig_practice_game_catalog set is_active=true where slug='mystic-forest';
  raise exception 'Held game activation was accepted';
 exception when check_violation then null;end;
 if not has_function_privilege('service_role','public.ig_slot_practice_spin_v1(uuid,uuid,text,integer,integer,jsonb,jsonb,integer,bigint)','execute') then
  raise exception 'Test must exercise the existing service entry point';end if;
end $$;
set local role service_role;
do $$ declare message text;begin
 begin
  perform public.ig_slot_practice_spin_v1('11111111-1111-4111-8111-111111111111',gen_random_uuid(),'mystic-forest',1,1,'[]','[]',0,0);
  raise exception 'Held game reached settlement';
 exception when insufficient_privilege then
  get stacked diagnostics message=message_text;
  if message<>'Game is held for release' then raise exception 'Unexpected denial: %',message;end if;
 end;
end $$;
reset role;
rollback;
