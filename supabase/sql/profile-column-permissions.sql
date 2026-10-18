-- Applied to Imperial Games Supabase project on 2026-10-17.
-- Prevent browser clients from editing authorization or KYC fields through profiles RLS.
-- Administrators must use separately authorized server-side workflows for privileged changes.
BEGIN;
REVOKE UPDATE ON public.profiles FROM anon, authenticated;
GRANT UPDATE (full_name, profile_picture) ON public.profiles TO authenticated;
COMMIT;
-- Verification:
-- select has_column_privilege('authenticated','public.profiles','role','UPDATE'); -- false
-- select has_column_privilege('authenticated','public.profiles','full_name','UPDATE'); -- true
