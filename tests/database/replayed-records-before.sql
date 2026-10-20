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
 if (select count(*) from public.app_records where entity='__local_rls__') <> 2 then
 raise exception 'Could not reproduce deployed ownerless visibility'; end if;
end $$;
reset role;
