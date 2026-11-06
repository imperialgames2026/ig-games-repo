-- Skill freezing/resources verification. Every inserted hero/trial/item rolls back.
begin;
select set_config('butcher.test_actor',(select id::text from auth.users order by id limit 1),true);
set local role service_role;
do $$
declare
 actor uuid:=current_setting('butcher.test_actor')::uuid; hero uuid; rune uuid; trial uuid; initial jsonb; again jsonb;
 build jsonb:='{"name":"__SkillRollback","level":1,"archetypeId":"spellweaver","abilityScores":{"strength":8,"dexterity":12,"constitution":13,"intelligence":15,"wisdom":10,"charisma":14},"compatibilitySymbols":["ARCANE","SCHOLAR"],"proficientSkills":["arcana","lore"]}';
begin
 hero:=(public.ig_campaign_character_create_v1(actor,gen_random_uuid(),build)->'character'->>'id')::uuid;
 perform public.ig_campaign_inventory_v1(actor,hero,'claim_starter');
 select id into rune from ig_campaign_v1.inventory_instances where issue_character_id=hero and definition_id='spark_rune';
 perform public.ig_campaign_inventory_v1(actor,hero,'equip',1,rune,'skill_1');
 initial:=public.ig_campaign_trial_open_v1(actor,hero,gen_random_uuid());trial:=(initial->'encounter'->>'id')::uuid;
 if initial->'encounter'->'state'->>'contentVersion'<>'trial-skills-v2'
  or initial->'encounter'->'state'->'combatants'->0->'abilityIds'<>'["spark_burst"]'::jsonb
  or (initial->'encounter'->'state'->'combatants'->0->>'mana')::int<>3
  or (initial->'encounter'->'state'->'combatants'->0->>'maxMana')::int<>3 then raise exception 'Skill snapshot or resource pool incorrect';end if;
 again:=public.ig_campaign_trial_open_v1(actor,hero);
 if again<>initial then raise exception 'Resume changed mana or skill snapshot';end if;
 -- Simulate a pre-skill saved trial; opening it must not backfill new resources or skills.
 update ig_campaign_v1.encounters set state=(state-'contentVersion')#-'{combatants,0,abilityIds}'#-'{combatants,0,mana}'#-'{combatants,0,maxMana}'#-'{combatants,0,wardArmorBonus}' where id=trial;
 again:=public.ig_campaign_trial_open_v1(actor,hero);
 if again->'encounter'->'state'->'combatants'->0 ? 'mana' then raise exception 'Legacy trial was altered during resume';end if;
 -- A second hero owns the kit but has equipped no rune: possession alone grants no skill.
 hero:=(public.ig_campaign_character_create_v1(actor,gen_random_uuid(),build)->'character'->>'id')::uuid;
 perform public.ig_campaign_inventory_v1(actor,hero,'claim_starter');
 initial:=public.ig_campaign_trial_open_v1(actor,hero,gen_random_uuid());
 if initial->'encounter'->'state'->'combatants'->0->'abilityIds'<>'[]'::jsonb then raise exception 'Unequipped item granted a skill';end if;
 perform set_config('butcher.skills_passed','equipped-only;versioned-content;mana-pool;resume-preserves-resources;legacy-preserved',true);
end $$;
reset role;
select current_setting('butcher.skills_passed') as passed;
rollback;
