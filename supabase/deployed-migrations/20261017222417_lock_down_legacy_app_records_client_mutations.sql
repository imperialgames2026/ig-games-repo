-- Legacy Base44 generic app_records must not accept arbitrary JSON writes
-- while original casino functions are migrated to dedicated server-owned tables.
-- There are no production financial records in this staging table. Existing
-- read grants remain as-is for audit/reference; no deletion is performed.
revoke insert, update, delete on public.app_records from public, anon, authenticated;

-- Remove permissive write policies as a second line of defense even if a
-- future migration inadvertently re-grants table-level privileges.
drop policy if exists "app records create own" on public.app_records;
drop policy if exists "app records update own" on public.app_records;
drop policy if exists "app records delete own" on public.app_records;

comment on table public.app_records is
'Legacy reference only during Base44 migration. Authenticated and anonymous direct writes are disabled. Financial/game/staking/admin changes require reviewed dedicated Edge functions and transactions.';


