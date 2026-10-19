-- Imperial Games: staging-only multiplayer casino table simulation.
-- Practice chips have no monetary value, purchase path, redemption or linkage to wallets.
-- All commands are performed by a verified Edge Function via service_role RPC.
create table if not exists public.ig_mp_tables (
  game text primary key check (game in ('craps','roulette')),
  round_no bigint not null default 1 check (round_no > 0),
  point smallint check (point in (4,5,6,8,9,10)),
  shooter_id uuid references auth.users(id) on delete set null,
  revision bigint not null default 1,
  last_result jsonb,
  updated_at timestamptz not null default now()
);
insert into public.ig_mp_tables(game) values ('craps'),('roulette') on conflict do nothing;

create table if not exists public.ig_mp_players (
  game text not null references public.ig_mp_tables(game) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  chips integer not null default 1000 check (chips between 0 and 1000000),
  joined_at timestamptz not null default now(),
  seen_at timestamptz not null default now(),
  primary key (game,user_id)
);
create index if not exists ig_mp_players_joined on public.ig_mp_players(game,joined_at);

create table if not exists public.ig_mp_bets (
  id uuid primary key default gen_random_uuid(),
  game text not null references public.ig_mp_tables(game) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  target text not null,
  units integer not null check (units between 1 and 100),
  placed_round bigint not null,
  status text not null default 'active' check (status in ('active','settled')),
  paid_units integer not null default 0 check (paid_units>=0),
  outcome text,
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  unique(game,user_id,request_id)
);
create index if not exists ig_mp_bets_open on public.ig_mp_bets(game,status,placed_round);

create table if not exists public.ig_mp_events (
  game text not null references public.ig_mp_tables(game),
  request_id uuid not null,
  actor uuid not null references auth.users(id),
  round_no bigint not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key(game,request_id),
  unique(game,round_no)
);
create index if not exists ig_mp_events_recent on public.ig_mp_events(game,round_no desc);

alter table public.ig_mp_tables enable row level security;
alter table public.ig_mp_players enable row level security;
alter table public.ig_mp_bets enable row level security;
alter table public.ig_mp_events enable row level security;
revoke all on public.ig_mp_tables,public.ig_mp_players,public.ig_mp_bets,public.ig_mp_events from public,anon,authenticated;
grant select,insert,update,delete on public.ig_mp_tables,public.ig_mp_players,public.ig_mp_bets,public.ig_mp_events to service_role;

create or replace function public.ig_mp_random(p_sides integer) returns integer
language plpgsql volatile set search_path = '' as $$
declare b bytea; n bigint; max_accepted bigint;
begin
  if p_sides < 2 or p_sides > 100 then raise exception 'invalid sides' using errcode='22023'; end if;
  max_accepted := (4294967296::bigint/p_sides)*p_sides;
  loop
    b := extensions.gen_random_bytes(4);
    n := (get_byte(b,0)::bigint << 24) + (get_byte(b,1)::bigint << 16)
       + (get_byte(b,2)::bigint << 8) + get_byte(b,3)::bigint;
    if n < max_accepted then return (n % p_sides)::integer; end if;
  end loop;
end $$;
revoke all on function public.ig_mp_random(integer) from public,anon,authenticated;
grant execute on function public.ig_mp_random(integer) to service_role;

create or replace function public.ig_mp_action(
  p_actor uuid, p_game text, p_action text, p_request uuid default null,
  p_target text default null, p_units integer default null,
  p_expected_round bigint default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  t public.ig_mp_tables%rowtype;
  seat public.ig_mp_players%rowtype;
  bet public.ig_mp_bets%rowtype;
  past public.ig_mp_bets%rowtype;
  old_event public.ig_mp_events%rowtype;
  d1 integer; d2 integer; landed integer; total integer;
  point_before integer; point_after integer; payout integer; n integer;
  new_shooter uuid; qualifies boolean; win boolean; multiplier integer;
  rolled jsonb; current_role text; stake text;
  reds integer[] := array[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
begin
  if p_game not in ('craps','roulette') or p_action not in ('join','bet','roll','spin','claim') then
    raise exception 'invalid action' using errcode='22023';
  end if;
  select ur.role::text into current_role
    from public.user_roles ur join public.profiles pr on pr.id=ur.user_id
   where ur.user_id=p_actor and pr.is_excluded=false;
  if current_role is null or current_role not in ('player','admin','superadmin') then
    raise exception 'account not eligible' using errcode='42501';
  end if;
  -- Game actions, chips and order of play share one database row lock.
  select * into strict t from public.ig_mp_tables where game=p_game for update;
  if p_action='join' then
    if not exists(select 1 from public.ig_mp_players where game=p_game and user_id=p_actor)
       and (select count(*) from public.ig_mp_players where game=p_game)>=24 then
      raise exception 'table full' using errcode='22023';
    end if;
    insert into public.ig_mp_players(game,user_id) values(p_game,p_actor)
      on conflict(game,user_id) do update set seen_at=now();
    if t.shooter_id is null then
      update public.ig_mp_tables set shooter_id=p_actor,revision=revision+1,updated_at=now() where game=p_game;
    end if;
    return jsonb_build_object('ok',true,'joined',true);
  end if;
  select * into seat from public.ig_mp_players where game=p_game and user_id=p_actor for update;
  if not found then raise exception 'join table first' using errcode='42501'; end if;
  update public.ig_mp_players set seen_at=now() where game=p_game and user_id=p_actor;
  if p_action='claim' then
    if t.shooter_id is not null and t.shooter_id<>p_actor
       and exists(select 1 from public.ig_mp_players where game=p_game and user_id=t.shooter_id
                 and seen_at > now()-interval '60 seconds') then
      raise exception 'current shooter still active' using errcode='42501';
    end if;
    update public.ig_mp_tables set shooter_id=p_actor,revision=revision+1,updated_at=now() where game=p_game;
    return jsonb_build_object('ok',true,'shooter',p_actor);
  end if;
  if p_action='bet' then
    if p_request is null or p_target is null or p_units is null or p_units<1 or p_units>100 then
      raise exception 'invalid practice bet' using errcode='22023';
    end if;
    select * into past from public.ig_mp_bets where game=p_game and user_id=p_actor and request_id=p_request;
    if found then
      if past.target<>p_target or past.units<>p_units then
        raise exception 'request replay mismatch' using errcode='23505';
      end if;
      return jsonb_build_object('ok',true,'betId',past.id,'replayed',true);
    end if;
    if p_game='craps' then
      qualifies := p_target in ('pass','dont_pass','field','any_seven','place_4','place_5','place_6','place_8','place_9','place_10');
      if p_target in ('pass','dont_pass') and t.point is not null then qualifies:=false; end if;
    else
      qualifies := p_target in ('red','black','odd','even','low','high','dozen_1','dozen_2','dozen_3','column_1','column_2','column_3')
        or (p_target ~ '^number_([0-9]|[1-2][0-9]|3[0-6])$');
    end if;
    if not qualifies or seat.chips < p_units then raise exception 'invalid target or insufficient practice chips' using errcode='22023'; end if;
    update public.ig_mp_players set chips=chips-p_units where game=p_game and user_id=p_actor;
    insert into public.ig_mp_bets(game,user_id,request_id,target,units,placed_round)
       values (p_game,p_actor,p_request,p_target,p_units,t.round_no) returning * into bet;
    update public.ig_mp_tables set revision=revision+1,updated_at=now() where game=p_game;
    return jsonb_build_object('ok',true,'betId',bet.id,'replayed',false);
  end if;
  if p_action not in ('roll','spin') or (p_game='craps' and p_action<>'roll') or
       (p_game='roulette' and p_action<>'spin') or p_request is null or p_expected_round is null then
    raise exception 'invalid round action' using errcode='22023';
  end if;
  select * into old_event from public.ig_mp_events where game=p_game and request_id=p_request;
  if found then
    if old_event.actor<>p_actor then raise exception 'request replay mismatch' using errcode='42501'; end if;
    return jsonb_build_object('ok',true,'replayed',true,'result',old_event.result);
  end if;
  if t.round_no<>p_expected_round then raise exception 'stale round; refresh table' using errcode='23505'; end if;
  if t.shooter_id is distinct from p_actor then raise exception 'only current shooter/dealer may act' using errcode='42501'; end if;
  point_before := t.point;
  point_after := t.point;
  if p_game='craps' then
    d1:=public.ig_mp_random(6)+1; d2:=public.ig_mp_random(6)+1; total:=d1+d2;
    if point_before is null then
      if total in (4,5,6,8,9,10) then point_after:=total; end if;
    elsif total=point_before or total=7 then point_after:=null;
    end if;
    rolled:=jsonb_build_object('game','craps','round',t.round_no,'dice',jsonb_build_array(d1,d2),
       'total',total,'pointBefore',point_before,'pointAfter',point_after,'shooter',p_actor);
  else
    landed:=public.ig_mp_random(37);
    rolled:=jsonb_build_object('game','roulette','round',t.round_no,'number',landed,
       'color',case when landed=0 then 'green' when landed=any(reds) then 'red' else 'black' end,
       'shooter',p_actor);
  end if;
  -- Every active practice bet is settled here, atomically with the result.
  for bet in select * from public.ig_mp_bets where game=p_game and status='active'
                and (p_game='craps' or placed_round=t.round_no) order by created_at,id for update
  loop
    payout:=null;
    if p_game='craps' then
      if bet.target='field' then
        payout:=case when total in (2,12) then bet.units*3
                     when total in (3,4,9,10,11) then bet.units*2 else 0 end;
      elsif bet.target='any_seven' then payout:=case when total=7 then bet.units*5 else 0 end;
      elsif bet.target='pass' then
        if point_before is null then
          if total in (7,11) then payout:=bet.units*2;
          elsif total in (2,3,12) then payout:=0; end if;
        elsif total=point_before then payout:=bet.units*2;
        elsif total=7 then payout:=0; end if;
      elsif bet.target='dont_pass' then
        if point_before is null then
          if total in (7,11) then payout:=0;
          elsif total in (2,3) then payout:=bet.units*2;
          elsif total=12 then payout:=bet.units; end if;
        elsif total=point_before then payout:=0;
        elsif total=7 then payout:=bet.units*2; end if;
      elsif bet.target like 'place_%' and point_before is not null then
        n:=substring(bet.target from 7)::integer;
        if total=7 then payout:=0;
        elsif total=n then
          payout:=case when n in (4,10) then bet.units+floor(bet.units*9.0/5.0)::integer
                       when n in (5,9) then bet.units+floor(bet.units*7.0/5.0)::integer
                       else bet.units+floor(bet.units*7.0/6.0)::integer end;
        end if;
      end if;
    else
      win:=false; multiplier:=1;
      if bet.target like 'number_%' then
        n:=substring(bet.target from 8)::integer; win:=(landed=n); multiplier:=35;
      elsif bet.target='red' then win:=(landed<>0 and landed=any(reds));
      elsif bet.target='black' then win:=(landed<>0 and not landed=any(reds));
      elsif bet.target='odd' then win:=(landed<>0 and landed%2=1);
      elsif bet.target='even' then win:=(landed<>0 and landed%2=0);
      elsif bet.target='low' then win:=(landed>=1 and landed<=18);
      elsif bet.target='high' then win:=(landed>=19 and landed<=36);
      elsif bet.target like 'dozen_%' then
        n:=substring(bet.target from 7)::integer;
        win:=(landed between ((n-1)*12+1) and (n*12)); multiplier:=2;
      elsif bet.target like 'column_%' then
        n:=substring(bet.target from 8)::integer;
        win:=(landed<>0 and (landed-1)%3+1=n); multiplier:=2;
      end if;
      payout:=case when win then bet.units*(multiplier+1) else 0 end;
    end if;
    if payout is not null then
      update public.ig_mp_bets set status='settled',paid_units=payout,
        outcome=case when payout=0 then 'lose' when payout=bet.units then 'push' else 'win' end,
        settled_at=now() where id=bet.id;
      if payout>0 then
        update public.ig_mp_players set chips=chips+payout where game=p_game and user_id=bet.user_id;
      end if;
    end if;
  end loop;
  new_shooter:=t.shooter_id;
  if p_game='craps' and point_before is not null and total=7 then
    select user_id into new_shooter from public.ig_mp_players where game=p_game
      and user_id<>p_actor order by joined_at limit 1;
    new_shooter:=coalesce(new_shooter,p_actor);
  end if;
  update public.ig_mp_tables set round_no=round_no+1,point=point_after,
      shooter_id=new_shooter,last_result=rolled,revision=revision+1,updated_at=now()
      where game=p_game;
  insert into public.ig_mp_events(game,request_id,actor,round_no,result)
    values(p_game,p_request,p_actor,t.round_no,rolled);
  return jsonb_build_object('ok',true,'replayed',false,'result',rolled);
end $$;
revoke all on function public.ig_mp_action(uuid,text,text,uuid,text,integer,bigint) from public,anon,authenticated;
grant execute on function public.ig_mp_action(uuid,text,text,uuid,text,integer,bigint) to service_role;

create or replace function public.ig_mp_state(p_actor uuid,p_game text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare room public.ig_mp_tables%rowtype; mychips integer; people jsonb; betview jsonb; mybets jsonb; recent jsonb;
begin
  if p_game not in ('craps','roulette') or not exists(
      select 1 from public.profiles pr join public.user_roles ur on ur.user_id=pr.id
      where pr.id=p_actor and pr.is_excluded=false and ur.role::text in ('player','tester','admin','superadmin'))
    then raise exception 'not authorized' using errcode='42501'; end if;
  select * into strict room from public.ig_mp_tables where game=p_game;
  select chips into mychips from public.ig_mp_players where game=p_game and user_id=p_actor;
  select coalesce(jsonb_agg(jsonb_build_object('id',user_id,'seat','Player '||upper(substr(replace(user_id::text,'-',''),1,6)),
      'shooter',user_id=room.shooter_id,'active',seen_at>now()-interval '60 seconds') order by joined_at),'[]'::jsonb)
    into people from public.ig_mp_players where game=p_game;
  select coalesce(jsonb_agg(jsonb_build_object('target',target,'units',total,'count',bet_count)),'[]'::jsonb)
  into betview from (select target,sum(units)::integer as total,count(*) as bet_count
      from public.ig_mp_bets where game=p_game and status='active' group by target) s;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'target',target,'units',units,'placedRound',placed_round)
      order by created_at),'[]'::jsonb)
    into mybets from public.ig_mp_bets where game=p_game and user_id=p_actor and status='active';
  select coalesce(jsonb_agg(jsonb_build_object('target',target,'units',units,'paid',paid_units,'outcome',outcome,'settledAt',settled_at)
     order by settled_at desc),'[]'::jsonb)
    into recent from (select * from public.ig_mp_bets where game=p_game and user_id=p_actor
      and status='settled' order by settled_at desc limit 8) s;
  return jsonb_build_object(
    'game',p_game,'round',room.round_no,'point',room.point,'revision',room.revision,
    'shooterId',room.shooter_id,'lastResult',room.last_result,'players',people,
    'publicBets',betview,'myBets',mybets,'myRecent',recent,
    'joined',mychips is not null,'chips',coalesce(mychips,0),'practiceOnly',true,'realMoneyEnabled',false
  );
end $$;
revoke all on function public.ig_mp_state(uuid,text) from public,anon,authenticated;
grant execute on function public.ig_mp_state(uuid,text) to service_role;

comment on table public.ig_mp_players is 'Practice chips are fictitious, cannot be purchased, redeemed, gifted, withdrawn or linked to any wallet. Staging multiplayer only.';
comment on table public.ig_mp_bets is 'Practice-only casino table selections, no financial wagering or credit ledgers.';


