-- Run against staging only. Transaction rollback leaves no fixtures or balance changes.
begin;
do $test$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); p uuid:=gen_random_uuid(); t uuid:=gen_random_uuid(); k uuid; result jsonb; n numeric; blocked boolean;
begin
 insert into auth.users(id,email,role,aud) values
 (a,'sql-super-'||a||'@example.invalid','authenticated','authenticated'),
 (b,'sql-admin-'||b||'@example.invalid','authenticated','authenticated'),
 (p,'sql-player-'||p||'@example.invalid','authenticated','authenticated'),
 (t,'sql-target-'||t||'@example.invalid','authenticated','authenticated');
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 update public.profiles set role='superadmin' where id=a;
 update public.user_roles set role='superadmin' where user_id=a;
 update public.user_roles set role='admin' where user_id=b;
 update public.profiles set role='admin' where id=b;
 update public.wallets set igt_balance=5 where user_id=t;
 blocked:=false;
 begin perform internal.admin_mutation(p,t,'wallet_adjustment','Security test player role',gen_random_uuid(),'IGT',1);
 exception when sqlstate '42501' then blocked:=true;end;
 if not blocked then raise exception 'player escalation accepted';end if;
 blocked:=false;
 begin perform internal.admin_mutation(b,t,'wallet_adjustment','Security test admin role',gen_random_uuid(),'IGT',1);
 exception when sqlstate '42501' then blocked:=true;end;
 if not blocked then raise exception 'admin balance adjustment accepted';end if;
 blocked:=false;
 begin perform internal.admin_mutation(b,a,'exclude','Security test protected target',gen_random_uuid());
 exception when sqlstate '42501' then blocked:=true;end;
 if not blocked then raise exception 'protected target accepted';end if;
 k:=gen_random_uuid();blocked:=false;
 begin perform internal.admin_mutation(a,t,'wallet_adjustment','Security test insufficient balance',k,'IGT',-10);
 exception when sqlstate '22023' then blocked:=true;end;
 if not blocked then raise exception 'overdraft accepted';end if;
 select igt_balance into n from public.wallets where user_id=t;
 if n<>5 or exists(select 1 from public.admin_action_audit where request_id=k) then raise exception 'overdraft mutated data';end if;
 k:=gen_random_uuid();
 result:=internal.admin_mutation(a,t,'wallet_adjustment','Security test idempotent credit',k,'IGT',1);
 if result->>'replayed'<>'false' then raise exception 'initial credit incorrect';end if;
 result:=internal.admin_mutation(a,t,'wallet_adjustment','Security test idempotent credit',k,'IGT',1);
 if result->>'replayed'<>'true' then raise exception 'replay incorrect';end if;
 select igt_balance into n from public.wallets where user_id=t;
 if n<>6 then raise exception 'duplicate credit';end if;
 blocked:=false;
 begin perform internal.admin_mutation(a,t,'wallet_adjustment','Security test idempotent credit',k,'IGT',2);
 exception when sqlstate '23505' then blocked:=true;end;
 if not blocked then raise exception 'idempotency conflict accepted';end if;
 if has_function_privilege('authenticated','public.admin_mutation_server(uuid,uuid,text,text,uuid,text,numeric)','execute') then raise exception 'RPC privilege leak';end if;
 if has_column_privilege('authenticated','public.wallets','igt_balance','update') then raise exception 'wallet write privilege leak';end if;
 raise notice 'PASS all transactional admin security assertions';
end $test$;
rollback;
