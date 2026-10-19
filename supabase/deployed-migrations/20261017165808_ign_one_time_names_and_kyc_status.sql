-- Staging-only: public nickname one-time lock and minimal KYC status records.
-- Never store ID images, selfies, document IDs, national IDs, or biometric templates here.
alter table public.profiles add column if not exists display_name text;

create or replace function public.guard_profile_name_and_tester_updates()
returns trigger
language plpgsql
security invoker
set search_path to ''
as $$
declare
  active_role text;
  clean_name text;
begin
  -- Backend service-role operations may correct names for moderation/support.
  if auth.role() <> 'authenticated' or auth.uid() is distinct from old.id then
    return new;
  end if;

  select r.role into active_role
    from public.user_roles r where r.user_id = auth.uid();

  if new.display_name is distinct from old.display_name then
    if nullif(pg_catalog.btrim(old.display_name), '') is not null then
      raise exception 'Display name can only be set once' using errcode = '42501';
    end if;
    clean_name := pg_catalog.btrim(new.display_name);
    if clean_name is null or pg_catalog.char_length(clean_name) not between 2 and 40
       or clean_name ~ '[[:cntrl:]<>]' or clean_name ~* '^(admin|administrator|moderator|superadmin|support|imperial games)$' then
      raise exception 'Invalid display name' using errcode = '22023';
    end if;
    new.display_name := clean_name;
  end if;

  if active_role = 'tester' then
    -- Only the one-time display_name field may change for read-only testers.
    -- Timestamp is maintained by the existing updated_at trigger.
    if new.email is distinct from old.email
       or new.full_name is distinct from old.full_name
       or new.profile_picture is distinct from old.profile_picture
       or new.role is distinct from old.role
       or new.is_excluded is distinct from old.is_excluded
       or new.kyc_status is distinct from old.kyc_status
       or new.legacy_data is distinct from old.legacy_data
       or new.created_at is distinct from old.created_at then
      raise exception 'Tester profiles are read-only except initial display name' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_name_and_tester_updates on public.profiles;
create trigger guard_profile_name_and_tester_updates
before update on public.profiles
for each row execute function public.guard_profile_name_and_tester_updates();

create table if not exists public.kyc_verifications (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null default 'not_configured',
  external_session_id text unique,
  status text not null default 'not_started'
     check (status in ('not_started','pending','needs_review','verified','rejected')),
  document_verified boolean not null default false,
  selfie_verified boolean not null default false,
  provider_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint verified_requires_id_and_selfie check
    (status <> 'verified' or (document_verified and selfie_verified))
);
alter table public.kyc_verifications enable row level security;
revoke all on public.kyc_verifications from public, anon, authenticated;
grant select on public.kyc_verifications to authenticated;
drop policy if exists "kyc own read" on public.kyc_verifications;
create policy "kyc own read" on public.kyc_verifications
  for select to authenticated using (user_id = (select auth.uid()));
-- Only the trusted, independently verified provider webhook/backend can modify KYC status.
-- Phone verification is read from Supabase Auth phone_confirmed_at separately.
comment on table public.kyc_verifications is
  'Provider-only verified KYC status. No raw identity document/biometric images or phone OTPs; users have own-row SELECT only.';


