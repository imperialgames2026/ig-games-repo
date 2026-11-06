-- Additive, lab-only practice inventory. No tokens, transfers, burns or wallet writes.
alter table ig_campaign_v1.characters
  add column loadout_revision bigint not null default 0 check (loadout_revision >= 0),
  add column active_encounter_id uuid;

create table ig_campaign_v1.item_definitions (
  id text not null,
  version integer not null check (version > 0),
  name text not null,
  kind text not null check (kind in ('weapon','gear','skill')),
  allowed_slots text[] not null,
  required_symbols text[] not null default '{}',
  minimum_level integer not null default 1 check (minimum_level > 0),
  required_skill_ranks jsonb not null default '{}' check (jsonb_typeof(required_skill_ranks)='object'),
  granted_ability_ids text[] not null default '{}',
  primary key (id,version)
);
create table ig_campaign_v1.starter_claims (
  character_id uuid primary key references ig_campaign_v1.characters(id) on delete cascade,
  claimed_at timestamptz not null default now()
);
create table ig_campaign_v1.inventory_instances (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  definition_id text not null,
  definition_version integer not null,
  source text not null default 'practice' check (source='practice'),
  issue_character_id uuid not null references ig_campaign_v1.characters(id) on delete cascade,
  state text not null default 'available' check (state in ('available','equipped','listed','reserved','consumed')),
  equipped_character_id uuid references ig_campaign_v1.characters(id) on delete cascade,
  equipped_slot text check (equipped_slot in ('main_hand','off_hand','head','body','feet','accessory','skill_1','skill_2','skill_3')),
  active_encounter_locks uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  foreign key (definition_id,definition_version) references ig_campaign_v1.item_definitions(id,version),
  unique (issue_character_id,definition_id,definition_version),
  unique (equipped_character_id,equipped_slot),
  check ((state='equipped' and equipped_character_id is not null and equipped_slot is not null)
      or (state<>'equipped' and equipped_character_id is null and equipped_slot is null))
);
create index inventory_instances_owner_idx on ig_campaign_v1.inventory_instances(owner_user_id);
create index inventory_instances_equipped_idx on ig_campaign_v1.inventory_instances(equipped_character_id);

alter table ig_campaign_v1.item_definitions enable row level security;
alter table ig_campaign_v1.starter_claims enable row level security;
alter table ig_campaign_v1.inventory_instances enable row level security;
revoke all on ig_campaign_v1.item_definitions, ig_campaign_v1.starter_claims, ig_campaign_v1.inventory_instances from public, anon, authenticated;
grant select on ig_campaign_v1.item_definitions to service_role;
grant select,insert on ig_campaign_v1.starter_claims to service_role;
grant select,insert,update on ig_campaign_v1.inventory_instances to service_role;
create policy campaign_catalog_service on ig_campaign_v1.item_definitions for select to service_role using(true);
create policy campaign_claims_service on ig_campaign_v1.starter_claims for all to service_role using(true) with check(true);
create policy campaign_inventory_service on ig_campaign_v1.inventory_instances for all to service_role using(true) with check(true);

insert into ig_campaign_v1.item_definitions
 (id,version,name,kind,allowed_slots,required_symbols,minimum_level,required_skill_ranks,granted_ability_ids) values
 ('practice_sword',1,'Training Sword','weapon','{main_hand}','{MARTIAL}',1,'{}','{}'),
 ('practice_staff',1,'Training Staff','weapon','{main_hand}','{ARCANE}',1,'{}','{}'),
 ('travel_coat',1,'Travel Coat','gear','{body}','{}',1,'{}','{}'),
 ('spark_rune',1,'Spark Rune','skill','{skill_1,skill_2,skill_3}','{ARCANE}',1,'{"arcana":1}','{spark_burst}'),
 ('oath_ward',1,'Oath Ward','skill','{skill_1,skill_2,skill_3}','{OATH}',1,'{}','{guarding_vow}'),
 ('trailcraft',1,'Trailcraft','skill','{skill_1,skill_2,skill_3}','{FIELD}',1,'{"survival":1}','{read_trail}'),
 ('advanced_brewing',1,'Advanced Brewing','skill','{skill_1,skill_2,skill_3}','{ALCHEMY}',2,'{"alchemy.potions":2}','{brew_mana}');

create function public.ig_campaign_inventory_v1(
 p_user_id uuid, p_character_id uuid, p_action text,
 p_expected_revision bigint default null, p_item_id uuid default null, p_slot text default null
) returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare
 c ig_campaign_v1.characters%rowtype;
 i ig_campaign_v1.inventory_instances%rowtype;
 d ig_campaign_v1.item_definitions%rowtype;
 requirement record;
 rank integer;
 granted integer;
begin
 if p_user_id is null or p_character_id is null or p_action is null
   or p_action not in ('inventory','claim_starter','equip','unequip') then
   raise exception 'Invalid inventory request' using errcode='22023';
 end if;
 -- All equipment mutations for an account share one transaction lock, including
 -- swaps across heroes. A character row is also locked for encounter integration.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('butcher:'||p_user_id::text,0));
 select * into c from ig_campaign_v1.characters where id=p_character_id and owner_user_id=p_user_id for update;
 if not found then raise exception 'Hero unavailable' using errcode='P0002'; end if;
 if p_action<>'inventory' and c.active_encounter_id is not null then
   raise exception 'Loadout locked' using errcode='P0003';
 end if;
 if p_action='claim_starter' then
   insert into ig_campaign_v1.starter_claims(character_id) values(c.id) on conflict do nothing;
   get diagnostics granted = row_count;
   if granted>0 then
     insert into ig_campaign_v1.inventory_instances(owner_user_id,definition_id,definition_version,issue_character_id)
       select p_user_id,id,version,c.id from ig_campaign_v1.item_definitions
       where version=1 and id in ('practice_sword','practice_staff','travel_coat','spark_rune','oath_ward','trailcraft','advanced_brewing');
     update ig_campaign_v1.characters set loadout_revision=loadout_revision+1,updated_at=now() where id=c.id returning * into c;
   end if;
 elsif p_action in ('equip','unequip') then
   if p_expected_revision is null or p_expected_revision<>c.loadout_revision then
     raise exception 'Refresh loadout' using errcode='40001';
   end if;
   if p_slot is null or p_slot not in ('main_hand','off_hand','head','body','feet','accessory','skill_1','skill_2','skill_3') then
     raise exception 'Invalid slot' using errcode='22023';
   end if;
   -- Never replace or release an asset locked by another operation.
   if exists(select 1 from ig_campaign_v1.inventory_instances where equipped_character_id=c.id
     and equipped_slot=p_slot and cardinality(active_encounter_locks)>0) then
     raise exception 'Item locked' using errcode='P0003';
   end if;
   if p_action='equip' then
     select * into i from ig_campaign_v1.inventory_instances where id=p_item_id and owner_user_id=p_user_id for update;
     if not found then raise exception 'Item unavailable' using errcode='P0002'; end if;
     if i.state<>'available' or cardinality(i.active_encounter_locks)>0 then
       raise exception 'Item unavailable' using errcode='P0003';
     end if;
     select * into d from ig_campaign_v1.item_definitions where id=i.definition_id and version=i.definition_version;
     if not found then raise exception 'Definition unavailable' using errcode='P0002'; end if;
     if not (p_slot=any(d.allowed_slots)) or coalesce((c.character_data->>'level')::integer,0)<d.minimum_level
       or not coalesce((c.character_data->'compatibilitySymbols') @> to_jsonb(d.required_symbols),false) then
       raise exception 'Requirements not met' using errcode='P0004';
     end if;
     for requirement in select key,value from jsonb_each_text(d.required_skill_ranks) loop
       rank := coalesce((c.character_data->'skillRanks'->>requirement.key)::integer,0);
       if coalesce((c.character_data->'proficientSkills') ? requirement.key,false) then rank:=greatest(rank,1); end if;
       if rank<requirement.value::integer then raise exception 'Skill rank required' using errcode='P0004'; end if;
     end loop;
     if d.kind='skill' and exists(select 1 from ig_campaign_v1.inventory_instances where equipped_character_id=c.id
       and definition_id=d.id and equipped_slot<>p_slot) then
       raise exception 'Skill already equipped' using errcode='P0004';
     end if;
   end if;
   update ig_campaign_v1.inventory_instances set state='available',equipped_character_id=null,equipped_slot=null
     where equipped_character_id=c.id and equipped_slot=p_slot;
   if p_action='equip' then
     update ig_campaign_v1.inventory_instances set state='equipped',equipped_character_id=c.id,equipped_slot=p_slot where id=i.id;
   end if;
   update ig_campaign_v1.characters set loadout_revision=loadout_revision+1,updated_at=now() where id=c.id returning * into c;
 end if;
 return jsonb_build_object('characterId',c.id,'loadoutRevision',c.loadout_revision,
   'locked',c.active_encounter_id is not null,
   'starterClaimed',exists(select 1 from ig_campaign_v1.starter_claims where character_id=c.id),
   'symbols',c.character_data->'compatibilitySymbols',
   'items',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'definitionId',a.definition_id,
     'definitionVersion',a.definition_version,'name',b.name,'kind',b.kind,'state',a.state,'source',a.source,
     'equippedCharacterId',a.equipped_character_id,'slot',a.equipped_slot,'allowedSlots',b.allowed_slots,
     'requiredSymbols',b.required_symbols,'minimumLevel',b.minimum_level,'requiredSkillRanks',b.required_skill_ranks,
     'grantedAbilityIds',b.granted_ability_ids) order by b.kind,b.name,a.id)
     from ig_campaign_v1.inventory_instances a join ig_campaign_v1.item_definitions b on b.id=a.definition_id and b.version=a.definition_version
     where a.owner_user_id=p_user_id),'[]'::jsonb));
end;
$$;
revoke all on function public.ig_campaign_inventory_v1(uuid,uuid,text,bigint,uuid,text) from public,anon,authenticated;
grant execute on function public.ig_campaign_inventory_v1(uuid,uuid,text,bigint,uuid,text) to service_role;
