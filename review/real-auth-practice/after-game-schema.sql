-- REVIEW ONLY: fresh isolated lab, AFTER app-schema + selected39 game SQL.
-- Public-schema service grants model the existing hosted engine caller, not
-- user access. Private ig_practice_audit stays unexposed and inaccessible.
grant usage on schema public,auth,extensions to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
-- End users get no native game/ledger mutation grants from this file.
update public.poker_timebank_prices_v1 set payment_enabled=false,practice_preview_enabled=true where singleton=true;
do $$begin
 if to_regclass('public.wallets') is not null or to_regclass('public.transactions') is not null
 or to_regclass('public.ign_accounts') is not null then
  raise exception 'FINANCIAL_SCHEMA_NOT_PART_OF_PRACTICE_LAB';
 end if;
end $$;
