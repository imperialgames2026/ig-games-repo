-- Uses disposable heroes on an existing lab account; every write rolls back.
begin;
select set_config('butcher.test_actor',(select id::text from auth.users order by id limit 1),true);
set local role service_role;
do $$
declare
 actor uuid:=current_setting('butcher.test_actor')::uuid;
 hero uuid;
 other_hero uuid;
 sword uuid;
 sword2 uuid;
 rune uuid;
 trail uuid;
 trail2 uuid;
 r jsonb;
 revision bigint;
 rejected boolean;
 build jsonb:='{"name":"__InventoryRollback","level":1,"compatibilitySymbols":["MARTIAL","FIELD"],"proficientSkills":["athletics","survival"]}';
begin
 hero:=(public.ig_campaign_character_create_v1(actor,gen_random_uuid(),build)->'character'->>'id')::uuid;
 other_hero:=(public.ig_campaign_character_create_v1(actor,gen_random_uuid(),build)->'character'->>'id')::uuid;
 r:=public.ig_campaign_inventory_v1(actor,hero,'claim_starter');
 if jsonb_array_length(r->'items')<>7 or (r->>'loadoutRevision')::bigint<>1 then raise exception 'Starter kit not granted'; end if;
 r:=public.ig_campaign_inventory_v1(actor,hero,'claim_starter');
 if jsonb_array_length(r->'items')<>7 or (r->>'loadoutRevision')::bigint<>1 then raise exception 'Retry duplicated starter kit'; end if;
 perform public.ig_campaign_inventory_v1(actor,other_hero,'claim_starter');
 select id into sword from ig_campaign_v1.inventory_instances where issue_character_id=hero and definition_id='practice_sword';
 select id into sword2 from ig_campaign_v1.inventory_instances where issue_character_id=other_hero and definition_id='practice_sword';
 select id into rune from ig_campaign_v1.inventory_instances where issue_character_id=hero and definition_id='spark_rune';
 select id into trail from ig_campaign_v1.inventory_instances where issue_character_id=hero and definition_id='trailcraft';
 select id into trail2 from ig_campaign_v1.inventory_instances where issue_character_id=other_hero and definition_id='trailcraft';
 r:=public.ig_campaign_inventory_v1(actor,hero,'equip',1,sword,'main_hand');
 revision:=(r->>'loadoutRevision')::bigint;
 if revision<>2 then raise exception 'Equip revision not incremented'; end if;
 rejected:=false;
 begin perform public.ig_campaign_inventory_v1(actor,hero,'unequip',1,null,'main_hand');
 exception when serialization_failure then rejected:=true; end;
 if not rejected then raise exception 'Stale change accepted'; end if;
 rejected:=false;
 begin perform public.ig_campaign_inventory_v1(gen_random_uuid(),hero,'inventory');
 exception when no_data_found then rejected:=true; end;
 if not rejected then raise exception 'Cross-owner hero access accepted'; end if;
 rejected:=false;
 begin perform public.ig_campaign_inventory_v1(actor,hero,'equip',2,gen_random_uuid(),'main_hand');
 exception when no_data_found then rejected:=true; end;
 if not rejected then raise exception 'Fabricated asset accepted'; end if;
 rejected:=false;
 begin perform public.ig_campaign_inventory_v1(actor,hero,'equip',2,rune,'skill_1');
 exception when sqlstate 'P0004' then rejected:=true; end;
 if not rejected then raise exception 'Missing family accepted'; end if;
 -- Atomic replacement frees the old item and assigns the new one in one transaction.
 r:=public.ig_campaign_inventory_v1(actor,hero,'equip',2,sword2,'main_hand');
 if (select state from ig_campaign_v1.inventory_instances where id=sword)<>'available'
   or (select equipped_character_id from ig_campaign_v1.inventory_instances where id=sword2)<>hero then raise exception 'Swap inconsistent'; end if;
 r:=public.ig_campaign_inventory_v1(actor,hero,'equip',3,trail,'skill_1');
 rejected:=false;
 begin perform public.ig_campaign_inventory_v1(actor,hero,'equip',4,trail2,'skill_2');
 exception when sqlstate 'P0004' then rejected:=true; end;
 if not rejected then raise exception 'Duplicate skill stacked'; end if;
 -- Family exists but trained skill prerequisite does not.
 update ig_campaign_v1.characters set character_data=character_data||'{"compatibilitySymbols":["MARTIAL","FIELD","ARCANE"]}' where id=hero;
 rejected:=false;
 begin perform public.ig_campaign_inventory_v1(actor,hero,'equip',4,rune,'skill_2');
 exception when sqlstate 'P0004' then rejected:=true; end;
 if not rejected then raise exception 'Missing skill rank accepted'; end if;
 update ig_campaign_v1.characters set active_encounter_id=gen_random_uuid() where id=hero;
 rejected:=false;
 begin perform public.ig_campaign_inventory_v1(actor,hero,'unequip',4,null,'skill_1');
 exception when sqlstate 'P0003' then rejected:=true; end;
 if not rejected then raise exception 'Active encounter allowed change'; end if;
 update ig_campaign_v1.characters set active_encounter_id=null where id=hero;
 update ig_campaign_v1.inventory_instances set active_encounter_locks=array[gen_random_uuid()] where id=trail;
 rejected:=false;
 begin perform public.ig_campaign_inventory_v1(actor,hero,'unequip',4,null,'skill_1');
 exception when sqlstate 'P0003' then rejected:=true; end;
 if not rejected then raise exception 'Locked asset released'; end if;
 update ig_campaign_v1.inventory_instances set active_encounter_locks='{}' where id=trail;
 r:=public.ig_campaign_inventory_v1(actor,hero,'unequip',4,null,'skill_1');
 if (r->>'loadoutRevision')::bigint<>5 or (select state from ig_campaign_v1.inventory_instances where id=trail)<>'available' then raise exception 'Unequip failed'; end if;
 -- Reject wrong slots, insufficient level, missing subskills and unavailable states.
 rejected:=false;
 begin perform public.ig_campaign_inventory_v1(actor,hero,'equip',5,sword,'body');
 exception when sqlstate 'P0004' then rejected:=true; end;
 if not rejected then raise exception 'Wrong equipment slot accepted'; end if;
 update ig_campaign_v1.inventory_instances set state='listed' where id=sword;
 rejected:=false;
 begin perform public.ig_campaign_inventory_v1(actor,hero,'equip',5,sword,'main_hand');
 exception when sqlstate 'P0003' then rejected:=true; end;
 if not rejected then raise exception 'Listed asset reused'; end if;
 select id into rune from ig_campaign_v1.inventory_instances where issue_character_id=hero and definition_id='advanced_brewing';
 update ig_campaign_v1.characters set character_data=character_data||'{"compatibilitySymbols":["ALCHEMY"]}' where id=hero;
 rejected:=false;
 begin perform public.ig_campaign_inventory_v1(actor,hero,'equip',5,rune,'skill_1');
 exception when sqlstate 'P0004' then rejected:=true; end;
 if not rejected then raise exception 'Minimum level bypassed'; end if;
 update ig_campaign_v1.characters set character_data=character_data||'{"level":2}' where id=hero;
 rejected:=false;
 begin perform public.ig_campaign_inventory_v1(actor,hero,'equip',5,rune,'skill_1');
 exception when sqlstate 'P0004' then rejected:=true; end;
 if not rejected then raise exception 'Subskill rank bypassed'; end if;
 update ig_campaign_v1.characters set character_data=character_data||'{"skillRanks":{"alchemy.potions":2}}' where id=hero;
 r:=public.ig_campaign_inventory_v1(actor,hero,'equip',5,rune,'skill_1');
 if (r->>'loadoutRevision')::bigint<>6 then raise exception 'Qualified subskill rejected'; end if;
 perform set_config('butcher.inventory_passed','starter-idempotency;ownership;stale-revision;atomic-swap;symbols;ranks;duplicate-skill;encounter-lock;asset-lock;unequip;slot;listed-state;level;subskill',true);
end $$;
reset role;
do $$ begin
 if has_function_privilege('authenticated','public.ig_campaign_inventory_v1(uuid,uuid,text,bigint,uuid,text)','execute')
   or has_function_privilege('anon','public.ig_campaign_inventory_v1(uuid,uuid,text,bigint,uuid,text)','execute')
   or has_table_privilege('authenticated','ig_campaign_v1.inventory_instances','select')
   or has_table_privilege('authenticated','ig_campaign_v1.inventory_instances','insert') then
   raise exception 'Client privileges exposed';
 end if;
end $$;
select current_setting('butcher.inventory_passed') as passed;
rollback;
