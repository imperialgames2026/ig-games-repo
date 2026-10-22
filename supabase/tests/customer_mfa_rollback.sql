begin;
do $test$
declare actor uuid:=gen_random_uuid(); other_actor uuid:=gen_random_uuid(); factor uuid:=gen_random_uuid(); n integer;
begin
 insert into auth.users(id,email) values(actor,'mfa-'||actor||'@example.invalid'),(other_actor,'mfa-'||other_actor||'@example.invalid');
 perform set_config('request.jwt.claim.sub',actor::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal','aal1')::text,true);
 execute 'set local role authenticated';
 if not internal.mfa_satisfied() then raise exception 'Non-enrolled user blocked'; end if;
 if (select count(*) from public.profiles where id=actor)<>1 then raise exception 'Own profile missing before enrollment'; end if;
 execute 'reset role';
 insert into auth.mfa_factors(id,user_id,factor_type,status,secret,created_at,updated_at) values(factor,actor,'totp','unverified','local-fixture-only',now(),now());
 execute 'set local role authenticated';
 if not internal.mfa_satisfied() then raise exception 'Unverified factor caused lockout'; end if;
 execute 'reset role';
 update auth.mfa_factors set status='verified' where id=factor;
 execute 'set local role authenticated';
 if internal.mfa_satisfied() then raise exception 'AAL1 accepted for enrolled account'; end if;
 if (select count(*) from public.profiles where id=actor)<>0 then raise exception 'Profile exposed without second factor'; end if;
 update public.profiles set full_name='Bypassed MFA' where id=actor;
 get diagnostics n=row_count;
 if n<>0 then raise exception 'Profile updated without second factor'; end if;
 begin
   insert into storage.objects(bucket_id,name,owner_id) values('profile-avatars',actor||'/'||gen_random_uuid()||'.png',actor::text);
   raise exception 'Storage MFA bypass';
 exception when insufficient_privilege then null; end;
 begin perform public.ign_action('demo_grant',null,gen_random_uuid(),null); raise exception 'IGN MFA bypass';
 exception when insufficient_privilege then
   if sqlerrm<>'Two-step verification required' then raise; end if;
 end;
 begin perform public.spin_vip_wheel(1,1); raise exception 'Wheel MFA bypass';
 exception when insufficient_privilege then
   if sqlerrm<>'Two-step verification required' then raise; end if;
 end;
 begin perform public.publish_vip_wheel(1,null,1,false); raise exception 'Wheel admin MFA bypass';
 exception when insufficient_privilege then
   if sqlerrm<>'Two-step verification required' then raise; end if;
 end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal','aal2')::text,true);
 if not internal.mfa_satisfied() then raise exception 'Verified AAL2 blocked'; end if;
 if (select count(*) from public.profiles where id=actor)<>1 then raise exception 'Own profile not restored at AAL2'; end if;
 if (select count(*) from public.profiles where id=other_actor)<>0 then raise exception 'MFA granted cross-account access'; end if;
 update public.profiles set full_name='MFA verified' where id=actor;
 get diagnostics n=row_count;
 if n<>1 then raise exception 'Own update not restored at AAL2'; end if;
 insert into storage.objects(bucket_id,name,owner_id) values('profile-avatars',actor||'/'||gen_random_uuid()||'.png',actor::text);
 perform public.ign_action('demo_grant',null,gen_random_uuid(),null);
 execute 'reset role';
 -- Every currently RLS-protected application table and storage.objects must have
 -- a restrictive policy with USING and WITH CHECK. Future tables must opt in too.
 if exists(select 1 from pg_class c join pg_namespace ns on ns.oid=c.relnamespace
   where c.relkind in ('r','p') and c.relrowsecurity and (ns.nspname='public' or (ns.nspname='storage' and c.relname='objects'))
   and not exists(select 1 from pg_policy p where p.polrelid=c.oid and p.polname='customer_mfa_required' and not p.polpermissive and p.polqual is not null and p.polwithcheck is not null))
 then raise exception 'Missing restrictive MFA policy'; end if;
 if has_function_privilege('anon','internal.mfa_satisfied()','execute') then raise exception 'Anonymous MFA helper grant'; end if;
end $test$;
select 'PASS: enrolled AAL1 denied for tables, storage and privileged RPC; AAL2 retains ownership; non-enrolled users remain eligible' as result;
rollback;
