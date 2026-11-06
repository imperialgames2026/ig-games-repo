-- Disposable practice state. Every test write rolls back.
begin;
select set_config('butcher.test_actor',(select id::text from auth.users order by id limit 1),true);
set local role service_role;
do $$
declare
 actor uuid:=current_setting('butcher.test_actor')::uuid;
 hero uuid;trial uuid;sword uuid;start_id uuid:=gen_random_uuid();action_id uuid:=gen_random_uuid();
 response jsonb;replay jsonb;original jsonb;next_state jsonb;command jsonb;events jsonb;rejected boolean;
 build jsonb:='{"name":"__TrialRollback","level":1,"archetypeId":"vanguard","abilityScores":{"strength":15,"dexterity":14,"constitution":13,"intelligence":12,"wisdom":10,"charisma":8},"compatibilitySymbols":["MARTIAL","FIELD"],"proficientSkills":["athletics","perception"]}';
begin
 hero:=(public.ig_campaign_character_create_v1(actor,gen_random_uuid(),build)->'character'->>'id')::uuid;
 perform public.ig_campaign_inventory_v1(actor,hero,'claim_starter');
 select id into sword from ig_campaign_v1.inventory_instances where issue_character_id=hero and definition_id='practice_sword';
 perform public.ig_campaign_inventory_v1(actor,hero,'equip',1,sword,'main_hand');
 response:=public.ig_campaign_trial_open_v1(actor,hero,start_id);trial:=(response->'encounter'->>'id')::uuid;original:=response->'encounter'->'state';
 if original->'combatants'->0->'weapon'->>'id'<>'practice_sword' or (original->'combatants'->0->>'maxHitPoints')::int<>11 then raise exception 'Wrong frozen build';end if;
 if public.ig_campaign_trial_open_v1(actor,hero,start_id)->'encounter'->>'id'<>trial::text then raise exception 'Start retry duplicated';end if;
 if public.ig_campaign_trial_open_v1(actor,hero,gen_random_uuid())->'encounter'->>'id'<>trial::text then raise exception 'Concurrent start duplicated';end if;
 if public.ig_campaign_trial_open_v1(actor,hero)->'encounter'->>'id'<>trial::text then raise exception 'Resume lost trial';end if;
 rejected:=false;
 begin perform public.ig_campaign_inventory_v1(actor,hero,'unequip',2,null,'main_hand');exception when sqlstate 'P0003' then rejected:=true;end;
 if not rejected then raise exception 'Loadout changed during trial';end if;
 rejected:=false;
 begin perform public.ig_campaign_trial_open_v1(gen_random_uuid(),hero);exception when no_data_found then rejected:=true;end;
 if not rejected then raise exception 'Cross-owner resume succeeded';end if;
 command:='{"expectedRevision":0,"command":{"type":"move","path":[{"x":3,"y":2}]}}';
 if public.ig_campaign_trial_prepare_v1(actor,trial,action_id,command)->'state'->>'revision'<>'0' then raise exception 'Prepare lost state';end if;
 next_state:=jsonb_set(original,'{revision}','1');next_state:=jsonb_set(next_state,'{combatants,0,position}','{"x":3,"y":2}');next_state:=jsonb_set(next_state,'{combatants,0,movementRemainingFeet}','25');
 events:=jsonb_build_array(jsonb_build_object('kind','move','encounterId',trial,'revisionBefore',0,'revisionAfter',1,'actorId','hero','detail',jsonb_build_object('path',jsonb_build_array(jsonb_build_object('x',3,'y',2)))));
 response:=public.ig_campaign_trial_commit_v1(actor,trial,action_id,command,next_state,events);
 replay:=public.ig_campaign_trial_commit_v1(actor,trial,action_id,command,jsonb_set(next_state,'{revision}','99'),events);
 if response<>replay then raise exception 'Retry changed accepted outcome';end if;
 if public.ig_campaign_trial_prepare_v1(actor,trial,action_id,command)->'replay'<>response then raise exception 'Replay unavailable';end if;
 if (select count(*) from ig_campaign_v1.encounter_actions where encounter_id=trial)<>1 then raise exception 'Retry duplicated action receipt';end if;
 rejected:=false;
 begin perform public.ig_campaign_trial_commit_v1(actor,trial,gen_random_uuid(),command,next_state,events);exception when serialization_failure then rejected:=true;end;
 if not rejected then raise exception 'Stale action committed';end if;
 rejected:=false;
 begin perform public.ig_campaign_trial_prepare_v1(actor,trial,action_id,'{"expectedRevision":1,"command":{"type":"end_turn"}}');exception when invalid_parameter_value then rejected:=true;end;
 if not rejected then raise exception 'Conflicting action ID accepted';end if;
 command:='{"expectedRevision":1,"command":{"type":"abandon"}}';next_state:=next_state||'{"revision":2,"phase":"completed","outcome":"abandoned"}';
 events:=jsonb_build_array(jsonb_build_object('kind','abandon','encounterId',trial,'revisionBefore',1,'revisionAfter',2,'actorId','hero','detail',jsonb_build_object('reason','player_abandoned')));
 perform public.ig_campaign_trial_commit_v1(actor,trial,gen_random_uuid(),command,next_state,events);
 if (select active_encounter_id from ig_campaign_v1.characters where id=hero) is not null then raise exception 'Completion left hero locked';end if;
 if public.ig_campaign_trial_open_v1(actor,hero)->'encounter' is distinct from 'null'::jsonb then raise exception 'Completed trial resumed as active';end if;
 perform public.ig_campaign_inventory_v1(actor,hero,'unequip',2,null,'main_hand');
 if (select loadout_snapshot->'items'->0->>'definitionId' from ig_campaign_v1.encounters where id=trial)<>'practice_sword' then raise exception 'Snapshot changed after unequip';end if;
 if public.ig_campaign_trial_open_v1(actor,hero,start_id)->'encounter'->'state'->>'outcome'<>'abandoned' then raise exception 'Original start retry created new trial';end if;
 -- Exhaust the lab's hourly start budget in the transaction, without API side effects.
 insert into ig_campaign_v1.encounters(owner_user_id,character_id,start_request_id,state,phase,loadout_snapshot)
 select actor,hero,gen_random_uuid(),'{}','completed','{}' from generate_series(1,30);
 rejected:=false;
 begin perform public.ig_campaign_trial_open_v1(actor,hero,gen_random_uuid());exception when sqlstate 'P0005' then rejected:=true;end;
 if not rejected then raise exception 'Start budget bypassed';end if;
 perform set_config('butcher.trials_passed','start-retry;resume;frozen-loadout;equipment-lock;ownership;receipt-replay;single-commit;stale-rejection;conflict-rejection;completion-unlock;no-auto-restart;start-budget',true);
end $$;
reset role;
do $$ begin
 if has_function_privilege('authenticated','public.ig_campaign_trial_commit_v1(uuid,uuid,uuid,jsonb,jsonb,jsonb)','execute')
  or has_function_privilege('anon','public.ig_campaign_trial_open_v1(uuid,uuid,uuid)','execute')
  or has_table_privilege('authenticated','ig_campaign_v1.encounters','select')
  or has_table_privilege('authenticated','ig_campaign_v1.encounter_actions','insert') then raise exception 'Client trial access exposed';end if;
end $$;
select current_setting('butcher.trials_passed') as passed;
rollback;
