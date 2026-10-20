begin;
do $test$
declare
  names text[]:=array[
  'admin_action_audit',
  'crash_round_queue',
  'crypto_deposit_assets',
  'crypto_deposit_networks',
  'crypto_treasury_accounts',
  'crypto_treasury_control_policy',
  'crypto_treasury_integration_readiness',
  'crypto_withdrawal_policy',
  'idempotency_keys',
  'ig_bj_history',
  'ig_bj_receipts',
  'ig_bj_seats',
  'ig_bj_table',
  'ig_crash_v2_bets',
  'ig_crash_v2_history',
  'ig_crash_v2_queue',
  'ig_crash_v2_runtime',
  'ig_crash_v2_seats',
  'ig_event_bets',
  'ig_event_results',
  'ig_event_seats',
  'ig_event_tables',
  'ig_fb_sandbox_asset_wallets',
  'ig_fb_sandbox_ops_audit',
  'ig_fb_sandbox_vaults',
  'ig_fb_sandbox_webhook_inbox',
  'ig_final_practice_rounds',
  'ig_mines_practice_rounds',
  'ig_mp_bets',
  'ig_mp_events',
  'ig_mp_players',
  'ig_mp_practice_refills',
  'ig_mp_tables',
  'ig_originals_practice_rounds',
  'ig_payment_rail_plan',
  'ig_poker_lab_bots',
  'ig_poker_lab_tables',
  'ig_poker_preset_events',
  'ig_poker_tournament_award_audit',
  'ig_poker_tournament_awards',
  'ig_poker_tournament_presets',
  'ig_support_messages',
  'ig_support_supervisor_alerts',
  'ig_support_supervisor_decisions',
  'ig_support_supervisor_queue',
  'ig_support_supervisor_reviews',
  'ig_support_tickets',
  'poker_actions_v1',
  'poker_event_audit_v1',
  'poker_event_entries_v1',
  'poker_events_v1',
  'poker_seats_v1',
  'poker_tables_v1',
  'poker_timebank_prices_v1',
  'poker_timebank_receipts_v1',
  'secure_operation_receipts'
  ];
  name text; api_role text; privilege text; first_column text;
  seq record; receipt_key text:='rls-review-'||gen_random_uuid()::text;
  row_count bigint;
begin
 if cardinality(names)<>56 then raise exception 'Expected 56 reviewed tables';end if;
 foreach name in array names loop
  if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname=name and c.relrowsecurity) then
   raise exception 'RLS missing: %',name;end if;
  if not exists(select 1 from pg_policies p where p.schemaname='public' and p.tablename=name
   and p.policyname='backend_only_no_client_access' and p.permissive='RESTRICTIVE'
   and p.cmd='ALL' and p.roles @> array['anon','authenticated']::name[]
   and p.qual='false' and p.with_check='false') then
   raise exception 'Restrictive backend boundary missing: %',name;end if;
  foreach api_role in array array['anon','authenticated'] loop
   foreach privilege in array array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] loop
    if has_table_privilege(api_role,format('public.%I',name),privilege) then
     raise exception 'Unexpected % % privilege: %',api_role,privilege,name;end if;
   end loop;
   foreach privilege in array array['SELECT','INSERT','UPDATE','REFERENCES'] loop
    if has_any_column_privilege(api_role,format('public.%I',name),privilege) then
     raise exception 'Unexpected % column % privilege: %',api_role,privilege,name;end if;
   end loop;
  end loop;
 end loop;
 for seq in
  select ns.nspname,s.relname from pg_class s join pg_namespace ns on ns.oid=s.relnamespace
  join pg_depend d on d.objid=s.oid and d.classid='pg_class'::regclass and d.deptype in('a','i')
  join pg_class t on t.oid=d.refobjid join pg_namespace nt on nt.oid=t.relnamespace
  where s.relkind='S' and nt.nspname='public' and t.relname=any(names)
 loop
  foreach api_role in array array['anon','authenticated'] loop
   if has_sequence_privilege(api_role,format('%I.%I',seq.nspname,seq.relname),'USAGE,SELECT,UPDATE') then
    raise exception 'Unexpected sequence access: % %',api_role,seq.relname;end if;
  end loop;
 end loop;
 -- Exercise the real API database roles, not postgres with role-shaped claims.
 foreach api_role in array array['anon','authenticated'] loop
  execute format('set local role %I',api_role);
  foreach name in array names loop
   begin
    execute format('select 1 from public.%I limit 0',name);
    raise exception 'Direct SELECT accepted: % %',api_role,name;
   exception when insufficient_privilege then null;end;
   begin
    execute format('insert into public.%I default values',name);
    raise exception 'Direct INSERT accepted: % %',api_role,name;
   exception when insufficient_privilege then null;end;
   select a.attname into first_column from pg_attribute a
    where a.attrelid=format('public.%I',name)::regclass and a.attnum>0 and not a.attisdropped and a.attidentity='' and a.attgenerated=''
    order by a.attnum limit 1;
   begin
    execute format('update public.%I set %I=%I where false',name,first_column,first_column);
    raise exception 'Direct UPDATE accepted: % %',api_role,name;
   exception when insufficient_privilege then null;end;
   begin
    execute format('delete from public.%I where false',name);
    raise exception 'Direct DELETE accepted: % %',api_role,name;
   exception when insufficient_privilege then null;end;
  end loop;
  reset role;
 end loop;
 -- Preserve backend reads and the existing service-role grant set.
 set local role service_role;
 foreach name in array names loop
  execute format('select 1 from public.%I limit 0',name);
 end loop;
 insert into public.idempotency_keys(key,operation,response)
 values(receipt_key,'rls_boundary_test','{"verified":true}'::jsonb);
 update public.idempotency_keys set response='{"updated":true}'::jsonb where key=receipt_key;
 get diagnostics row_count=row_count;
 if row_count<>1 then raise exception 'Service-role update blocked';end if;
 delete from public.idempotency_keys where key=receipt_key;
 get diagnostics row_count=row_count;
 if row_count<>1 then raise exception 'Service-role delete blocked';end if;
 reset role;
end $test$;
select 'PASS: all 56 tables deny direct API access, including TRUNCATE grants; five owning sequences protected; service-role reads/writes preserved' as result;

-- ISOLATED_ONLY_POLICY_PROBE: never execute this grant probe on hosted staging.
-- Test future accidental permissive grants against the restrictive boundary.
do $probe$
declare name text; api_role text; n bigint; first_column text;
 names text[]:=array[
 'admin_action_audit',
  'crash_round_queue',
  'crypto_deposit_assets',
  'crypto_deposit_networks',
  'crypto_treasury_accounts',
  'crypto_treasury_control_policy',
  'crypto_treasury_integration_readiness',
  'crypto_withdrawal_policy',
  'idempotency_keys',
  'ig_bj_history',
  'ig_bj_receipts',
  'ig_bj_seats',
  'ig_bj_table',
  'ig_crash_v2_bets',
  'ig_crash_v2_history',
  'ig_crash_v2_queue',
  'ig_crash_v2_runtime',
  'ig_crash_v2_seats',
  'ig_event_bets',
  'ig_event_results',
  'ig_event_seats',
  'ig_event_tables',
  'ig_fb_sandbox_asset_wallets',
  'ig_fb_sandbox_ops_audit',
  'ig_fb_sandbox_vaults',
  'ig_fb_sandbox_webhook_inbox',
  'ig_final_practice_rounds',
  'ig_mines_practice_rounds',
  'ig_mp_bets',
  'ig_mp_events',
  'ig_mp_players',
  'ig_mp_practice_refills',
  'ig_mp_tables',
  'ig_originals_practice_rounds',
  'ig_payment_rail_plan',
  'ig_poker_lab_bots',
  'ig_poker_lab_tables',
  'ig_poker_preset_events',
  'ig_poker_tournament_award_audit',
  'ig_poker_tournament_awards',
  'ig_poker_tournament_presets',
  'ig_support_messages',
  'ig_support_supervisor_alerts',
  'ig_support_supervisor_decisions',
  'ig_support_supervisor_queue',
  'ig_support_supervisor_reviews',
  'ig_support_tickets',
  'poker_actions_v1',
  'poker_event_audit_v1',
  'poker_event_entries_v1',
  'poker_events_v1',
  'poker_seats_v1',
  'poker_tables_v1',
  'poker_timebank_prices_v1',
  'poker_timebank_receipts_v1',
  'secure_operation_receipts'
 ];
begin
 insert into public.idempotency_keys(key,operation) values('policy-probe-'||gen_random_uuid(),'rls_probe_existing_row');
 foreach name in array names loop
  execute format('grant select,insert,update,delete on table public.%I to anon,authenticated',name);
  execute format('create policy test_accidental_permissive on public.%I for all to anon,authenticated using (true) with check (true)',name);
 end loop;
 foreach api_role in array array['anon','authenticated'] loop
  execute format('set local role %I',api_role);
  foreach name in array names loop
   execute format('select count(*) from public.%I',name) into n;
   if n<>0 then raise exception 'Restrictive policy leaked % rows in % to %',n,name,api_role;end if;
   select a.attname into first_column from pg_attribute a
    where a.attrelid=format('public.%I',name)::regclass and a.attnum>0
    and not a.attisdropped and a.attidentity='' and a.attgenerated=''
    order by a.attnum limit 1;
   execute format('update public.%I set %I=%I',name,first_column,first_column);
   get diagnostics n=row_count;
   if n<>0 then raise exception 'Restrictive policy allowed update in %',name;end if;
   execute format('delete from public.%I',name);
   get diagnostics n=row_count;
   if n<>0 then raise exception 'Restrictive policy allowed delete in %',name;end if;
  end loop;
  begin
   insert into public.idempotency_keys(key,operation) values('blocked-'||gen_random_uuid(),'rls_probe');
   raise exception 'Restrictive policy allowed INSERT';
  exception when insufficient_privilege then null;end;
  reset role;
 end loop;
end $probe$;
select 'PASS: restrictive policies survive accidental permissive policies and table grants in isolated rollback probe' as result;
rollback;
