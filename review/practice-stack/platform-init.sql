-- Future disposable-cluster initialization ONLY, before real GoTrue starts.
-- The runner must prove a fresh exclusively-owned database before applying.
-- No auth.users/identities/sessions or claim helpers are created here.
begin;
do $$begin
 if exists(select 1 from pg_roles where rolname in ('anon','authenticated','service_role','authenticator','supabase_auth_admin'))
 or exists(select 1 from pg_namespace where nspname in ('auth','extensions')) then
  raise exception 'Refuse existing platform namespace or role';
 end if;
end $$;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role authenticator login noinherit;
create role supabase_auth_admin login noinherit;
grant anon,authenticated,service_role to authenticator;
create schema auth authorization supabase_auth_admin;
create schema extensions;
create extension pgcrypto with schema extensions;
grant usage on schema public,extensions to supabase_auth_admin;
alter role supabase_auth_admin set search_path=auth,extensions,public;
grant usage on schema auth to anon,authenticated,service_role;
commit;
