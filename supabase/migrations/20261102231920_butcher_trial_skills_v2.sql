-- Only new trials gain resource/skill fields. Existing saved trials retain their frozen state.
create or replace function public.ig_campaign_trial_open_v1(p_user_id uuid,p_character_id uuid,p_request_id uuid default null)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare
 c ig_campaign_v1.characters%rowtype;
 e ig_campaign_v1.encounters%rowtype;
 data jsonb;
 scores jsonb;
 equipment jsonb;
 weapon jsonb;
 weapon_id text;
 conmod integer;
 dexmod integer;
 hd integer;
 hp integer;
 lvl integer;
 coat boolean;
 skill_ids jsonb;
begin
 if p_user_id is null or p_character_id is null then raise exception 'Invalid hero' using errcode='22023'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('butcher:'||p_user_id::text,0));
 select * into c from ig_campaign_v1.characters where id=p_character_id and owner_user_id=p_user_id for update;
 if not found then raise exception 'Hero unavailable' using errcode='P0002'; end if;
 if p_request_id is not null then
  select * into e from ig_campaign_v1.encounters where owner_user_id=p_user_id and start_request_id=p_request_id;
  if found then
   if e.character_id<>c.id then raise exception 'Request conflict' using errcode='22023'; end if;
   return jsonb_build_object('encounter',jsonb_build_object('id',e.id,'characterId',e.character_id,'state',e.state),'events','[]'::jsonb);
  end if;
 end if;
 if c.active_encounter_id is not null then
  select * into e from ig_campaign_v1.encounters where id=c.active_encounter_id and owner_user_id=p_user_id and character_id=c.id and phase='active';
  if not found then raise exception 'Hero is locked' using errcode='P0003'; end if;
  return jsonb_build_object('encounter',jsonb_build_object('id',e.id,'characterId',c.id,'state',e.state),'events','[]'::jsonb);
 end if;
 -- A null request ID means read/resume only. Never creates a new mission.
 if p_request_id is null then return jsonb_build_object('encounter',null,'events','[]'::jsonb); end if;
 if (select count(*) from ig_campaign_v1.encounters where owner_user_id=p_user_id and created_at>now()-interval '1 hour')>=30 then raise exception 'Trial start limit reached' using errcode='P0005';end if;
 data:=c.character_data;scores:=data->'abilityScores';lvl:=(data->>'level')::integer;
 if scores is null or lvl is null or lvl not between 1 and 20 then raise exception 'Invalid hero build' using errcode='P0004'; end if;
 conmod:=floor(((scores->>'constitution')::numeric-10)/2);
 dexmod:=floor(((scores->>'dexterity')::numeric-10)/2);
 hd:=case data->>'archetypeId' when 'spellweaver' then 6 when 'wildscout' then 8 else 10 end;
 hp:=greatest(1,hd+conmod+(lvl-1)*greatest(1,hd/2+1+conmod));
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'definitionId',definition_id,'definitionVersion',definition_version,'slot',equipped_slot) order by equipped_slot),'[]')
  into equipment from ig_campaign_v1.inventory_instances where equipped_character_id=c.id and state='equipped';
 if exists(select 1 from ig_campaign_v1.inventory_instances where equipped_character_id=c.id and cardinality(active_encounter_locks)>0) then raise exception 'Loadout locked' using errcode='P0003'; end if;
 select definition_id into weapon_id from ig_campaign_v1.inventory_instances where equipped_character_id=c.id and equipped_slot='main_hand' and definition_version=1;
 if weapon_id is not null and weapon_id not in ('practice_sword','practice_staff') then raise exception 'Unsupported practice weapon' using errcode='P0004'; end if;
 coat:=exists(select 1 from ig_campaign_v1.inventory_instances where equipped_character_id=c.id and equipped_slot='body' and definition_id='travel_coat' and definition_version=1);
 weapon:=jsonb_build_object('id',coalesce(weapon_id,'practice_unarmed'),'attackAbility',case when weapon_id='practice_staff' then 'intelligence' else 'strength' end,
  'damageAbility',case when weapon_id='practice_staff' then 'intelligence' else 'strength' end,'proficient',true,'attackFlatBonus',0,'damageFlatBonus',0,
  'rangeFeet',5,'damageDiceCount',1,'damageDieSides',case when weapon_id is null then 4 else 6 end);
 e.id:=gen_random_uuid();
 e.state:=jsonb_build_object('id',e.id,'revision',0,'phase','active','outcome',null,
  'map',jsonb_build_object('width',8,'height',8,'tileSizeFeet',5,'blockedCells',jsonb_build_array('4,4','4,5')),
  'turnOrder',jsonb_build_array('hero','sentinel'),'activeTurnIndex',0,
  'combatants',jsonb_build_array(
   jsonb_build_object('id','hero','ownerUserId',p_user_id,'team','heroes','name',c.name,'level',lvl,'abilities',scores,'armorClass',greatest(1,10+dexmod+case when coat then 1 else 0 end),
    'hitPoints',hp,'maxHitPoints',hp,'position',jsonb_build_object('x',2,'y',2),'movementPerTurnFeet',30,'movementRemainingFeet',30,'actionUsed',false,'weapon',weapon),
   jsonb_build_object('id','sentinel','ownerUserId',null,'team','hostiles','name','Camp Sentinel','level',1,
    'abilities','{"strength":12,"dexterity":10,"constitution":10,"intelligence":8,"wisdom":10,"charisma":8}'::jsonb,'armorClass',11,'hitPoints',10,'maxHitPoints',10,
    'position',jsonb_build_object('x',5,'y',2),'movementPerTurnFeet',20,'movementRemainingFeet',20,'actionUsed',false,
    'weapon','{"id":"training_strike","attackAbility":"strength","damageAbility":"strength","proficient":false,"attackFlatBonus":0,"damageFlatBonus":0,"rangeFeet":5,"damageDiceCount":1,"damageDieSides":4}'::jsonb)));
 -- Freeze only supported combat skills from equipped, versioned item definitions.
 select coalesce(jsonb_agg(distinct granted.id order by granted.id),'[]'::jsonb) into skill_ids
 from ig_campaign_v1.inventory_instances i
 join ig_campaign_v1.item_definitions d on d.id=i.definition_id and d.version=i.definition_version
 cross join lateral unnest(d.granted_ability_ids) as granted(id)
 where i.equipped_character_id=c.id and i.state='equipped' and i.definition_version=1
   and granted.id in ('spark_burst','guarding_vow');
 e.state:=jsonb_set(e.state,'{combatants,0}',(e.state->'combatants'->0)||jsonb_build_object('abilityIds',skill_ids,'mana',3,'maxMana',3,'wardArmorBonus',0));
 e.state:=jsonb_set(e.state,'{combatants,1}',(e.state->'combatants'->1)||jsonb_build_object('abilityIds','[]'::jsonb,'mana',0,'maxMana',0,'wardArmorBonus',0));
 e.state:=e.state||jsonb_build_object('contentVersion','trial-skills-v2');
 insert into ig_campaign_v1.encounters(id,owner_user_id,character_id,start_request_id,state,phase,loadout_snapshot)
 values(e.id,p_user_id,c.id,p_request_id,e.state,'active',jsonb_build_object('character',data,'loadoutRevision',c.loadout_revision,'items',equipment));
 update ig_campaign_v1.characters set active_encounter_id=e.id where id=c.id;
 return jsonb_build_object('encounter',jsonb_build_object('id',e.id,'characterId',c.id,'state',e.state),'events','[]'::jsonb);
end;
$$;

revoke all on function public.ig_campaign_trial_open_v1(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.ig_campaign_trial_open_v1(uuid,uuid,uuid) to service_role;
