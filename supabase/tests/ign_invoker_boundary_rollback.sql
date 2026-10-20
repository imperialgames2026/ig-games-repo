begin;
do $test$
declare
 actor uuid:=gen_random_uuid(); other_actor uuid:=gen_random_uuid();
 operation uuid:=gen_random_uuid(); first_result jsonb; replay jsonb;
begin
 if (select prosecdef from pg_proc where oid='public.ign_action(text,numeric,uuid,boolean)'::regprocedure) then
  raise exception 'Public IGN endpoint must use invoker security'; end if;
 if not (select prosecdef from pg_proc where oid='internal.ign_action(text,numeric,uuid,boolean)'::regprocedure) then
  raise exception 'Private implementation lost definer security'; end if;
 if has_function_privilege('anon','public.ign_action(text,numeric,uuid,boolean)','EXECUTE')
 or has_function_privilege('anon','internal.ign_action(text,numeric,uuid,boolean)','EXECUTE') then
  raise exception 'Anonymous execution granted'; end if;
 if has_table_privilege('authenticated','public.ign_accounts','INSERT')
 or has_table_privilege('authenticated','public.ign_accounts','UPDATE') then
  raise exception 'Authenticated caller can write IGN accounts directly'; end if;
 if (select proconfig from pg_proc where oid='internal.ign_action(text,numeric,uuid,boolean)'::regprocedure)
 is distinct from array['search_path=""']::text[] then raise exception 'Unsafe private search path'; end if;
 insert into auth.users(id,email) values(actor,'ign-boundary-'||actor||'@example.invalid'),
 (other_actor,'ign-boundary-'||other_actor||'@example.invalid');
 perform set_config('request.jwt.claim.sub',actor::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','is_anonymous',false)::text,true);
 set local role authenticated;
 first_result:=public.ign_action('demo_grant',null,operation);
 perform public.ign_action('stake',10,gen_random_uuid());
 replay:=public.ign_action('demo_grant',null,operation);
 if replay is distinct from first_result then raise exception 'Replay response changed'; end if;
 begin
  perform public.ign_action('stake',10,operation);
  raise exception 'Changed-payload replay accepted';
 exception when sqlstate '22023' then null; end;
 reset role;
 if (select available from public.ign_accounts where user_id=actor)<>990
 or exists(select 1 from public.ign_accounts where user_id=other_actor) then
  raise exception 'Actor ownership or balance changed'; end if;
 update public.user_roles set role='tester' where user_id=actor;
 set local role authenticated;
 begin
  perform public.ign_action('demo_grant',null,operation);
  raise exception 'Tester replay accepted';
 exception when sqlstate '42501' then null; end;
 reset role;
 update public.user_roles set role='player' where user_id=actor;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','service_role')::text,true);
 update public.profiles set is_excluded=true where id=actor;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','is_anonymous',false)::text,true);
 set local role authenticated;
 begin
  perform public.ign_action('demo_grant',null,operation);
  raise exception 'Excluded replay accepted';
 exception when sqlstate '42501' then null; end;
 reset role;
 perform set_config('request.jwt.claim.sub','',true);
 perform set_config('request.jwt.claims','{}',true);
 set local role authenticated;
 begin
  perform public.ign_action('demo_grant',null,gen_random_uuid());
  raise exception 'Missing identity accepted';
 exception when sqlstate '28000' then null; end;
 reset role;
 set local role anon;
 begin
  perform public.ign_action('demo_grant',null,gen_random_uuid());
  raise exception 'Anonymous execution accepted';
 exception when sqlstate '42501' then null; end;
 reset role;
 if (select count(*) from public.ign_entries where user_id=actor)<>2 then
  raise exception 'Denied operations changed receipts'; end if;
end $test$;
select 'PASS: actual authenticated role, invoker/private definer grants, actor ownership, retry, tester/exclusion replay, missing identity and anonymous denial' as result;
rollback;
