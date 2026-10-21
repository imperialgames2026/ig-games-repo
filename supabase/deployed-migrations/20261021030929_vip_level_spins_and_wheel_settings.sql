-- One saved reward-wheel spin for each VIP level reached, including level 1.
-- Stage 1: levels 1-11; stage 2: 12-24; stage 3: 25-34.
-- No prize draw, wallet credit, or spin consumption is enabled by this migration.
create table public.ig_vip_level_spins (
 user_id uuid not null references public.profiles(id) on delete cascade,
 level smallint not null check(level between 1 and 34),
 stage smallint generated always as (case when level<=11 then 1 when level<=24 then 2 else 3 end) stored,
 level_name text not null check(char_length(level_name) between 1 and 80),
 required_xp bigint not null check(required_xp>=0),
 earned_xp bigint not null check(earned_xp>=required_xp),
 catalog_revision bigint not null check(catalog_revision>0),
 source text not null check(source in ('signup','xp_progress','existing_level')),
 earned_at timestamptz not null default clock_timestamp(),
 primary key(user_id,level)
);
alter table public.ig_vip_level_spins enable row level security;
revoke all on public.ig_vip_level_spins from public,anon,authenticated,service_role;
grant select on public.ig_vip_level_spins to authenticated,service_role;
create policy vip_level_spins_owner_read on public.ig_vip_level_spins for select to authenticated
 using (user_id=(select auth.uid())
  and coalesce((select auth.jwt()->>'is_anonymous'),'false')='false'
  and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_excluded=false)
  and exists(select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role in ('player','tester','admin','superadmin')));

-- Only trusted wallet/signup triggers invoke this helper. It is not an API RPC.
create function internal.grant_vip_level_spins(p_user uuid,p_previous_xp bigint,p_current_xp bigint,p_source text)
returns void language plpgsql security definer set search_path=''
as $function$
begin
 if p_user is null or p_current_xp is null or p_current_xp<0 or p_current_xp<=p_previous_xp then return;end if;
 if not exists(select 1 from public.profiles p join public.user_roles r on r.user_id=p.id
  join auth.users u on u.id=p.id where p.id=p_user and not p.is_excluded
  and r.role in ('player','admin','superadmin') and not coalesce(u.is_anonymous,false)) then return;end if;
 insert into public.ig_vip_level_spins(user_id,level,level_name,required_xp,earned_xp,catalog_revision,source)
 select p_user,(item->>'level')::smallint,item->>'name',(item->>'xp_required')::bigint,p_current_xp,c.revision,p_source
 from public.ig_vip_catalog c cross join lateral jsonb_array_elements(c.levels) as item
 where c.id=1 and (item->>'xp_required')::bigint>p_previous_xp
  and (item->>'xp_required')::bigint<=p_current_xp
 on conflict(user_id,level) do nothing;
end;
$function$;
revoke all on function internal.grant_vip_level_spins(uuid,bigint,bigint,text) from public,anon,authenticated,service_role;

create function internal.vip_level_spins_wallet_trigger() returns trigger
language plpgsql security definer set search_path=''
as $function$
begin
 if tg_op='INSERT' then
  perform internal.grant_vip_level_spins(new.user_id,-1,new.experience_points,'signup');
 elsif new.experience_points>old.experience_points then
  perform internal.grant_vip_level_spins(new.user_id,old.experience_points,new.experience_points,'xp_progress');
 end if;
 return new;
end;
$function$;
revoke all on function internal.vip_level_spins_wallet_trigger() from public,anon,authenticated,service_role;
create trigger vip_level_spins_wallet after insert or update of experience_points on public.wallets
 for each row execute function internal.vip_level_spins_wallet_trigger();

-- Existing signup triggers create wallet before canonical role. Alphabetical
-- trigger order puts this one after on_auth_user_created_player_role.
create function internal.vip_level_spins_signup_trigger() returns trigger
language plpgsql security definer set search_path=''
as $function$
begin
 perform internal.grant_vip_level_spins(new.id,-1,w.experience_points,'signup')
 from public.wallets w where w.user_id=new.id;
 return new;
end;
$function$;
revoke all on function internal.vip_level_spins_signup_trigger() from public,anon,authenticated,service_role;
create trigger on_auth_user_created_vip_level_spins after insert on auth.users
 for each row execute function internal.vip_level_spins_signup_trigger();
create trigger on_auth_user_registered_vip_level_spins after update of is_anonymous on auth.users
 for each row when (old.is_anonymous is true and new.is_anonymous is false)
 execute function internal.vip_level_spins_signup_trigger();

-- Enroll current Supabase accounts from their authoritative wallet XP. This is
-- program enrollment, not an import of any Base44 customer data or balances.
select internal.grant_vip_level_spins(w.user_id,-1,w.experience_points,'existing_level')
from public.wallets w;

-- Admin-owned draft settings. Saving a configuration never draws or pays prizes.
create table public.ig_vip_wheel_settings (
 stage smallint primary key check(stage between 1 and 3),
 segments jsonb not null,
 revision bigint not null default 1 check(revision>0),
 updated_at timestamptz not null default now(),
 updated_by uuid
);
alter table public.ig_vip_wheel_settings enable row level security;
revoke all on public.ig_vip_wheel_settings from public,anon,authenticated;
grant select(stage,segments,revision,updated_at) on public.ig_vip_wheel_settings to authenticated;
grant update(segments) on public.ig_vip_wheel_settings to authenticated;
grant all on public.ig_vip_wheel_settings to service_role;
create policy vip_wheel_staff_read on public.ig_vip_wheel_settings for select to authenticated
 using ((select public.is_admin_or_superadmin()));
create policy vip_wheel_superadmin_update on public.ig_vip_wheel_settings for update to authenticated
 using ((select public.is_superadmin())) with check ((select public.is_superadmin()));
create table internal.vip_wheel_settings_history (
 stage smallint not null,
 revision bigint not null,
 segments jsonb not null,
 changed_at timestamptz not null,
 changed_by uuid,
 primary key(stage,revision)
);
alter table internal.vip_wheel_settings_history enable row level security;
revoke all on internal.vip_wheel_settings_history from public,anon,authenticated;
grant select on internal.vip_wheel_settings_history to service_role;
create policy vip_wheel_history_backend_only on internal.vip_wheel_settings_history as restrictive
 for all to anon,authenticated using(false) with check(false);
create function internal.validate_and_audit_vip_wheel_settings() returns trigger
language plpgsql security definer set search_path=''
as $function$
declare item jsonb; position integer:=0; weight numeric;
begin
 if jsonb_typeof(new.segments) is distinct from 'array' then raise exception 'Wheel sections must be an array' using errcode='23514';end if;
 if jsonb_array_length(new.segments) not between 2 and 24 then raise exception 'A wheel needs 2-24 sections' using errcode='23514';end if;
 for item in select value from jsonb_array_elements(new.segments) loop
  position:=position+1;
  if jsonb_typeof(item) is distinct from 'object' then raise exception 'Invalid wheel section' using errcode='23514';end if;
  if not(item ?& array['slot','reward','amount','unit','weight','notes']) or item-array['slot','reward','amount','unit','weight','notes']<>'{}'::jsonb
   or jsonb_typeof(item->'slot') is distinct from 'number' or item->'slot'<>to_jsonb(position)
   or jsonb_typeof(item->'reward') is distinct from 'string' or char_length(item->>'reward') not between 1 and 80 or btrim(item->>'reward')=''
   or jsonb_typeof(item->'unit') is distinct from 'string' or char_length(item->>'unit') not between 1 and 24 or btrim(item->>'unit')=''
   or jsonb_typeof(item->'notes') is distinct from 'string' or char_length(item->>'notes')>240
   or jsonb_typeof(item->'amount') is distinct from 'string' or (item->>'amount') !~ '^(0|[1-9][0-9]{0,15})(\.[0-9]{1,8})?$'
   or jsonb_typeof(item->'weight') is distinct from 'number' then
   raise exception 'Invalid wheel section fields' using errcode='23514';
  end if;
  weight:=(item->>'weight')::numeric;
  if weight<>trunc(weight) or weight not between 0 and 10000 then raise exception 'Weight must be a whole number from 0 to 10000' using errcode='23514';end if;
 end loop;
 if tg_op='UPDATE' then new.revision:=old.revision+1;else new.revision:=1;end if;
 new.updated_at:=clock_timestamp();new.updated_by:=auth.uid();
 insert into internal.vip_wheel_settings_history(stage,revision,segments,changed_at,changed_by)
 values(new.stage,new.revision,new.segments,new.updated_at,new.updated_by);
 return new;
end;
$function$;
revoke all on function internal.validate_and_audit_vip_wheel_settings() from public,anon,authenticated,service_role;
create trigger vip_wheel_settings_validate_audit before insert or update on public.ig_vip_wheel_settings
 for each row execute function internal.validate_and_audit_vip_wheel_settings();

insert into public.ig_vip_wheel_settings(stage,segments) values (1,$seed$[{"slot":1,"reward":"Currency reward","amount":"0.5","unit":"ID","weight":30,"notes":""},{"slot":2,"reward":"Currency reward","amount":"100","unit":"ID","weight":15,"notes":""},{"slot":3,"reward":"XP multiplier","amount":"10","unit":"multiplier","weight":25,"notes":"Set eligible activity and duration before launch."},{"slot":4,"reward":"Currency reward","amount":"20","unit":"ID","weight":30,"notes":""},{"slot":5,"reward":"Extra spins","amount":"1","unit":"spins","weight":20,"notes":"Set eligible game and spin stake before launch."},{"slot":6,"reward":"Currency reward","amount":"10","unit":"ID","weight":30,"notes":""},{"slot":7,"reward":"Free bet","amount":"0","unit":"ID","weight":20,"notes":"Set the amount, eligible game and wager rules before launch."},{"slot":8,"reward":"Currency reward","amount":"2","unit":"ID","weight":30,"notes":""},{"slot":9,"reward":"Currency reward","amount":"5","unit":"ID","weight":25,"notes":""},{"slot":10,"reward":"Bitcoin reward","amount":"1","unit":"BTC","weight":0,"notes":"Legacy jackpot is excluded with weight 0. No payout is scheduled."}]$seed$::jsonb);

insert into public.ig_vip_wheel_settings(stage,segments) values (2,$seed$[{"slot":1,"reward":"Currency reward","amount":"10","unit":"ID","weight":30,"notes":""},{"slot":2,"reward":"Currency reward","amount":"500","unit":"ID","weight":10,"notes":""},{"slot":3,"reward":"XP multiplier","amount":"10","unit":"multiplier","weight":25,"notes":"Set eligible activity and duration before launch."},{"slot":4,"reward":"Currency reward","amount":"100","unit":"ID","weight":20,"notes":""},{"slot":5,"reward":"Extra spins","amount":"30","unit":"spins","weight":20,"notes":"Set eligible game and spin stake before launch."},{"slot":6,"reward":"Currency reward","amount":"50","unit":"ID","weight":30,"notes":""},{"slot":7,"reward":"Free bet","amount":"0","unit":"ID","weight":20,"notes":"Set the amount, eligible game and wager rules before launch."},{"slot":8,"reward":"Currency reward","amount":"20","unit":"ID","weight":30,"notes":""},{"slot":9,"reward":"Currency reward","amount":"30","unit":"ID","weight":25,"notes":""},{"slot":10,"reward":"Bitcoin reward","amount":"3","unit":"BTC","weight":0,"notes":"Legacy jackpot is excluded with weight 0. No payout is scheduled."}]$seed$::jsonb);

insert into public.ig_vip_wheel_settings(stage,segments) values (3,$seed$[{"slot":1,"reward":"Currency reward","amount":"20","unit":"ID","weight":30,"notes":""},{"slot":2,"reward":"Currency reward","amount":"999","unit":"ID","weight":8,"notes":""},{"slot":3,"reward":"XP multiplier","amount":"10","unit":"multiplier","weight":25,"notes":"Set eligible activity and duration before launch."},{"slot":4,"reward":"Currency reward","amount":"200","unit":"ID","weight":15,"notes":""},{"slot":5,"reward":"Extra spins","amount":"50","unit":"spins","weight":20,"notes":"Set eligible game and spin stake before launch."},{"slot":6,"reward":"Currency reward","amount":"150","unit":"ID","weight":25,"notes":""},{"slot":7,"reward":"Free bet","amount":"0","unit":"ID","weight":20,"notes":"Set the amount, eligible game and wager rules before launch."},{"slot":8,"reward":"Currency reward","amount":"50","unit":"ID","weight":30,"notes":""},{"slot":9,"reward":"Currency reward","amount":"100","unit":"ID","weight":25,"notes":""},{"slot":10,"reward":"Bitcoin reward","amount":"5","unit":"BTC","weight":0,"notes":"Legacy jackpot is excluded with weight 0. No payout is scheduled."}]$seed$::jsonb);
