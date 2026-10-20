-- Announcement author identity is not public banner content.
revoke select on public.ig_announcements from anon,authenticated;
grant select(id,title,message,type,link_url,is_active,priority,expires_at,created_at,revision)
 on public.ig_announcements to anon,authenticated;
notify pgrst,'reload schema';
