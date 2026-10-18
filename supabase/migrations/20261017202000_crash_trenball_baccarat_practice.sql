-- Crash/Trenball share ONE synchronized multiplier round; Baccarat has a communal banker hand.
-- Staging-only practice-chip engine: no wallet, payment, crypto, bonus or redeemable balances.
create table if not exists public.ig_event_tables (
  game text primary key check(game in ('crash','baccarat')),
  round_no bigint not null default 1 check(round_no>0),
  betting_closes_at timestamptz not null default (now()+interval '12 seconds'),
  controller uuid references auth.users(id) on delete set null,
  last_result jsonb,
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);
insert into public.ig_event_tables(game) values ('crash'),('baccarat') on conflict do nothing;
create table if not exists public.ig_event_seats (
  game text not null references public.ig_event_tables(game),
  user_id uuid not null references auth.users(id) on delete cascade,
  chips bigint not null default 1000 check(chips between 0 and 100000000),
  seated boolean not null default true,
  joined_at timestamptz not null default now(),
  seen_at timestamptz not null default now(),
  primary key(game,user_id)
);
create table if not exists public.ig_event_bets (
  id uuid primary key default gen_random_uuid(),
  game text not null references public.ig_event_tables(game),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  target text not null,
  units integer not null check(units between 1 and 100),
  placed_round bigint not null,
  status text not null default 'active' check(status in ('active','settled')),
  paid_units integer not null default 0 check(paid_units>=0),
  outcome text,
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  unique(game,user_id,request_id)
);
create index if not exists ig_event_bets_pending on public.ig_event_bets(game,status,placed_round);
create table if not exists public.ig_event_results (
  game text not null references public.ig_event_tables(game),
  request_id uuid not null,
  actor uuid not null references auth.users(id),
  round_no bigint not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key(game,request_id),
  unique(game,round_no)
);
do $$ declare name text;
begin
  foreach name in array array['ig_event_tables','ig_event_seats','ig_event_bets','ig_event_results'] loop
    execute format('alter table public.%I enable row level security',name);
    execute format('revoke all on public.%I from public,anon,authenticated',name);
    execute format('grant select,insert,update,delete on public.%I to service_role',name);
  end loop;
end $$;

create or replace function public.ig_event_action(
  p_actor uuid, p_game text, p_action text, p_request uuid default null,
  p_target text default null, p_units integer default null,
  p_expected_round bigint default null
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  room public.ig_event_tables%rowtype;
  seat public.ig_event_seats%rowtype;
  old_bet public.ig_event_bets%rowtype;
  old_result public.ig_event_results%rowtype;
  bet public.ig_event_bets%rowtype;
  role_name text;
  new_controller uuid;
  v_result jsonb;
  v_crash integer;
  v_random integer;
  shoe integer[];
  i integer; j integer; tmp integer; drawn integer;
  p_cards integer[] := '{}'; b_cards integer[] := '{}';
  p_total integer; b_total integer; player_third integer; card_value integer;
  winner text;
  paid integer; decimal_multiplier numeric;
  valid_target boolean; matched boolean;
begin
  if p_game not in ('crash','baccarat') or p_action not in ('join','leave','bet','resolve','claim') then
    raise exception 'invalid game action' using errcode='22023'; end if;
  select ur.role::text into role_name from public.user_roles ur
    join public.profiles pr on pr.id=ur.user_id
    where ur.user_id=p_actor and pr.is_excluded=false;
  if role_name not in ('player','admin','superadmin') or role_name is null then
    raise exception 'ineligible account' using errcode='42501'; end if;

  select * into strict room from public.ig_event_tables where game=p_game for update;
  if p_action='join' then
    update public.ig_event_seats set seated=false
      where game=p_game and seated and seen_at<now()-interval '10 minutes';
    if room.controller is not null and not exists(
      select 1 from public.ig_event_seats where game=p_game and user_id=room.controller and seated
    ) then
      room.controller:=null;
      update public.ig_event_tables set controller=null,revision=revision+1 where game=p_game;
    end if;
    if not exists(select 1 from public.ig_event_seats where game=p_game and user_id=p_actor and seated)
      and (select count(*) from public.ig_event_seats where game=p_game and seated)>=24 then
      raise exception 'room full' using errcode='22023'; end if;
    insert into public.ig_event_seats(game,user_id) values(p_game,p_actor)
      on conflict(game,user_id) do update set seated=true,seen_at=now();
    if room.controller is null then
      update public.ig_event_tables set controller=p_actor,betting_closes_at=now()+interval '12 seconds',
        revision=revision+1,updated_at=now() where game=p_game;
    end if;
    return jsonb_build_object('ok',true,'joined',true);
  end if;
  select * into seat from public.ig_event_seats where game=p_game and user_id=p_actor for update;
  if not found or not seat.seated then raise exception 'join before acting' using errcode='42501'; end if;
  if p_action='leave' then
    update public.ig_event_seats set seated=false where game=p_game and user_id=p_actor;
    if room.controller=p_actor then
      select user_id into new_controller from public.ig_event_seats where game=p_game and seated
        and seen_at>now()-interval '60 seconds' order by joined_at,user_id limit 1;
      update public.ig_event_tables set controller=new_controller,revision=revision+1,
        betting_closes_at=now()+interval '12 seconds',updated_at=now() where game=p_game;
    else
      update public.ig_event_tables set revision=revision+1,updated_at=now() where game=p_game;
    end if;
    return jsonb_build_object('ok',true,'joined',false);
  end if;
  update public.ig_event_seats set seen_at=now() where game=p_game and user_id=p_actor;
  if p_action='claim' then
    if room.controller is not null and room.controller<>p_actor
      and exists(select 1 from public.ig_event_seats where game=p_game and user_id=room.controller
        and seated and seen_at>now()-interval '60 seconds') then
      raise exception 'controller still active' using errcode='42501'; end if;
    update public.ig_event_tables set controller=p_actor,revision=revision+1,updated_at=now()
      where game=p_game;
    return jsonb_build_object('ok',true,'controller',p_actor);
  end if;
  if p_action='bet' then
    if p_request is null or p_target is null or p_units is null or p_units<1 or p_units>100
      then raise exception 'invalid stake' using errcode='22023'; end if;
    select * into old_bet from public.ig_event_bets where game=p_game and user_id=p_actor and request_id=p_request;
    if found then
      if old_bet.target<>p_target or old_bet.units<>p_units then raise exception 'replayed request changed' using errcode='23505'; end if;
      return jsonb_build_object('ok',true,'replayed',true,'betId',old_bet.id);
    end if;
    if now()>=room.betting_closes_at then raise exception 'betting closed' using errcode='22023'; end if;
    if p_game='crash' then
      valid_target := p_target in ('auto_150','auto_200','auto_300','auto_500','auto_1000',
        'tren_red','tren_green','tren_moon');
    else valid_target := p_target in ('player','banker','tie'); end if;
    if not valid_target or seat.chips<p_units then raise exception 'invalid bet or insufficient practice chips' using errcode='22023'; end if;
    update public.ig_event_seats set chips=chips-p_units where game=p_game and user_id=p_actor;
    insert into public.ig_event_bets(game,user_id,request_id,target,units,placed_round)
      values(p_game,p_actor,p_request,p_target,p_units,room.round_no) returning * into bet;
    update public.ig_event_tables set revision=revision+1,updated_at=now() where game=p_game;
    return jsonb_build_object('ok',true,'betId',bet.id,'replayed',false);
  end if;
  if p_action<>'resolve' or p_request is null or p_expected_round is null
    then raise exception 'invalid resolve request' using errcode='22023'; end if;
  select * into old_result from public.ig_event_results where game=p_game and request_id=p_request;
  if found then
    if old_result.actor<>p_actor then raise exception 'request replay actor changed' using errcode='42501'; end if;
    return jsonb_build_object('ok',true,'replayed',true,'result',old_result.result);
  end if;
  if p_expected_round<>room.round_no then raise exception 'stale round' using errcode='23505'; end if;
  if room.controller is distinct from p_actor then raise exception 'not controller' using errcode='42501'; end if;
  if now()<room.betting_closes_at then raise exception 'betting still open' using errcode='22023'; end if;

  if p_game='crash' then
    -- 1% mathematical edge for a fixed auto-cashout threshold.
    -- 1.00x instant-crash floor; 100x demonstration cap.
    v_random:=public.ig_mp_random(10000);
    v_crash:=greatest(100,least(10000,floor(990000.0/(10000-v_random))::integer));
    v_result:=jsonb_build_object('game','crash','round',room.round_no,
      'crashX100',v_crash,'multiplier',v_crash/100.0,
      'visualMode','shared_crash_and_trenball','practiceOnly',true);
  else
    -- 8 decks, up to six cards, sampled without replacement by partial Fisher-Yates.
    select array_agg(((n-1)%13)+1 order by n) into shoe from generate_series(1,416) n;
    for i in 1..6 loop
      j:=i+public.ig_mp_random(417-i);
      tmp:=shoe[i];shoe[i]:=shoe[j];shoe[j]:=tmp;
    end loop;
    p_cards:=array[shoe[1],shoe[3]];
    b_cards:=array[shoe[2],shoe[4]];
    p_total:=(((case when shoe[1]>=10 then 0 else shoe[1] end)+
               (case when shoe[3]>=10 then 0 else shoe[3] end))%10);
    b_total:=(((case when shoe[2]>=10 then 0 else shoe[2] end)+
               (case when shoe[4]>=10 then 0 else shoe[4] end))%10);
    player_third:=null;
    if p_total<8 and b_total<8 then
      if p_total<=5 then
        p_cards:=array_append(p_cards,shoe[5]);
        player_third:=case when shoe[5]>=10 then 0 else shoe[5] end;
        p_total:=(p_total+player_third)%10;
      end if;
      if (player_third is null and b_total<=5)
        or (player_third is not null and
           (b_total<=2 or (b_total=3 and player_third<>8)
             or (b_total=4 and player_third between 2 and 7)
             or (b_total=5 and player_third between 4 and 7)
             or (b_total=6 and player_third between 6 and 7))) then
        drawn:=case when player_third is null then 5 else 6 end;
        b_cards:=array_append(b_cards,shoe[drawn]);
        card_value:=case when shoe[drawn]>=10 then 0 else shoe[drawn] end;
        b_total:=(b_total+card_value)%10;
      end if;
    end if;
    winner:=case when p_total>b_total then 'player' when p_total<b_total then 'banker' else 'tie' end;
    v_result:=jsonb_build_object('game','baccarat','round',room.round_no,
      'playerCards',to_jsonb(p_cards),'bankerCards',to_jsonb(b_cards),
      'playerTotal',p_total,'bankerTotal',b_total,'winner',winner,'practiceOnly',true);
  end if;
  for bet in select * from public.ig_event_bets where game=p_game and status='active'
    and placed_round=room.round_no order by created_at,id for update
  loop
    paid:=0;matched:=false;decimal_multiplier:=0;
    if p_game='crash' then
      if bet.target like 'auto_%' then
        decimal_multiplier:=(substring(bet.target from 6)::integer)/100.0;
        matched:=v_crash >= (substring(bet.target from 6)::integer);
      elsif bet.target='tren_red' then
        decimal_multiplier:=1.96;matched:=v_crash<200;
      elsif bet.target='tren_green' then
        decimal_multiplier:=2;matched:=v_crash>=200;
      elsif bet.target='tren_moon' then
        decimal_multiplier:=10;matched:=v_crash>=1000;
      end if;
    else
      if bet.target=winner then
        decimal_multiplier:=case when winner='player' then 2 when winner='banker' then 1.95 else 9 end;
        matched:=true;
      elsif winner='tie' and bet.target in ('player','banker') then
        decimal_multiplier:=1;matched:=true;
      end if;
    end if;
    if matched then paid:=floor(bet.units*decimal_multiplier)::integer;end if;
    update public.ig_event_bets set status='settled',paid_units=paid,
      outcome=case when paid=0 then 'lose' when paid=units then 'push' else 'win' end,
      settled_at=now() where id=bet.id;
    if paid>0 then
      update public.ig_event_seats set chips=chips+paid where game=p_game and user_id=bet.user_id;
    end if;
  end loop;
  update public.ig_event_tables set round_no=round_no+1,betting_closes_at=now()+interval '12 seconds',
    revision=revision+1,updated_at=now(),last_result=v_result where game=p_game;
  insert into public.ig_event_results(game,request_id,actor,round_no,result)
    values(p_game,p_request,p_actor,room.round_no,v_result);
  return jsonb_build_object('ok',true,'result',v_result,'replayed',false);
end $$;
revoke all on function public.ig_event_action(uuid,text,text,uuid,text,integer,bigint) from public,anon,authenticated;
grant execute on function public.ig_event_action(uuid,text,text,uuid,text,integer,bigint) to service_role;

create or replace function public.ig_event_state(p_actor uuid,p_game text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare t public.ig_event_tables%rowtype; own bigint; seated_players jsonb; all_bets jsonb; mine jsonb; recent jsonb;
begin
  if p_game not in ('crash','baccarat') or not exists(
    select 1 from public.profiles pr join public.user_roles ur on ur.user_id=pr.id
    where pr.id=p_actor and pr.is_excluded=false
      and ur.role::text in ('player','admin','superadmin','tester')) then
    raise exception 'not authorized' using errcode='42501'; end if;
  select * into strict t from public.ig_event_tables where game=p_game;
  select chips into own from public.ig_event_seats where game=p_game and user_id=p_actor and seated;
  select coalesce(jsonb_agg(jsonb_build_object('id',user_id,'seat','Player '||upper(substr(replace(user_id::text,'-',''),1,6)),
    'shooter',user_id=t.controller,'active',seen_at>now()-interval '60 seconds') order by joined_at),'[]'::jsonb)
    into seated_players from public.ig_event_seats where game=p_game and seated;
  select coalesce(jsonb_agg(jsonb_build_object('target',target,'units',total,'count',bet_count)),'[]'::jsonb)
    into all_bets from (select target,sum(units) as total,count(*) as bet_count from public.ig_event_bets
      where game=p_game and status='active' and placed_round=t.round_no group by target) s;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'target',target,'units',units,'placedRound',placed_round) order by created_at),'[]'::jsonb)
    into mine from public.ig_event_bets where game=p_game and user_id=p_actor and status='active';
  select coalesce(jsonb_agg(jsonb_build_object('target',target,'units',units,'paid',paid_units,'outcome',outcome,'settledAt',settled_at)
    order by settled_at desc),'[]'::jsonb)
    into recent from (select * from public.ig_event_bets where game=p_game and user_id=p_actor
      and status='settled' order by settled_at desc limit 8) s;
  return jsonb_build_object('game',p_game,'round',t.round_no,'revision',t.revision,
    'shooterId',t.controller,'lastResult',t.last_result,
    'bettingClosesAt',t.betting_closes_at,'serverTime',now(),'betsOpen',now()<t.betting_closes_at,
    'players',seated_players,'publicBets',all_bets,'myBets',mine,'myRecent',recent,
    'joined',own is not null,'chips',coalesce(own,0),'practiceOnly',true,'realMoneyEnabled',false);
end $$;
revoke all on function public.ig_event_state(uuid,text) from public,anon,authenticated;
grant execute on function public.ig_event_state(uuid,text) to service_role;
comment on table public.ig_event_bets is 'Nonredeemable practice chips, no financial wagering. Crash and Trenball share a result.';
