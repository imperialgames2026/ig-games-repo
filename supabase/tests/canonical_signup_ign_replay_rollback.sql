begin;
do $test$
declare actor uuid:=gen_random_uuid(); operation uuid:=gen_random_uuid(); first_result jsonb; replay jsonb; n integer;
begin
 insert into auth.users(id,email,raw_user_meta_data)
 values(actor,'migration-test-'||actor::text||'@example.invalid','{"role":"superadmin"}'::jsonb);
 if (select role from public.user_roles where user_id=actor) is distinct from 'player' then
  raise exception 'Signup role was missing or trusted editable metadata'; end if;
 if not exists(select 1 from public.profiles where id=actor) or not exists(select 1 from public.wallets where user_id=actor) then
  raise exception 'Signup did not initialize account'; end if;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','is_anonymous',false)::text,true);
 first_result:=public.ign_action('demo_grant',null,operation,null);
 perform public.ign_action('stake',10,gen_random_uuid(),null);
 replay:=public.ign_action('demo_grant',null,operation,null);
 if replay is distinct from first_result then raise exception 'Replay response changed'; end if;
 if (select available from public.ign_accounts where user_id=actor)<>990 then raise exception 'Replay changed balance'; end if;
 begin
  perform public.ign_action('stake',10,operation,null);
  raise exception 'Changed-payload replay accepted';
 exception when sqlstate '22023' then null; end;
 update public.user_roles set role='tester' where user_id=actor;
 begin
  perform public.ign_action('unstake',1,gen_random_uuid(),null);
  raise exception 'Tester mutation accepted';
 exception when sqlstate '42501' then null; end;
 update public.user_roles set role='player' where user_id=actor;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','service_role')::text,true);
 update public.profiles set is_excluded=true where id=actor;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','is_anonymous',false)::text,true);
 begin
  perform public.ign_action('unstake',1,gen_random_uuid(),null);
  raise exception 'Excluded mutation accepted';
 exception when sqlstate '42501' then null; end;
 select count(*) into n from public.ign_entries where user_id=actor;
 if n<>2 then raise exception 'Unexpected receipts after denied operations'; end if;
end $test$;
select 'PASS: signup role, metadata escalation denial, exact replay, changed-payload rejection, tester and exclusion guards' as result;
rollback;
