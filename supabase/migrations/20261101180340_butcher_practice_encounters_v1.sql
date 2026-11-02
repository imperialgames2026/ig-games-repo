-- Lab-only solo practice encounters. No progression, rewards, wagers or asset transfers.
create table ig_campaign_v1.encounters (
 id uuid primary key default gen_random_uuid(),
 owner_user_id uuid not null references auth.users(id) on delete cascade,
 character_id uuid not null references ig_campaign_v1.characters(id) on delete cascade,
 start_request_id uuid not null,
 rules_version text not null default 'imperial-d20-v1' check(rules_version='imperial-d20-v1'),
 state jsonb not null check(jsonb_typeof(state)='object' and octet_length(state::text)<=65536),
 loadout_snapshot jsonb not null,
 phase text not null check(phase in ('active','completed')),
 revision bigint not null default 0 check(revision>=0),
 accepted_actions integer not null default 0 check(accepted_actions>=0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(owner_user_id,start_request_id)
);
create unique index campaign_one_active_trial on ig_campaign_v1.encounters(character_id) where phase='active';
create index campaign_encounters_character_idx on ig_campaign_v1.encounters(character_id);
create index campaign_encounters_owner_idx on ig_campaign_v1.encounters(owner_user_id,created_at desc);
create table ig_campaign_v1.encounter_actions (
 encounter_id uuid not null references ig_campaign_v1.encounters(id) on delete cascade,
 request_id uuid not null,
 command jsonb not null,
 response jsonb not null check(octet_length(response::text)<=131072),
 created_at timestamptz not null default now(),
 primary key(encounter_id,request_id)
);
alter table ig_campaign_v1.encounters enable row level security;
alter table ig_campaign_v1.encounter_actions enable row level security;
revoke all on ig_campaign_v1.encounters,ig_campaign_v1.encounter_actions from public,anon,authenticated;
grant select,insert,update on ig_campaign_v1.encounters to service_role;
grant select,insert on ig_campaign_v1.encounter_actions to service_role;
create policy campaign_encounters_service on ig_campaign_v1.encounters for all to service_role using(true) with check(true);
create policy campaign_actions_service on ig_campaign_v1.encounter_actions for all to service_role using(true) with check(true);

create function public.ig_campaign_trial_open_v1(p_user_id uuid,p_character_id uuid,p_request_id uuid default null)
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
 insert into ig_campaign_v1.encounters(id,owner_user_id,character_id,start_request_id,state,phase,loadout_snapshot)
 values(e.id,p_user_id,c.id,p_request_id,e.state,'active',jsonb_build_object('character',data,'loadoutRevision',c.loadout_revision,'items',equipment));
 update ig_campaign_v1.characters set active_encounter_id=e.id where id=c.id;
 return jsonb_build_object('encounter',jsonb_build_object('id',e.id,'characterId',c.id,'state',e.state),'events','[]'::jsonb);
end;
$$;

create function public.ig_campaign_trial_prepare_v1(p_user_id uuid,p_encounter_id uuid,p_request_id uuid,p_command jsonb)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare e ig_campaign_v1.encounters%rowtype;r ig_campaign_v1.encounter_actions%rowtype;
begin
 select * into e from ig_campaign_v1.encounters where id=p_encounter_id and owner_user_id=p_user_id;
 if not found then raise exception 'Trial unavailable' using errcode='P0002';end if;
 select * into r from ig_campaign_v1.encounter_actions where encounter_id=e.id and request_id=p_request_id;
 if found then
  if r.command is distinct from p_command then raise exception 'Request conflict' using errcode='22023';end if;
  return jsonb_build_object('replay',r.response);
 end if;
 if e.phase='completed' then raise exception 'Trial completed' using errcode='P0003';end if;
 if e.accepted_actions>=200 and p_command->'command'->>'type' is distinct from 'abandon' then raise exception 'Trial limit reached. Leave trial.' using errcode='P0003';end if;
 return jsonb_build_object('state',e.state);
end;
$$;

create function public.ig_campaign_trial_commit_v1(p_user_id uuid,p_encounter_id uuid,p_request_id uuid,p_command jsonb,p_next_state jsonb,p_events jsonb)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare e ig_campaign_v1.encounters%rowtype;r ig_campaign_v1.encounter_actions%rowtype;response jsonb;next_revision bigint;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('butcher:'||p_user_id::text,0));
 select * into e from ig_campaign_v1.encounters where id=p_encounter_id and owner_user_id=p_user_id for update;
 if not found then raise exception 'Trial unavailable' using errcode='P0002';end if;
 select * into r from ig_campaign_v1.encounter_actions where encounter_id=e.id and request_id=p_request_id;
 if found then
  if r.command is distinct from p_command then raise exception 'Request conflict' using errcode='22023';end if;
  return r.response;
 end if;
 if e.phase='completed' then raise exception 'Trial completed' using errcode='P0003';end if;
 if e.accepted_actions>=200 and p_command->'command'->>'type' is distinct from 'abandon' then raise exception 'Trial limit reached' using errcode='P0003';end if;
 if (p_command->>'expectedRevision')::bigint is distinct from e.revision then raise exception 'Stale trial' using errcode='40001';end if;
 next_revision:=(p_next_state->>'revision')::bigint;
 if p_request_id is null or p_next_state->>'id' is distinct from e.id::text or next_revision is null or next_revision<=e.revision
  or next_revision>e.revision+33 or p_next_state->>'phase' is null or p_next_state->>'phase' not in ('active','completed')
  or jsonb_typeof(p_events) is distinct from 'array' or jsonb_array_length(p_events)<>next_revision-e.revision then
  raise exception 'Invalid trial transition' using errcode='22023';end if;
 if exists(select 1 from jsonb_array_elements(p_events) with ordinality a(event,n) where
  event->>'encounterId' is distinct from e.id::text or (event->>'revisionBefore')::bigint is distinct from e.revision+n-1
  or (event->>'revisionAfter')::bigint is distinct from e.revision+n) then raise exception 'Invalid event sequence' using errcode='22023';end if;
 update ig_campaign_v1.encounters set state=p_next_state,phase=p_next_state->>'phase',revision=next_revision,accepted_actions=accepted_actions+1,updated_at=now() where id=e.id;
 if p_next_state->>'phase'='completed' then
  update ig_campaign_v1.characters set active_encounter_id=null where id=e.character_id and active_encounter_id=e.id;
 end if;
 response:=jsonb_build_object('encounter',jsonb_build_object('id',e.id,'characterId',e.character_id,'state',p_next_state),'events',p_events);
 insert into ig_campaign_v1.encounter_actions(encounter_id,request_id,command,response) values(e.id,p_request_id,p_command,response);
 return response;
end;
$$;
revoke all on function public.ig_campaign_trial_open_v1(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.ig_campaign_trial_prepare_v1(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.ig_campaign_trial_commit_v1(uuid,uuid,uuid,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.ig_campaign_trial_open_v1(uuid,uuid,uuid) to service_role;
grant execute on function public.ig_campaign_trial_prepare_v1(uuid,uuid,uuid,jsonb) to service_role;
grant execute on function public.ig_campaign_trial_commit_v1(uuid,uuid,uuid,jsonb,jsonb,jsonb) to service_role;
