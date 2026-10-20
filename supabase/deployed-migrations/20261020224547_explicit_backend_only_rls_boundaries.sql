-- Reviewed backend-only tables. No direct client reads/writes are required.
-- The restrictive policy remains a deny barrier if a permissive policy is later
-- added accidentally; table ACLs also deny TRUNCATE, which is outside RLS.
do $migration$
declare
  table_name text;
  sequence_record record;
begin
  foreach table_name in array array[
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
  ] loop
    -- Fail closed on schema drift rather than replacing a new access policy.
    if not exists (
      select 1 from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=table_name and c.relkind in ('r','p')
      and c.relrowsecurity
      and not exists (select 1 from pg_catalog.pg_policy p where p.polrelid=c.oid)
      and not exists (select 1 from pg_catalog.pg_attribute a
        where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped and a.attacl is not null)
    ) then
      raise exception 'Unexpected RLS/policy/column-grant state for public.%',table_name;
    end if;
    execute format('revoke all privileges on table public.%I from public, anon, authenticated',table_name);
    execute format('create policy backend_only_no_client_access on public.%I as restrictive for all to anon, authenticated using (false) with check (false)',table_name);
    execute format('comment on policy backend_only_no_client_access on public.%I is %L',table_name,
      'Backend-only: clients must use the checked Edge Function or RPC. No direct API access; preserve RLS and service-role/owner access. Reviewed 2026-10-20.');
    -- Owning sequences are separate objects: RLS/table revokes do not protect them.
    for sequence_record in
      select ns.nspname,s.relname from pg_catalog.pg_class s
      join pg_catalog.pg_namespace ns on ns.oid=s.relnamespace
      join pg_catalog.pg_depend d on d.objid=s.oid and d.classid='pg_class'::regclass and d.deptype in ('a','i')
      join pg_catalog.pg_class t on t.oid=d.refobjid
      join pg_catalog.pg_namespace nt on nt.oid=t.relnamespace
      where s.relkind='S' and nt.nspname='public' and t.relname=table_name
    loop
      execute format('revoke all privileges on sequence %I.%I from public, anon, authenticated',sequence_record.nspname,sequence_record.relname);
    end loop;
  end loop;
end $migration$;
notify pgrst, 'reload schema';
