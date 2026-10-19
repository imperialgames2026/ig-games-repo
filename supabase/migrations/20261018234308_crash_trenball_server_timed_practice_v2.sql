-- Staging-only, isolated Crash/Trenball practice engine. Mirrors staging migration; incorporates secure RNG hotfix.
create extension if not exists pgcrypto with schema extensions;
create table if not exists public.ig_crash_v2_queue (
 id bigint generated always as identity primary key,
 seed_secret text not null,crash_point numeric(10,2) not null check(crash_point between 0 and 12000),
 duration_ms integer not null check(duration_ms between 500 and 40000),
 commitment text not null check(length(commitment)=64),
 status text not null default 'queued' check(status in ('queued','consumed')),created_at timestamptz not null default now()
);
create index if not exists ig_crash_v2_queue_pick on public.ig_crash_v2_queue(id) where status='queued';
create table if not exists public.ig_crash_v2_runtime(
 singleton smallint primary key default 1 check(singleton=1),round_no bigint not null default 0,
 seed_secret text,crash_point numeric(10,2),duration_ms integer,commitment text,
 betting_ends_at timestamptz,started_at timestamptz,crashes_at timestamptz,
 settled boolean not null default true,last_result jsonb,updated_at timestamptz not null default now()
);
insert into public.ig_crash_v2_runtime(singleton) values(1) on conflict do nothing;
create table if not exists public.ig_crash_v2_seats(
 user_id uuid primary key references auth.users(id) on delete cascade,
 chips bigint not null default 1000 check(chips>=0),joined boolean not null default true,
 updated_at timestamptz not null default now()
);
create table if not exists public.ig_crash_v2_bets(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 round_no bigint not null,request_id uuid not null unique,
 mode text not null check(mode in ('crash_manual','crash_auto','tren_red','tren_green','tren_yellow')),
 target numeric(10,2),units integer not null check(units between 1 and 100),
 status text not null default 'active' check(status in ('active','won','lost')),
 paid_units bigint not null default 0 check(paid_units>=0),
 cashout_x numeric(10,2),cashout_request uuid unique,placed_at timestamptz not null default now(),settled_at timestamptz
);
create index if not exists ig_crash_v2_bets_current on public.ig_crash_v2_bets(round_no,status);
create index if not exists ig_crash_v2_bets_user on public.ig_crash_v2_bets(user_id,placed_at desc);
create table if not exists public.ig_crash_v2_history(
 round_no bigint primary key,commitment text not null,server_seed text not null,
 crash_point numeric(10,2) not null,duration_ms integer not null,ended_at timestamptz not null
);
do $block$ declare t text;begin
 foreach t in array array['ig_crash_v2_queue','ig_crash_v2_runtime','ig_crash_v2_seats','ig_crash_v2_bets','ig_crash_v2_history'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 end loop;
end $block$;
comment on table public.ig_crash_v2_seats is 'Nonredeemable, nontransferable staging practice chips only. Never connected to financial wallets.';

CREATE OR REPLACE FUNCTION public.ig_crash_v2_fill_queue()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare k integer; bytes bytea; r numeric; point numeric; duration integer; seed text; batch_count integer;
begin
 select count(*) into batch_count from public.ig_crash_v2_queue where status='queued';
 if batch_count >= 30 then return; end if;
 for k in 1..150 loop
  bytes:=extensions.gen_random_bytes(4);
  r:=(get_byte(bytes,0)::numeric*16777216 + get_byte(bytes,1)::numeric*65536
      + get_byte(bytes,2)::numeric*256+get_byte(bytes,3)::numeric)/4294967296.0;
  if r < 0.01 then point:=0;
  else point:=least(12000,round(0.99/(1-(r-0.01)/0.99),2)); end if;
  duration:=greatest(500,least(40000,round(40000*ln(1+point)/ln(12001))::integer));
  seed:=encode(extensions.gen_random_bytes(32),'hex');
  insert into public.ig_crash_v2_queue(seed_secret,crash_point,duration_ms,commitment)
   values(seed,point,duration,encode(extensions.digest(seed||':'||point::text||':'||duration::text,'sha256'),'hex'));
 end loop;
end $function$;

CREATE OR REPLACE FUNCTION public.ig_crash_v2_tick()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v public.ig_crash_v2_runtime%rowtype; b public.ig_crash_v2_bets%rowtype;
 q public.ig_crash_v2_queue%rowtype; ts timestamptz; x numeric; paid bigint;
 winning boolean; factor numeric; r jsonb;
begin
 select * into v from public.ig_crash_v2_runtime where singleton=1 for update;
 if not found then raise exception 'crash runtime not initialized'; end if;
 ts:=clock_timestamp();
 if v.round_no>0 and not v.settled and ts>=v.crashes_at then
  for b in select * from public.ig_crash_v2_bets where round_no=v.round_no and status='active' for update loop
   winning:=false;factor:=0;paid:=0;
   if b.mode='crash_auto' and b.target<=v.crash_point then winning:=true;factor:=b.target;
   elsif b.mode='tren_red' and v.crash_point<2 then winning:=true;factor:=1.97;
   elsif b.mode='tren_green' and v.crash_point>=2 and v.crash_point<10 then winning:=true;factor:=2;
   elsif b.mode='tren_yellow' and v.crash_point>=10 then winning:=true;factor:=10; end if;
   if winning then paid:=floor(b.units*factor)::bigint; end if;
   update public.ig_crash_v2_bets set status=case when winning then 'won' else 'lost' end,
    paid_units=paid,cashout_x=case when b.mode='crash_auto' and winning then factor else null end,
    settled_at=ts where id=b.id;
   if paid>0 then update public.ig_crash_v2_seats set chips=chips+paid where user_id=b.user_id; end if;
  end loop;
  r:=jsonb_build_object('round',v.round_no,'crashPoint',v.crash_point,'durationMs',v.duration_ms,
     'commitment',v.commitment,'serverSeed',v.seed_secret,'practiceOnly',true);
  insert into public.ig_crash_v2_history(round_no,commitment,server_seed,crash_point,duration_ms,ended_at)
   values(v.round_no,v.commitment,v.seed_secret,v.crash_point,v.duration_ms,ts) on conflict do nothing;
  update public.ig_crash_v2_runtime set settled=true,last_result=r,updated_at=ts where singleton=1;
  v.settled:=true;v.last_result:=r;
 elsif v.round_no>0 and not v.settled and ts>=v.started_at then
  -- Automatic cashouts are handled by the server, even when a player is offline.
  x:=least(12000,round((exp(ln(12001)*least(40000,greatest(0,extract(epoch from (ts-v.started_at))*1000))/40000)-1)::numeric,2));
  for b in select * from public.ig_crash_v2_bets where round_no=v.round_no and status='active'
       and mode='crash_auto' and target<=x for update loop
   paid:=floor(b.units*b.target)::bigint;
   update public.ig_crash_v2_bets set status='won',paid_units=paid,cashout_x=b.target,settled_at=ts where id=b.id;
   update public.ig_crash_v2_seats set chips=chips+paid where user_id=b.user_id;
  end loop;
 end if;
 if v.round_no=0 or (v.settled and ts>=v.crashes_at+interval '2 seconds') then
  perform public.ig_crash_v2_fill_queue();
  select * into q from public.ig_crash_v2_queue where status='queued' order by id limit 1 for update;
  if not found then raise exception 'empty crash queue'; end if;
  update public.ig_crash_v2_queue set status='consumed' where id=q.id;
  update public.ig_crash_v2_runtime set round_no=v.round_no+1,
   seed_secret=q.seed_secret,crash_point=q.crash_point,duration_ms=q.duration_ms,commitment=q.commitment,
   betting_ends_at=ts+interval '6 seconds', started_at=ts+interval '6 seconds',
   crashes_at=ts+interval '6 seconds'+q.duration_ms*interval '1 millisecond',
   settled=false,updated_at=ts where singleton=1;
 end if;
end $function$;

CREATE OR REPLACE FUNCTION public.ig_crash_v2_state(p_actor uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v public.ig_crash_v2_runtime%rowtype; s public.ig_crash_v2_seats%rowtype;
 ts timestamptz; x numeric; phase text; mine jsonb; recent jsonb; all_bets jsonb; players integer;
begin
 if not exists(select 1 from public.user_roles r join public.profiles p on p.id=r.user_id
  where r.user_id=p_actor and p.is_excluded=false and r.role::text in ('tester','player','admin','superadmin'))
  then raise exception 'not eligible' using errcode='42501'; end if;
 perform public.ig_crash_v2_tick();
 select * into v from public.ig_crash_v2_runtime where singleton=1;
 select * into s from public.ig_crash_v2_seats where user_id=p_actor;
 ts:=clock_timestamp();
 phase:=case when v.settled then 'crashed' when ts<v.started_at then 'betting'
             when ts<v.crashes_at then 'live' else 'crashed' end;
 x:=case when phase='betting' then 0 when phase='crashed' then v.crash_point
   else least(12000,round((exp(ln(12001)*least(40000,greatest(0,extract(epoch from(ts-v.started_at))*1000))/40000)-1)::numeric,2)) end;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'mode',mode,'target',target,
    'units',units,'status',status,'paidUnits',paid_units,'cashoutX',cashout_x,'round',round_no)
    order by placed_at desc),'[]'::jsonb) into mine from
    (select * from public.ig_crash_v2_bets where user_id=p_actor order by placed_at desc limit 15) a;
 select coalesce(jsonb_agg(jsonb_build_object('round',round_no,'crashPoint',crash_point,
   'commitment',commitment,'serverSeed',server_seed,'durationMs',duration_ms)
   order by round_no desc),'[]'::jsonb) into recent from
   (select * from public.ig_crash_v2_history order by round_no desc limit 12) h;
 select coalesce(jsonb_agg(jsonb_build_object('mode',mode,'units',total,'count',bets)),'[]'::jsonb)
   into all_bets from (select mode,sum(units) total,count(*) bets from public.ig_crash_v2_bets
     where round_no=v.round_no group by mode) b;
 select count(*) into players from public.ig_crash_v2_seats where joined=true;
 return jsonb_build_object('round',v.round_no,'phase',phase,'serverTime',ts,
  'bettingEndsAt',v.betting_ends_at,'startedAt',v.started_at,'crashesAt',case when v.settled then v.crashes_at else null end,
  'multiplier',x,'commitment',v.commitment,'lastResult',v.last_result,
  'joined',coalesce(s.joined,false),'chips',case when s.joined then s.chips else 0 end,
  'players',players,'myBets',mine,'publicBets',all_bets,'history',recent,
  'practiceOnly',true,'realMoneyEnabled',false);
end $function$;

CREATE OR REPLACE FUNCTION public.ig_crash_v2_action(p_actor uuid, p_action text, p_round bigint DEFAULT NULL::bigint, p_request uuid DEFAULT NULL::uuid, p_mode text DEFAULT NULL::text, p_target numeric DEFAULT NULL::numeric, p_units integer DEFAULT NULL::integer, p_bet uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v public.ig_crash_v2_runtime%rowtype; seat public.ig_crash_v2_seats%rowtype;
 old public.ig_crash_v2_bets%rowtype; ts timestamptz; x numeric; paid bigint; rid uuid;
begin
 if not exists(select 1 from public.user_roles r join public.profiles p on p.id=r.user_id
  where r.user_id=p_actor and p.is_excluded=false and r.role::text in ('player','admin','superadmin'))
 then raise exception 'player access required' using errcode='42501'; end if;
 if p_action not in ('join','leave','bet','cashout','refill') then raise exception 'invalid action' using errcode='22023';end if;
 perform public.ig_crash_v2_tick();
 select * into v from public.ig_crash_v2_runtime where singleton=1 for update;
 ts:=clock_timestamp();
 if p_action='join' then
   insert into public.ig_crash_v2_seats(user_id) values(p_actor)
   on conflict(user_id) do update set joined=true,updated_at=ts;
   return jsonb_build_object('ok',true,'joined',true);
 end if;
 select * into seat from public.ig_crash_v2_seats where user_id=p_actor for update;
 if not found or not seat.joined then raise exception 'join table first' using errcode='42501';end if;
 if p_action='leave' then
  update public.ig_crash_v2_seats set joined=false,updated_at=ts where user_id=p_actor;
  return jsonb_build_object('ok',true,'joined',false);
 end if;
 if p_action='refill' then
   if seat.chips>=10 then raise exception 'refill available below 10 chips' using errcode='22023'; end if;
   update public.ig_crash_v2_seats set chips=1000,updated_at=ts where user_id=p_actor;
   return jsonb_build_object('ok',true,'refilled',true);
 end if;
 if p_request is null or p_round is null then raise exception 'request and round required' using errcode='22023';end if;
 if p_action='bet' then
  select * into old from public.ig_crash_v2_bets where request_id=p_request;
  if found then
   if old.user_id<>p_actor or old.round_no<>p_round or old.mode<>p_mode
      or old.target is distinct from p_target or old.units is distinct from p_units
   then raise exception 'idempotency collision' using errcode='23505';end if;
   return jsonb_build_object('ok',true,'betId',old.id,'replayed',true);
  end if;
  if p_round<>v.round_no or ts>=v.betting_ends_at or v.settled
   then raise exception 'betting closed or stale round' using errcode='22023';end if;
  if p_mode not in ('crash_manual','crash_auto','tren_red','tren_green','tren_yellow') or
    p_units not between 1 and 100 or seat.chips<p_units
   then raise exception 'invalid bet or insufficient chips' using errcode='22023';end if;
  if (p_mode='crash_auto' and p_target not in (1.5,2,3,5,10))
   or (p_mode<>'crash_auto' and p_target is not null) then
    raise exception 'invalid cashout selection' using errcode='22023';end if;
  update public.ig_crash_v2_seats set chips=chips-p_units,updated_at=ts where user_id=p_actor;
  insert into public.ig_crash_v2_bets(user_id,round_no,request_id,mode,target,units)
    values(p_actor,p_round,p_request,p_mode,p_target,p_units) returning id into rid;
  return jsonb_build_object('ok',true,'betId',rid,'replayed',false);
 end if;
 -- Manual cashout is strictly stamped by server clock, not client-reported multiplier.
 select * into old from public.ig_crash_v2_bets where cashout_request=p_request;
 if found then
  if old.user_id<>p_actor or old.id<>p_bet or old.round_no<>p_round then
    raise exception 'idempotency collision' using errcode='23505';end if;
  return jsonb_build_object('ok',true,'betId',old.id,'paidUnits',old.paid_units,'cashoutX',old.cashout_x,'replayed',true);
 end if;
 if p_round<>v.round_no or v.settled or ts<v.started_at or ts>=v.crashes_at
   then raise exception 'not live or round already crashed' using errcode='22023';end if;
 select * into old from public.ig_crash_v2_bets where id=p_bet and user_id=p_actor
   and round_no=p_round and mode='crash_manual' and status='active' for update;
 if not found then raise exception 'no active manual crash bet' using errcode='22023';end if;
 x:=least(12000,round((exp(ln(12001)*least(40000,greatest(0,extract(epoch from(ts-v.started_at))*1000))/40000)-1)::numeric,2));
 if x<=0 or x>v.crash_point then raise exception 'cannot cash out at this moment' using errcode='22023';end if;
 paid:=floor(old.units*x)::bigint;
 update public.ig_crash_v2_bets set status='won',paid_units=paid,cashout_x=x,cashout_request=p_request,
   settled_at=ts where id=old.id;
 update public.ig_crash_v2_seats set chips=chips+paid,updated_at=ts where user_id=p_actor;
 return jsonb_build_object('ok',true,'betId',old.id,'paidUnits',paid,'cashoutX',x,'replayed',false);
end $function$;


revoke all on function public.ig_crash_v2_fill_queue() from public,anon,authenticated;
revoke all on function public.ig_crash_v2_tick() from public,anon,authenticated;
revoke all on function public.ig_crash_v2_state(uuid) from public,anon,authenticated;
revoke all on function public.ig_crash_v2_action(uuid,text,bigint,uuid,text,numeric,integer,uuid) from public,anon,authenticated;
grant execute on function public.ig_crash_v2_fill_queue() to service_role;
grant execute on function public.ig_crash_v2_tick() to service_role;
grant execute on function public.ig_crash_v2_state(uuid) to service_role;
grant execute on function public.ig_crash_v2_action(uuid,text,bigint,uuid,text,numeric,integer,uuid) to service_role;
select cron.schedule('imperial-crash-v2-practice-clock','2 seconds','select public.ig_crash_v2_tick()');
