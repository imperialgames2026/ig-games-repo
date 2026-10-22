-- Customer opt-in TOTP: existing users remain eligible until a factor is verified.
-- Read only the current actor's factor status; never expose factor secrets.
create or replace function internal.mfa_satisfied()
returns boolean language sql stable security definer set search_path = '' as $$
 select auth.uid() is not null and (
   coalesce(auth.jwt()->>'aal','aal1') = 'aal2'
   or not exists (
     select 1 from auth.mfa_factors
     where user_id = auth.uid() and status = 'verified'
   )
 );
$$;
revoke all on function internal.mfa_satisfied() from public,anon;
grant execute on function internal.mfa_satisfied() to authenticated,service_role;
comment on function internal.mfa_satisfied() is
 'Own-account MFA boundary. Internal schema must remain outside the Data API exposed schemas.';

-- The historical own-update policy re-reads profiles in its WITH CHECK. Combined
-- with restrictive policies this causes recursive RLS expansion. Preserve its
-- exact protected-field comparisons in an own-actor private helper instead.
create or replace function internal.profile_security_matches(p_role text,p_excluded boolean,p_kyc text)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.profiles p where p.id=auth.uid()
   and p.role::text=p_role and p.is_excluded=p_excluded and p.kyc_status::text=p_kyc);
$$;
revoke all on function internal.profile_security_matches(text,boolean,text) from public,anon;
grant execute on function internal.profile_security_matches(text,boolean,text) to authenticated,service_role;
alter policy "profiles own safe update" on public.profiles to authenticated
 with check (auth.uid()=id and internal.profile_security_matches(role::text,is_excluded,kyc_status::text));

-- Restrictive policies add a requirement; they never grant ownership or access.
do $policies$
declare t record;
begin
 for t in select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where c.relkind in ('r','p') and c.relrowsecurity and
     (n.nspname='public' or (n.nspname='storage' and c.relname='objects'))
 loop
   execute format('create policy customer_mfa_required on %I.%I as restrictive for all to authenticated using ((select internal.mfa_satisfied())) with check ((select internal.mfa_satisfied()))',t.nspname,t.relname);
 end loop;
end $policies$;

-- These actor-bound private definer entry points intentionally bypass table RLS.
-- Add the same check at entry without changing their settlement or role logic.
-- vip_wheel_actor is shared by both publish_vip_wheel and spin_vip_wheel.
do $entrypoints$
declare target regprocedure; definition text; guarded text;
begin
 foreach target in array array[
   'internal.ign_action(text,numeric,uuid,boolean)'::regprocedure,
   'internal.vip_wheel_actor(boolean)'::regprocedure
 ] loop
   select pg_get_functiondef(target) into definition;
   if definition !~* '\mLANGUAGE plpgsql\M' then raise exception 'Unexpected MFA entry point language: %',target; end if;
   guarded := regexp_replace(definition, '\mbegin\M',
     E'begin\n if not internal.mfa_satisfied() then raise exception ''Two-step verification required'' using errcode=''42501''; end if;', 'i');
   if guarded = definition then raise exception 'MFA entry point was not guarded: %',target; end if;
   execute guarded;
 end loop;
end $entrypoints$;
notify pgrst,'reload schema';
