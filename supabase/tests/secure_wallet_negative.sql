-- Run only in a disposable test database after applying the secure wallet migration.
-- No wallet or game records are created by these negative tests.
do $test$
declare
  actor uuid := '11111111-1111-4111-8111-111111111111';
  op uuid := '22222222-2222-4222-8222-222222222222';
  blocked boolean;
begin
  if has_function_privilege('authenticated','public.secure_wallet_operation(uuid,uuid,text,numeric,uuid,integer)','EXECUTE')
     or has_function_privilege('anon','public.secure_wallet_operation(uuid,uuid,text,numeric,uuid,integer)','EXECUTE')
     or not has_function_privilege('service_role','public.secure_wallet_operation(uuid,uuid,text,numeric,uuid,integer)','EXECUTE') then
    raise exception 'RPC grants unsafe';
  end if;
  perform set_config('request.jwt.claim.role','service_role',true);
  perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  blocked := false;
  begin perform public.secure_wallet_operation(actor,op,'dice',1,null,null);
  exception when sqlstate '22023' then blocked := true; end;
  if not blocked then raise exception 'null dice guess accepted'; end if;
  blocked := false;
  begin perform public.secure_wallet_operation(actor,op,'dice',-1,null,3);
  exception when sqlstate '22023' then blocked := true; end;
  if not blocked then raise exception 'negative wager accepted'; end if;
  blocked := false;
  begin perform public.secure_wallet_operation(actor,op,'dice',1,null,3);
  exception when sqlstate '42501' then blocked := true; end;
  if not blocked then raise exception 'nonexistent actor accepted'; end if;
  raise notice 'PASS: grants, null guess, negative stake, nonexistent actor';
end $test$;
