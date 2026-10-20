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
rollback;
