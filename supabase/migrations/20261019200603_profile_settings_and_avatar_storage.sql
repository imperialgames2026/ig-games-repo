-- Public avatar images only. Never use this bucket for identity documents.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('profile-avatars','profile-avatars',true,5242880,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create or replace function internal.can_edit_profile()
returns boolean language sql stable security definer set search_path = ''
as $$
 select exists(select 1 from public.profiles pr join public.user_roles ur on ur.user_id=pr.id
 where pr.id=(select auth.uid()) and pr.is_excluded=false and ur.role in ('player','admin','superadmin')
 and coalesce((select auth.jwt()->>'is_anonymous'),'false')='false')
$$;
revoke all on function internal.can_edit_profile() from public,anon;
grant execute on function internal.can_edit_profile() to authenticated,service_role;

create policy "avatars own insert" on storage.objects for insert to authenticated
with check (bucket_id='profile-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text
 and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpg|webp|gif)$' and (select internal.can_edit_profile()));
create policy "avatars own read" on storage.objects for select to authenticated
using (bucket_id='profile-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "avatars own delete" on storage.objects for delete to authenticated
using (bucket_id='profile-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text
 and (select internal.can_edit_profile()));
-- No UPDATE/upsert policy: each avatar uses a new immutable object path.

create unique index profiles_display_name_unique_ci
on public.profiles(lower(btrim(display_name))) where nullif(btrim(display_name),'') is not null;

create or replace function public.guard_profile_settings()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
 if (select auth.jwt()->>'role') is distinct from 'authenticated' then return new; end if;
 if new.full_name is distinct from old.full_name or new.profile_picture is distinct from old.profile_picture then
  if auth.uid() is distinct from old.id or not internal.can_edit_profile() then
   raise exception 'Profile changes require an eligible owner' using errcode='42501'; end if;
 end if;
 if new.display_name is distinct from old.display_name then
  if auth.uid() is distinct from old.id or old.is_excluded or coalesce((select auth.jwt()->>'is_anonymous'),'false')<>'false'
  or not exists(select 1 from public.user_roles where user_id=auth.uid() and role in ('player','tester','admin','superadmin')) then
   raise exception 'Display name unavailable' using errcode='42501'; end if;
 end if;
 if new.full_name is distinct from old.full_name then
  new.full_name:=btrim(new.full_name);
  if new.full_name is null or length(new.full_name) not between 2 and 100 or new.full_name ~ '[[:cntrl:]<>]' then
   raise exception 'Name must be 2 to 100 characters' using errcode='22023'; end if;
 end if;
 if new.profile_picture is distinct from old.profile_picture and new.profile_picture is not null then
  if new.profile_picture !~ ('^https://qonqemhljgxlwpghkxhn\.supabase\.co/storage/v1/object/public/profile-avatars/'||old.id::text||'/[0-9a-f-]{36}\.(png|jpg|webp|gif)$') then
   raise exception 'Avatar must be an owned profile image' using errcode='22023'; end if;
 end if;
 return new;
end $$;
create trigger guard_profile_settings before update on public.profiles
for each row execute function public.guard_profile_settings();
