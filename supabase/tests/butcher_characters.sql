-- Lab integration verification. All inserted character data is rolled back.
begin;
do $$ begin
  perform set_config('butcher.test_actor', (select id::text from auth.users order by id limit 1), true);
  if current_setting('butcher.test_actor', true) is null then
    raise exception 'An existing lab Auth user is required for transactional verification';
  end if;
end $$;
set local role service_role;
do $$
declare
  actor uuid := current_setting('butcher.test_actor')::uuid;
  request uuid := gen_random_uuid();
  payload jsonb := '{"name":"__ButcherRollbackTest","level":1}'::jsonb;
  first_result jsonb;
  second_result jsonb;
  conflict_rejected boolean := false;
begin
  first_result := public.ig_campaign_character_create_v1(actor, request, payload);
  second_result := public.ig_campaign_character_create_v1(actor, request, payload);
  if first_result->'character'->>'id' is distinct from second_result->'character'->>'id' then
    raise exception 'Retry created a different character';
  end if;
  if (select count(*) from ig_campaign_v1.characters where owner_user_id=actor and creation_request_id=request) <> 1 then
    raise exception 'Retry duplicated a row';
  end if;
  begin
    perform public.ig_campaign_character_create_v1(actor, request, payload || '{"name":"Changed"}'::jsonb);
  exception when invalid_parameter_value then conflict_rejected := true;
  end;
  if not conflict_rejected then raise exception 'Conflicting request ID was accepted'; end if;
  if public.ig_campaign_characters_list_v1(gen_random_uuid())->'characters' <> '[]'::jsonb then
    raise exception 'Another account received character rows';
  end if;
  perform set_config('butcher.test_passed', 'retry-stable;single-row;conflict-rejected;owner-isolated', true);
end $$;
reset role;
select current_setting('butcher.test_passed') as transactional_checks,
  not has_function_privilege('anon','public.ig_campaign_character_create_v1(uuid,uuid,jsonb)','EXECUTE') as anon_rpc_denied,
  not has_function_privilege('authenticated','public.ig_campaign_character_create_v1(uuid,uuid,jsonb)','EXECUTE') as authenticated_rpc_denied,
  not has_table_privilege('authenticated','ig_campaign_v1.characters','SELECT') as direct_table_read_denied,
  not has_table_privilege('authenticated','ig_campaign_v1.characters','INSERT') as direct_table_write_denied;
rollback;
