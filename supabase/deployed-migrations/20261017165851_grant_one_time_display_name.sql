-- Existing Imperial Games schema grants authenticated UPDATE only on named profile columns.
-- Explicitly permit one-time display_name, enforced by guard_profile_name_and_tester_updates.
grant update (display_name) on public.profiles to authenticated;
revoke update (display_name) on public.profiles from anon;


