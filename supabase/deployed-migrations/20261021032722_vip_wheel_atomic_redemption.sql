-- Explicitly published wallet-credit wheels. Existing draft prizes stay paused.
create table public.ig_vip_wheel_releases (
 stage smallint primary key check(stage between 1 and 3),
 revision bigint not null default 1 check(revision>0),
 config_revision bigint check(config_revision>0),
 active boolean not null default false,
 segments jsonb not null default '[]'::jsonb check(jsonb_typeof(segments)='array'),
 updated_at timestamptz not null default now(),
 check(not active or config_revision is not null)
);
alter table public.ig_vip_wheel_releases enable row level security;
revoke all on public.ig_vip_wheel_releases from public,anon,authenticated;
grant select on public.ig_vip_wheel_releases to anon,authenticated;
grant all on public.ig_vip_wheel_releases to service_role;
create policy vip_wheel_published_read on public.ig_vip_wheel_releases for select to anon,authenticated using(true);
create table internal.vip_wheel_release_history (
 stage smallint not null,revision bigint not null,config_revision bigint,
 active boolean not null,segments jsonb not null,changed_at timestamptz not null,changed_by uuid,
 primary key(stage,revision)
);
alter table internal.vip_wheel_release_history enable row level security;
revoke all on internal.vip_wheel_release_history from public,anon,authenticated;
grant select on internal.vip_wheel_release_history to service_role;
create policy vip_wheel_release_history_backend_only on internal.vip_wheel_release_history as restrictive for all to anon,authenticated using(false) with check(false);

create function internal.audit_vip_wheel_release() returns trigger language plpgsql security definer set search_path=''
as $$
declare item jsonb;total integer:=0;
begin
 if new.active then
  if jsonb_array_length(new.segments) not between 2 and 24 then raise exception 'A published wheel needs 2-24 sections' using errcode='22023';end if;
  for item in select value from jsonb_array_elements(new.segments) loop
   if (item->>'weight')::integer>0 then
    if item->>'unit' not in ('IGN','IGD','IGT') or (item->>'amount')::numeric<=0 then
     raise exception 'Every enabled section needs a positive IGN, IGD or IGT wallet reward. Other prize types must stay at weight 0.' using errcode='22023';
    end if;
    total:=total+(item->>'weight')::integer;
   end if;
  end loop;
  if total<=0 or total>240000 then raise exception 'Publish at least one enabled wallet reward' using errcode='22023';end if;
 end if;
 new.revision:=case when tg_op='INSERT' then 1 else old.revision+1 end;
 new.updated_at:=clock_timestamp();
 insert into internal.vip_wheel_release_history(stage,revision,config_revision,active,segments,changed_at,changed_by)
 values(new.stage,new.revision,new.config_revision,new.active,new.segments,new.updated_at,auth.uid());
 return new;
end $$;
revoke all on function internal.audit_vip_wheel_release() from public,anon,authenticated,service_role;
create trigger vip_wheel_release_audit before insert or update on public.ig_vip_wheel_releases for each row execute function internal.audit_vip_wheel_release();
insert into public.ig_vip_wheel_releases(stage) values(1),(2),(3);

-- One receipt per earned spin, NOT per prize: different spins can win the same section.
create table public.ig_vip_wheel_receipts (
 id uuid not null default gen_random_uuid() unique,
 user_id uuid not null,level smallint not null,
 stage smallint not null check(stage between 1 and 3),
 release_revision bigint not null,config_revision bigint not null,
 reward jsonb not null,
 ticket integer not null,total_weight integer not null check(total_weight between 1 and 240000),
 transaction_id uuid not null unique references public.transactions(id),
 balance_after text not null,
 created_at timestamptz not null default clock_timestamp(),
 primary key(user_id,level),
 foreign key(user_id,level) references public.ig_vip_level_spins(user_id,level),
 check(ticket>=0 and ticket<total_weight),
 check(stage=case when level<=11 then 1 when level<=24 then 2 else 3 end)
);
alter table public.ig_vip_wheel_receipts enable row level security;
revoke all on public.ig_vip_wheel_receipts from public,anon,authenticated;
grant select on public.ig_vip_wheel_receipts to authenticated;
grant all on public.ig_vip_wheel_receipts to service_role;
create policy vip_wheel_receipts_owner_read on public.ig_vip_wheel_receipts for select to authenticated
 using(user_id=(select auth.uid()) and coalesce((select auth.jwt()->>'is_anonymous'),'false')='false'
 and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_excluded=false)
 and exists(select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role in ('player','tester','admin','superadmin')));

-- Every privileged call binds to the actual user/session. No actor UUID is accepted.
create function internal.vip_wheel_actor(p_superadmin boolean) returns uuid
language plpgsql security definer set search_path=''
as $$
declare actor uuid:=auth.uid();session_text text:=auth.jwt()->>'session_id';actor_role text;
begin
 if actor is null or coalesce(auth.jwt()->>'is_anonymous','false')<>'false'
 or session_text is null or session_text !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
  raise exception 'A registered, active session is required' using errcode='42501';
 end if;
 perform 1 from auth.users u join auth.sessions s on s.user_id=u.id
 where u.id=actor and s.id=session_text::uuid and not coalesce(u.is_anonymous,false)
 and (u.banned_until is null or u.banned_until<=now()) and (s.not_after is null or s.not_after>now()) for share of u,s;
 if not found then raise exception 'Session expired. Sign in again.' using errcode='42501';end if;
 perform 1 from public.profiles where id=actor and is_excluded=false for share;
 if not found then raise exception 'Account unavailable' using errcode='42501';end if;
 select role into actor_role from public.user_roles where user_id=actor for share;
 if actor_role is null or actor_role not in ('player','admin','superadmin') or (p_superadmin and actor_role<>'superadmin') then
  raise exception 'Account is not authorized for this wheel action' using errcode='42501';
 end if;
 return actor;
end $$;
revoke all on function internal.vip_wheel_actor(boolean) from public,anon,authenticated,service_role;

create function internal.publish_vip_wheel(p_stage integer,p_settings_revision bigint,p_release_revision bigint,p_active boolean)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare actor uuid;current_release public.ig_vip_wheel_releases%rowtype;settings public.ig_vip_wheel_settings%rowtype;
begin
 actor:=internal.vip_wheel_actor(true);
 if p_stage is null or p_stage not between 1 and 3 or p_release_revision is null or p_release_revision<1 or p_active is null
 or (p_active and (p_settings_revision is null or p_settings_revision<1)) or (not p_active and p_settings_revision is not null) then
  raise exception 'Invalid wheel publication request' using errcode='22023';end if;
 select * into current_release from public.ig_vip_wheel_releases where stage=p_stage for update;
 if current_release.revision=p_release_revision+1 and current_release.active=p_active
 and (not p_active or current_release.config_revision=p_settings_revision) then return to_jsonb(current_release);end if;
 if current_release.revision<>p_release_revision then raise exception 'Published wheel changed. Reload before publishing.' using errcode='40001';end if;
 if p_active then
  select * into settings from public.ig_vip_wheel_settings where stage=p_stage for share;
  if settings.revision<>p_settings_revision then raise exception 'Draft wheel changed. Reload before publishing.' using errcode='40001';end if;
  update public.ig_vip_wheel_releases set active=true,config_revision=settings.revision,segments=settings.segments where stage=p_stage returning * into current_release;
 else
  update public.ig_vip_wheel_releases set active=false where stage=p_stage returning * into current_release;
 end if;
 return to_jsonb(current_release);
end $$;
revoke all on function internal.publish_vip_wheel(integer,bigint,bigint,boolean) from public,anon,authenticated,service_role;
grant execute on function internal.publish_vip_wheel(integer,bigint,bigint,boolean) to authenticated;
create function public.publish_vip_wheel(p_stage integer,p_settings_revision bigint,p_release_revision bigint,p_active boolean)
returns jsonb language sql security invoker set search_path='' as $$ select internal.publish_vip_wheel(p_stage,p_settings_revision,p_release_revision,p_active) $$;
revoke all on function public.publish_vip_wheel(integer,bigint,bigint,boolean) from public,anon,authenticated,service_role;
grant execute on function public.publish_vip_wheel(integer,bigint,bigint,boolean) to authenticated;

create function internal.spin_vip_wheel(p_level integer,p_release_revision bigint)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare actor uuid;grant_row public.ig_vip_level_spins%rowtype;release public.ig_vip_wheel_releases%rowtype;
 receipt public.ig_vip_wheel_receipts%rowtype;item jsonb;prize jsonb;total integer;cursor_weight integer:=0;
 bytes bytea;sample bigint;sample_limit bigint;ticket integer;amount numeric;balance numeric;
 receipt_id uuid:=gen_random_uuid();transaction_id uuid:=gen_random_uuid();currency text;
begin
 actor:=internal.vip_wheel_actor(false);
 if p_level is null or p_level not between 1 and 34 or p_release_revision is null or p_release_revision<1 then raise exception 'Invalid spin request' using errcode='22023';end if;
 -- This row lock serializes every request for this particular earned spin.
 select * into grant_row from public.ig_vip_level_spins where user_id=actor and level=p_level for update;
 if not found then raise exception 'This level spin has not been earned' using errcode='22023';end if;
 select * into receipt from public.ig_vip_wheel_receipts where user_id=actor and level=p_level;
 if found then return to_jsonb(receipt);end if;
 select * into release from public.ig_vip_wheel_releases where stage=grant_row.stage for share;
 if not release.active then raise exception 'This wheel is paused. Your spin is still saved.' using errcode='22023';end if;
 if release.revision<>p_release_revision then raise exception 'Wheel prizes changed. Review the new prizes before spinning.' using errcode='40001';end if;
 select sum((value->>'weight')::integer) into total from jsonb_array_elements(release.segments);
 -- Uniform CSPRNG ticket with rejection sampling (no modulo bias, no client outcome).
 sample_limit:=4294967296-(4294967296%total);
 loop
  bytes:=extensions.gen_random_bytes(4);
  sample:=get_byte(bytes,0)::bigint*16777216+get_byte(bytes,1)::bigint*65536+get_byte(bytes,2)::bigint*256+get_byte(bytes,3);
  exit when sample<sample_limit;
 end loop;
 ticket:=(sample%total)::integer;
 for item in select value from jsonb_array_elements(release.segments) loop
  cursor_weight:=cursor_weight+(item->>'weight')::integer;
  if ticket<cursor_weight then prize:=item;exit;end if;
 end loop;
 currency:=prize->>'unit';amount:=(prize->>'amount')::numeric;
 if currency is null or currency not in ('IGN','IGD','IGT') or amount is null or amount<=0 then raise exception 'Unsupported published prize' using errcode='22023';end if;
 perform 1 from public.wallets where user_id=actor for update;
 if not found then raise exception 'Wallet unavailable. Your spin is still saved.' using errcode='22023';end if;
 if currency='IGN' then
  update public.wallets set cent_balance=cent_balance+amount,updated_at=now() where user_id=actor returning cent_balance into balance;
 elsif currency='IGD' then
  update public.wallets set igd_balance=igd_balance+amount,updated_at=now() where user_id=actor returning igd_balance into balance;
 else
  update public.wallets set igt_balance=igt_balance+amount,updated_at=now() where user_id=actor returning igt_balance into balance;
 end if;
 if balance is null or balance<amount or balance::text in ('NaN','Infinity','-Infinity') then raise exception 'Invalid wallet balance' using errcode='22023';end if;
 insert into public.transactions(id,user_id,type,currency,cent_amount,igd_amount,igt_amount,balance_after,status,description,reference_id,notes)
 values(transaction_id,actor,'bonus',currency,case when currency='IGN' then amount else 0 end,case when currency='IGD' then amount else 0 end,case when currency='IGT' then amount else 0 end,balance,'completed','VIP wheel reward for level '||p_level,receipt_id::text,jsonb_build_object('source','vip_reward_wheel','level',p_level,'stage',grant_row.stage,'release_revision',release.revision));
 insert into public.ig_vip_wheel_receipts(id,user_id,level,stage,release_revision,config_revision,reward,ticket,total_weight,transaction_id,balance_after)
 values(receipt_id,actor,p_level,grant_row.stage,release.revision,release.config_revision,prize,ticket,total,transaction_id,balance::text) returning * into receipt;
 return to_jsonb(receipt);
end $$;
revoke all on function internal.spin_vip_wheel(integer,bigint) from public,anon,authenticated,service_role;
grant execute on function internal.spin_vip_wheel(integer,bigint) to authenticated;
create function public.spin_vip_wheel(p_level integer,p_release_revision bigint)
returns jsonb language sql security invoker set search_path='' as $$ select internal.spin_vip_wheel(p_level,p_release_revision) $$;
revoke all on function public.spin_vip_wheel(integer,bigint) from public,anon,authenticated,service_role;
grant execute on function public.spin_vip_wheel(integer,bigint) to authenticated;
