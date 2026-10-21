begin;
do $test$
declare owner_id uuid:=gen_random_uuid(); admin_id uuid:=gen_random_uuid(); player_id uuid:=gen_random_uuid(); tester_id uuid:=gen_random_uuid(); actor uuid;
 original jsonb; edited jsonb; bad jsonb; rev bigint; n integer; audits integer;
begin
 insert into auth.users(id,email) values(owner_id,'vip-owner-'||owner_id||'@example.invalid'),(admin_id,'vip-admin-'||admin_id||'@example.invalid'),(player_id,'vip-player-'||player_id||'@example.invalid'),(tester_id,'vip-tester-'||tester_id||'@example.invalid');
 update public.user_roles set role='superadmin' where user_id=owner_id;
 update public.user_roles set role='admin' where user_id=admin_id;
 update public.user_roles set role='tester' where user_id=tester_id;
 select levels,revision into original,rev from public.ig_vip_catalog where id=1;
 if jsonb_array_length(original)<>34 or (original->0->>'xp_required')::numeric<>0 then raise exception 'VIP catalog incomplete';end if;
 select count(*) into audits from internal.vip_catalog_history;
 edited:=jsonb_set(original,'{1,xp_required}',to_jsonb((original->1->>'xp_required')::bigint+1));
 perform set_config('request.jwt.claims','{}',true);perform set_config('request.jwt.claim.sub','',true);
 set local role anon;
 if (select jsonb_array_length(levels) from public.ig_vip_catalog where id=1)<>34 then raise exception 'Public schedule unreadable';end if;
 begin perform updated_by from public.ig_vip_catalog;raise exception 'Actor identity leaked';exception when insufficient_privilege then null;end;
 begin update public.ig_vip_catalog set levels=edited;raise exception 'Anonymous write accepted';exception when insufficient_privilege then null;end;
 reset role;
 foreach actor in array array[player_id,tester_id,admin_id] loop
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','is_anonymous',false,'user_metadata',jsonb_build_object('role','superadmin'))::text,true);
  set local role authenticated;
  update public.ig_vip_catalog set levels=edited where id=1;
  get diagnostics n=row_count;if n<>0 then raise exception 'Non-superadmin write accepted';end if;
  reset role;
 end loop;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated','is_anonymous',false)::text,true);
 set local role authenticated;
 update public.ig_vip_catalog set levels=edited where id=1 and revision=rev;
 get diagnostics n=row_count;if n<>1 then raise exception 'Superadmin write denied';end if;
 if (select revision from public.ig_vip_catalog where id=1)<>rev+1 then raise exception 'Revision not advanced';end if;
 update public.ig_vip_catalog set levels=original where id=1 and revision=rev;
 get diagnostics n=row_count;if n<>0 then raise exception 'Stale overwrite accepted';end if;
 foreach bad in array array[
  '{}'::jsonb,edited-33,jsonb_set(edited,'{0,xp_required}','1'),jsonb_set(edited,'{2,xp_required}','0'),
  jsonb_set(edited,'{1,xp_required}','1.5'),jsonb_set(edited,'{33,xp_required}','9007199254740992'),
  jsonb_set(edited,'{1,level}','9'),jsonb_set(edited,'{1,name}','null'),jsonb_set(edited,'{1,tier}','"__proto__"'),
  jsonb_set(edited,'{1,bonus}','100'),jsonb_set(edited,'{1,xp_required}','"1001"')
 ] loop
  begin update public.ig_vip_catalog set levels=bad where id=1;raise exception 'Invalid schedule accepted';exception when check_violation then null;end;
 end loop;
 begin update public.ig_vip_catalog set revision=100 where id=1;raise exception 'Revision forgery accepted';exception when insufficient_privilege then null;end;
 begin delete from public.ig_vip_catalog where id=1;raise exception 'Catalog deletion accepted';exception when insufficient_privilege then null;end;
 begin update public.wallets set experience_points=1000 where user_id=owner_id;raise exception 'Client XP award accepted';exception when insufficient_privilege then null;end;
 begin perform levels from internal.vip_catalog_history;raise exception 'Private audit leaked';exception when insufficient_privilege then null;end;
 reset role;
 if (select count(*) from internal.vip_catalog_history)<>audits+1 or
  (select changed_by from internal.vip_catalog_history where revision=rev+1)<>owner_id then raise exception 'Atomic audit incorrect';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','service_role')::text,true);
 update public.profiles set is_excluded=true where id=owner_id;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated','is_anonymous',false)::text,true);
 set local role authenticated;
 update public.ig_vip_catalog set levels=original where id=1;
 get diagnostics n=row_count;if n<>0 then raise exception 'Excluded superadmin write accepted';end if;
 reset role;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','service_role')::text,true);
 update public.profiles set is_excluded=false where id=owner_id;
 update public.user_roles set role='player' where user_id=owner_id;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated','is_anonymous',false)::text,true);
 set local role authenticated;
 update public.ig_vip_catalog set levels=original where id=1;
 get diagnostics n=row_count;if n<>0 then raise exception 'Demoted superadmin write accepted';end if;
 reset role;
end $test$;
select 'PASS: VIP public reads, private actor/audit, superadmin edits, revision CAS, atomic validation/audit, client XP denial, forged-role/tester/admin/exclusion/demotion denial' as result;
rollback;
