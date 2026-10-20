begin;
select set_config('test.owner_a',gen_random_uuid()::text,true),
       set_config('test.owner_b',gen_random_uuid()::text,true),
       set_config('test.admin',gen_random_uuid()::text,true);
insert into auth.users(id,email,raw_user_meta_data)
values(current_setting('test.owner_a')::uuid,'local-a@example.invalid','{"role":"superadmin"}'),
      (current_setting('test.owner_b')::uuid,'local-b@example.invalid','{}'),
      (current_setting('test.admin')::uuid,'local-admin@example.invalid','{}');
do $$ begin
 if (select role from public.user_roles where user_id=current_setting('test.owner_a')::uuid) is distinct from 'player' then
 raise exception 'Signup metadata escalated canonical role'; end if;
end $$;
update public.user_roles set role='superadmin' where user_id=current_setting('test.admin')::uuid;
insert into public.app_records(entity,owner_user_id,data) values
 ('__local_rls__',current_setting('test.owner_a')::uuid,'{}'),
 ('__local_rls__',current_setting('test.owner_b')::uuid,'{}'),
 ('__local_rls__',null,'{}');
select set_config('request.jwt.claim.sub',current_setting('test.owner_a'),true),
 set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.owner_a'),'role','authenticated','is_anonymous',false)::text,true);
set local role authenticated;
do $$ begin
 if (select count(*) from public.app_records where entity='__local_rls__') <> 1 then
 raise exception 'Recorded migration did not enforce ownerless isolation'; end if;
end $$;
reset role;
set local role authenticated;
do $$ begin
 if (select count(*) from public.app_records where entity='__local_rls__') <> 1
 or exists(select from public.app_records where entity='__local_rls__' and owner_user_id is distinct from auth.uid()) then
 raise exception 'Owner isolation failed'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('test.owner_b'),true),
 set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.owner_b'),'role','authenticated','is_anonymous',false)::text,true);
set local role authenticated;
do $$ begin
 if (select count(*) from public.app_records where entity='__local_rls__') <> 1
 or exists(select from public.app_records where entity='__local_rls__' and owner_user_id is distinct from auth.uid()) then
 raise exception 'Second owner isolation failed'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('test.admin'),true),
 set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.admin'),'role','authenticated','is_anonymous',false)::text,true);
set local role authenticated;
do $$ begin
 if (select count(*) from public.app_records where entity='__local_rls__') <> 3 then
 raise exception 'Canonical administrator reads changed'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
do $$ begin
 begin
  if exists(select from public.app_records where entity='__local_rls__') then raise exception 'Anonymous disclosure'; end if;
 exception when insufficient_privilege then null; -- Current helpers explicitly deny anon execution.
 end;
end $$;
reset role;
do $$ begin
 if (select count(*) from public.ig_practice_game_catalog where is_active and practice_only and not real_wagers_enabled)<>15 then raise exception 'Reviewed catalog incomplete';end if;
 begin
 insert into public.ig_practice_game_catalog(slug,name,description,category,backend_slug,route,is_active)
 values('invalid-pair','Invalid Pair','Should never become a published game.','instant','ig-crash-v2','/PlayMines',true);
 raise exception 'Mismatched backend and route accepted';exception when check_violation then null;end;
 if has_table_privilege('authenticated','public.ig_practice_game_catalog','insert') or has_table_privilege('authenticated','public.ig_practice_game_catalog','update') then raise exception 'Browser catalog writes enabled';end if;
end $$;
rollback;
