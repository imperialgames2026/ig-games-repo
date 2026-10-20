begin;
do $test$
declare
 staff uuid:=gen_random_uuid(); player uuid:=gen_random_uuid(); tester uuid:=gen_random_uuid(); actor uuid;
 published uuid:=gen_random_uuid(); draft uuid:=gen_random_uuid(); expired uuid:=gen_random_uuid(); n integer;
begin
 insert into auth.users(id,email) values(staff,'announce-admin-'||staff||'@example.invalid'),
 (player,'announce-player-'||player||'@example.invalid'),(tester,'announce-tester-'||tester||'@example.invalid');
 update public.user_roles set role='admin' where user_id=staff;
 update public.user_roles set role='tester' where user_id=tester;
 perform set_config('request.jwt.claim.sub',staff::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',staff,'role','authenticated','is_anonymous',false)::text,true);
 set local role authenticated;
 insert into public.ig_announcements(id,title,message,type,is_active,expires_at) values
 (published,'Published fixture','Published body','special',true,null),
 (draft,'Draft fixture','Draft body','challenge',false,null),
 (expired,'Expired fixture','Expired body','tournament',true,now()-interval '1 day');
 select count(id) into n from public.ig_announcements where id in(published,draft,expired);
 if n<>3 then raise exception 'Admin cannot read drafts';end if;
 update public.ig_announcements set title='Edited fixture' where id=published and revision=1;
 if (select revision from public.ig_announcements where id=published)<>2 then raise exception 'Revision did not advance';end if;
 update public.ig_announcements set title='Stale overwrite' where id=published and revision=1;
 get diagnostics n=row_count;
 if n<>0 then raise exception 'Stale revision overwritten';end if;
 begin
  update public.ig_announcements set created_by=player where id=published;
  raise exception 'Author spoof accepted';
 exception when insufficient_privilege then null;end;
 begin
  insert into public.ig_announcements(title,message,type,link_url) values('Bad link','Bad body','special','javascript:alert(1)');
  raise exception 'Script URL accepted';
 exception when check_violation then null;end;
 begin
  delete from public.ig_announcements where id=published;
  raise exception 'Direct delete accepted';
 exception when insufficient_privilege then null;end;
 reset role;
 if (select created_by from public.ig_announcements where id=published)<>staff then raise exception 'Author default incorrect';end if;
 perform set_config('request.jwt.claims','{}',true);
 perform set_config('request.jwt.claim.sub','',true);
 set local role anon;
 select count(id) into n from public.ig_announcements where id in(published,draft,expired);
 if n<>1 then raise exception 'Public read exposed draft or expired content';end if;
 begin
  perform created_by from public.ig_announcements where id=published;
  raise exception 'Author identity publicly exposed';
 exception when insufficient_privilege then null;end;
 reset role;
 foreach actor in array array[player,tester] loop
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','is_anonymous',false,'user_metadata',jsonb_build_object('role','superadmin'))::text,true);
  set local role authenticated;
  begin
   insert into public.ig_announcements(title,message,type) values('Forbidden','Forbidden body','special');
   raise exception 'Nonstaff insert accepted';
  exception when insufficient_privilege then null;end;
  update public.ig_announcements set title='Forbidden' where id=published;
  get diagnostics n=row_count;
  if n<>0 then raise exception 'Nonstaff update accepted';end if;
  reset role;
 end loop;
 -- Stale admin JWT must not survive canonical role removal or exclusion.
 perform set_config('request.jwt.claim.sub',staff::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',staff,'role','service_role')::text,true);
 update public.profiles set is_excluded=true where id=staff;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',staff,'role','authenticated','is_anonymous',false)::text,true);
 set local role authenticated;
 update public.ig_announcements set title='Excluded' where id=published;
 get diagnostics n=row_count;
 if n<>0 then raise exception 'Excluded staff write accepted';end if;
 reset role;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',staff,'role','service_role')::text,true);
 update public.profiles set is_excluded=false where id=staff;
 update public.user_roles set role='player' where user_id=staff;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',staff,'role','authenticated','is_anonymous',false)::text,true);
 set local role authenticated;
 update public.ig_announcements set title='Demoted' where id=published;
 get diagnostics n=row_count;
 if n<>0 then raise exception 'Demoted staff write accepted';end if;
 reset role;
end $test$;
select 'PASS: announcement CRUD grants, admin/revision checks, public draft/expiry/author privacy, bad links, metadata spoof, tester/excluded/demoted denial' as result;
rollback;
