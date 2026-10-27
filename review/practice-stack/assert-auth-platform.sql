-- Read-only validation AFTER real GoTrue migration startup, before app schema.
-- This file intentionally creates/replaces no roles, tables, functions or data.
do $$
begin
 if to_regclass('auth.users') is null or to_regclass('auth.identities') is null or to_regclass('auth.sessions') is null then
  raise exception 'Real GoTrue schema prerequisite missing';
 end if;
 if to_regprocedure('auth.uid()') is null or to_regprocedure('auth.jwt()') is null or to_regprocedure('auth.role()') is null then
  raise exception 'Reviewed platform claim helpers prerequisite missing';
 end if;
 if not exists(select 1 from pg_roles where rolname='authenticator' and rolcanlogin and not rolsuper) then
  raise exception 'PostgREST authenticator prerequisite missing';
 end if;
 if not exists(select 1 from pg_roles where rolname='authenticated' and not rolcanlogin and not rolsuper) then
  raise exception 'Authenticated role prerequisite missing';
 end if;
end $$;
-- Presence alone is NOT proof helper semantics are canonical: the future
-- runner must pin reviewed definitions and exercise signed-JWT requests.
