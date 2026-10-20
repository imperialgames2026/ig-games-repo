-- Dedicated announcement content replaces legacy app_records writes.
create table public.ig_announcements (
 id uuid primary key default gen_random_uuid(),
 title text not null check (length(btrim(title)) between 1 and 160),
 message text not null check (length(btrim(message)) between 1 and 3000),
 type text not null check (type in ('special','challenge','tournament')),
 link_url text check (link_url is null or (length(link_url)<=2048
   and link_url !~ '[[:space:][:cntrl:]]' and position(chr(92) in link_url)=0
   and (link_url ~ '^https://[^/]+' or link_url ~ '^/($|[A-Za-z0-9])'))),
 is_active boolean not null default true,
 priority integer not null default 0 check (priority between -1000 and 1000),
 expires_at timestamptz,
 created_by uuid default auth.uid() references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 revision integer not null default 1 check (revision>0)
);
alter table public.ig_announcements enable row level security;
revoke all on public.ig_announcements from public,anon,authenticated;
grant select on public.ig_announcements to anon,authenticated;
grant insert(id,title,message,type,link_url,is_active,priority,expires_at),
 update(title,message,type,link_url,is_active,priority,expires_at)
 on public.ig_announcements to authenticated;
grant all on public.ig_announcements to service_role;
create policy published_announcements on public.ig_announcements for select to anon,authenticated
 using (is_active and (expires_at is null or expires_at>now()));
create policy staff_announcements_read on public.ig_announcements for select to authenticated
 using ((select public.is_admin()));
create policy staff_announcements_create on public.ig_announcements for insert to authenticated
 with check ((select public.is_admin()) and created_by=(select auth.uid()));
create policy staff_announcements_edit on public.ig_announcements for update to authenticated
 using ((select public.is_admin())) with check ((select public.is_admin()));
create function internal.announcement_revision() returns trigger language plpgsql
 security invoker set search_path='' as $$
begin new.revision:=old.revision+1; return new; end $$;
revoke all on function internal.announcement_revision() from public,anon,authenticated;
create trigger announcement_revision before update on public.ig_announcements
 for each row execute function internal.announcement_revision();
create index ig_announcements_published_order on public.ig_announcements(priority desc,created_at desc) where is_active;
comment on table public.ig_announcements is 'Dedicated staff-managed content. Public reads contain only active/unexpired announcements. Admin authorization uses canonical roles/exclusion. Archive instead of deleting.';
notify pgrst,'reload schema';
