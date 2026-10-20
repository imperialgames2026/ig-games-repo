begin;
create table public.app_records(id integer primary key, owner_user_id uuid, data jsonb);
alter table public.app_records enable row level security;
grant select on public.app_records to anon, authenticated;
create function public.is_admin() returns boolean language sql stable as $$ select coalesce(current_setting('test.canonical_admin',true),'false') = 'true' $$;
create function public.is_admin_or_superadmin() returns boolean language sql stable as $$ select public.is_admin() $$;
-- Existing deployed permissive policies, including the unintended OR alternative.
create policy "app records read own" on public.app_records for select using (owner_user_id=auth.uid() or owner_user_id is null or public.is_admin());
create policy app_records_owner_read on public.app_records for select using (owner_user_id=auth.uid() or public.is_admin_or_superadmin());
insert into public.app_records values
 (1,'00000000-0000-4000-8000-000000000001','{}'),
 (2,'00000000-0000-4000-8000-000000000002','{}'), (3,null,'{}');
set local role anon;
do $$ begin if (select count(*) from public.app_records) <> 1 then raise exception 'failed to reproduce ownerless exposure'; end if; end $$;
reset role;
