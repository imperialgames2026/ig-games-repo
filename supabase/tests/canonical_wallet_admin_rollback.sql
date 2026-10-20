begin;
do $test$
declare
 a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); staff uuid:=gen_random_uuid(); chief uuid:=gen_random_uuid();
 op uuid:=gen_random_uuid(); first_result jsonb; replay jsonb; result jsonb; total numeric;
begin
 insert into auth.users(id,email) values
 (a,'migration-a-'||a||'@example.invalid'),(b,'migration-b-'||b||'@example.invalid'),
 (staff,'migration-staff-'||staff||'@example.invalid'),(chief,'migration-chief-'||chief||'@example.invalid');
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 -- Deliberately stale legacy profile roles must not govern any authorization.
 update public.profiles set role='superadmin' where id=a;
 update public.user_roles set role='admin' where user_id=staff;
 update public.user_roles set role='superadmin' where user_id=chief;
 update public.wallets set igt_balance=100 where user_id in (a,b);
 first_result:=public.secure_wallet_operation(a,op,'transfer',10,b,null);
 if (first_result->>'balance')::numeric<>90 then raise exception 'Canonical player transfer failed'; end if;
 replay:=public.secure_wallet_operation(a,op,'transfer',10,b,null);
 if replay is distinct from first_result then raise exception 'Replay response changed'; end if;
 select sum(igt_balance) into total from public.wallets where user_id in (a,b);
 if total<>200 then raise exception 'Transfer did not conserve IGT'; end if;
 begin perform public.secure_wallet_operation(a,op,'transfer',11,b,null);
  raise exception 'Changed payload accepted'; exception when unique_violation then null; end;
 update public.user_roles set role='tester' where user_id=a;
 begin perform public.secure_wallet_operation(a,op,'transfer',10,b,null);
  raise exception 'Demoted actor replay accepted'; exception when insufficient_privilege then null; end;
 begin perform internal.admin_mutation(a,b,'exclude','regression fixture',gen_random_uuid(),null,null);
  raise exception 'Stale privileged profile escalated'; exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated','is_anonymous',false)::text,true);
 execute 'set local role authenticated';
 if public.is_admin() or public.is_superadmin() or public.is_admin_or_superadmin() then
  raise exception 'RLS helper trusted stale profile role'; end if;
 if (select count(*) from public.wallets where user_id=b)<>0 then raise exception 'Tester saw another wallet'; end if;
 execute 'reset role';
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 update public.user_roles set role='player' where user_id=a;
 update public.user_roles set role='tester' where user_id=b;
 begin perform public.secure_wallet_operation(a,gen_random_uuid(),'transfer',1,b,null);
  raise exception 'Tester recipient accepted'; exception when insufficient_privilege then null; end;
 update public.user_roles set role='player' where user_id=b;
 update public.profiles set is_excluded=true where id=b;
 begin perform public.secure_wallet_operation(a,gen_random_uuid(),'transfer',1,b,null);
  raise exception 'Excluded recipient accepted'; exception when insufficient_privilege then null; end;
 update public.profiles set is_excluded=false where id=b;
 result:=internal.admin_mutation(staff,b,'exclude','regression fixture',gen_random_uuid(),null,null);
 if not (result->'details'->>'new_excluded')::boolean then raise exception 'Canonical admin could not exclude'; end if;
 begin perform internal.admin_mutation(staff,chief,'exclude','regression fixture',gen_random_uuid(),null,null);
  raise exception 'Admin changed canonical superadmin'; exception when insufficient_privilege then null; end;
 begin perform internal.admin_mutation(staff,b,'wallet_adjustment','regression fixture',gen_random_uuid(),'IGT',1);
  raise exception 'Admin adjusted wallet'; exception when insufficient_privilege then null; end;
 begin perform internal.admin_mutation(chief,b,'wallet_adjustment','regression fixture',gen_random_uuid(),null,1);
  raise exception 'Null currency accepted'; exception when invalid_parameter_value then null; end;
 result:=internal.admin_mutation(chief,b,'wallet_adjustment','regression fixture',gen_random_uuid(),'IGT',1);
 if (result->'details'->>'balance_after')::numeric<>111 then raise exception 'Superadmin adjustment failed'; end if;
 perform set_config('request.jwt.claim.sub',staff::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',staff,'role','authenticated','is_anonymous',false)::text,true);
 execute 'set local role authenticated';
 if not public.is_admin() or public.is_superadmin() then raise exception 'Canonical admin helper failed'; end if;
 if has_function_privilege('authenticated','public.secure_wallet_operation(uuid,uuid,text,numeric,uuid,integer)','EXECUTE')
 or has_function_privilege('authenticated','internal.admin_mutation(uuid,uuid,text,text,uuid,text,numeric)','EXECUTE') then
  raise exception 'Server mutation exposed to authenticated'; end if;
 execute 'reset role';
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 update public.profiles set is_excluded=true where id=staff;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',staff,'role','authenticated')::text,true);
 if public.is_admin() then raise exception 'Excluded admin retained RLS privileges'; end if;
 if (select count(*) from public.secure_operation_receipts where actor_id=a)<>1 then
  raise exception 'Denied/replayed calls created receipts'; end if;
end $test$;
select 'PASS: canonical wallet/admin roles, demotion, RLS isolation, exclusion, IGT conservation, replay and protected targets' as result;
rollback;
