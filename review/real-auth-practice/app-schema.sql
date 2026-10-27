-- REVIEW ONLY: isolated synthetic lab, AFTER pinned real GoTrue migrations.
-- Never use tests/database/bootstrap.sql or native runner bootstrap here.
-- Execute only as part of separately approved fresh lab setup, one transaction.
do $$begin
 if to_regclass('auth.users') is null or to_regclass('auth.identities') is null
 or to_regclass('auth.sessions') is null or to_regprocedure('auth.uid()') is null
 or to_regprocedure('auth.jwt()') is null then
  raise exception 'REAL_AUTH_AND_REVIEWED_CLAIM_HELPERS_REQUIRED';
 end if;
 if not exists(select 1 from pg_roles where rolname='service_role' and rolbypassrls and not rolsuper)
 or not exists(select 1 from pg_roles where rolname='authenticated')
 or not exists(select 1 from pg_roles where rolname='anon') then
  raise exception 'REVIEWED_PLATFORM_ROLES_REQUIRED';
 end if;
 if to_regclass('public.profiles') is not null or to_regclass('public.user_roles') is not null then
  raise exception 'FRESH_APP_SCHEMA_REQUIRED_NO_OVERWRITE';
 end if;
end $$;
create schema ig_practice_fixture;
revoke all on schema ig_practice_fixture from public,anon,authenticated,service_role;
create table public.profiles(
 id uuid primary key references auth.users(id) on delete cascade,
 email text,full_name text not null default 'Synthetic Player',
 kyc_status text not null default 'unverified',
 is_excluded boolean not null default false,
 display_name text not null default 'Synthetic Player',profile_picture text,
 created_at timestamptz not null default clock_timestamp()
);
create table public.user_roles(
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null default 'player' check(role in ('player','tester','admin','superadmin'))
);
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
revoke all on public.profiles,public.user_roles from public,anon,authenticated;
grant select on public.profiles,public.user_roles to authenticated;
grant select,insert,update,delete on public.profiles,public.user_roles to service_role;
create policy own_profile_read on public.profiles for select to authenticated using(id=(select auth.uid()));
create policy own_role_read on public.user_roles for select to authenticated using(user_id=(select auth.uid()));
-- Trigger fixed canonical role, no user_metadata authorization or financial grant.
-- Definer is necessary for GoTrue's DB role to populate private canonical rows;
-- function lives in unexposed schema, empty path and no public execute access.
create function ig_practice_fixture.on_real_auth_signup() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,email) values(new.id,new.email);
 insert into public.user_roles(user_id,role) values(new.id,'player');
 return new;
end $$;
revoke all on function ig_practice_fixture.on_real_auth_signup() from public,anon,authenticated,service_role;
create trigger practice_fixture_signup after insert on auth.users
 for each row execute function ig_practice_fixture.on_real_auth_signup();
-- No backfill: users must be created through real local GoTrue AFTER installation.
