-- Independent, versioned, game/round-bound commitments. Secrets never enter client tables.
create schema if not exists internal;
create table internal.table_fair_rounds (
 game text not null check(game in ('blackjack','baccarat','craps','roulette')),
 round_no bigint not null check(round_no>0),
 server_seed text not null check(server_seed ~ '^[a-f0-9]{64}$'),
 seed_hash text not null check(seed_hash ~ '^[a-f0-9]{64}$'),
 layout jsonb, outcome jsonb, created_at timestamptz not null default clock_timestamp(),
 primary key(game,round_no)
);
alter table internal.table_fair_rounds enable row level security;
revoke all on internal.table_fair_rounds from public,anon,authenticated,service_role;

create function internal.table_fair_ensure(g text,r bigint) returns void
language plpgsql security definer set search_path='' as $$
declare seed text;
begin
 if not exists(select 1 from internal.table_fair_rounds where game=g and round_no=r) then
  seed:=encode(extensions.gen_random_bytes(32),'hex');
  insert into internal.table_fair_rounds(game,round_no,server_seed,seed_hash)
   values(g,r,seed,encode(extensions.digest('table-fair-v1|'||g||'|'||r::text||'|'||seed,'sha256'),'hex'))
   on conflict do nothing;
 end if;
end $$;

create function internal.table_fair_sample(g text,r bigint,step integer,bound integer) returns integer
language plpgsql stable security definer set search_path='' as $$
declare seed text; mac bytea; n bigint; attempt integer;
begin
 if bound<2 or bound>1000000 or step<0 then raise exception 'Invalid proof sample';end if;
 select server_seed into strict seed from internal.table_fair_rounds where game=g and round_no=r;
 for attempt in 0..63 loop
  mac:=extensions.hmac('table-fair-v1|'||g||'|'||r::text||'|'||step::text||'|'||attempt::text,seed,'sha256');
  n:=get_byte(mac,0)::bigint*16777216+get_byte(mac,1)::bigint*65536+get_byte(mac,2)::bigint*256+get_byte(mac,3)::bigint;
  if n<(4294967296::bigint/bound)*bound then return (n%bound)::integer;end if;
 end loop;
 raise exception 'Proof sampling failed';
end $$;

create function internal.table_fair_immutable() returns trigger
language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'Fairness records are append-only';end if;
 if (new.game,new.round_no,new.server_seed,new.seed_hash,new.created_at) is distinct from
    (old.game,old.round_no,old.server_seed,old.seed_hash,old.created_at)
    or (old.layout is not null and new.layout is distinct from old.layout)
    or (old.outcome is not null and new.outcome is distinct from old.outcome)
 then raise exception 'Committed fairness record cannot change';end if;
 return new;
end $$;
create trigger table_fair_immutable before update or delete on internal.table_fair_rounds
 for each row execute function internal.table_fair_immutable();

create function internal.table_fair_capture() returns trigger
language plpgsql security definer set search_path='' as $$
declare g text; plan jsonb;
begin
 g:='blackjack';
 if g not in ('blackjack','baccarat','craps','roulette') then return new;end if;
 if cardinality(old.deck)>0 and cardinality(new.deck)>0 and old.deck is distinct from new.deck then
  raise exception 'The active Blackjack shoe is locked';
 end if;
 if tg_op='UPDATE' and new.round_no<>old.round_no then
  if new.round_no<>old.round_no+1 or (new.last_result->>'round')::bigint is distinct from old.round_no then
   raise exception 'Invalid fairness round transition';end if;
  update internal.table_fair_rounds set outcome=new.last_result where game=g and round_no=old.round_no and outcome is null;
 end if;
 -- A hand already in flight at migration time is legacy; do not invent its proof.
 if g<>'blackjack' or new.phase='betting' then perform internal.table_fair_ensure(g,new.round_no);end if;
 if g='blackjack' and tg_op='UPDATE' and cardinality(old.deck)=0 and cardinality(new.deck)>0 then
  select jsonb_agg(jsonb_build_object('seat',seat_no,'mainBet',main_bet,'pairsBet',pairs_bet) order by seat_no)
   into plan from public.ig_bj_seats where seated and main_bet>0;
  update internal.table_fair_rounds set layout=plan where game=g and round_no=new.round_no and layout is null;
 end if;
 return new;
end $$;
-- Separate functions avoid referencing a nonexistent record field on another table type.
create function internal.table_fair_capture_shared() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.game not in ('baccarat','craps','roulette') then return new;end if;
 if tg_op='UPDATE' and new.round_no<>old.round_no then
  if new.round_no<>old.round_no+1 or (new.last_result->>'round')::bigint is distinct from old.round_no then
   raise exception 'Invalid fairness round transition';end if;
  update internal.table_fair_rounds set outcome=new.last_result where game=new.game and round_no=old.round_no and outcome is null;
 end if;
 if new.game='roulette' then
  if new.round_no=old.round_no and old.pending_result is not null
    and not exists(select 1 from internal.table_fair_rounds where game='roulette' and round_no=new.round_no) then return new;end if;
 end if;
 perform internal.table_fair_ensure(new.game,new.round_no);
 return new;
end $$;
create trigger blackjack_fair_round before update on public.ig_bj_table for each row execute function internal.table_fair_capture();
create trigger baccarat_fair_round before update on public.ig_event_tables for each row execute function internal.table_fair_capture_shared();
create trigger multiplayer_fair_round before update on public.ig_mp_tables for each row execute function internal.table_fair_capture_shared();

create function internal.table_fair_public(g text,r bigint) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('game',game,'round',round_no,'algorithm','hmac-sha256-table-v1',
   'serverSeedHash',seed_hash,'phase',case when outcome is null then 'committed' else 'revealed' end,'practiceOnly',true)
   ||case when layout is null then '{}'::jsonb else jsonb_build_object('layout',layout) end
   ||case when outcome is null then '{}'::jsonb else jsonb_build_object('serverSeed',server_seed,'outcome',outcome) end
 from internal.table_fair_rounds where game=g and round_no=r
$$;
create function internal.table_fair_history(g text) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(internal.table_fair_public(g,round_no) order by round_no desc),'[]'::jsonb)
 from (select round_no from internal.table_fair_rounds where game=g and outcome is not null order by round_no desc limit 12) h
$$;
revoke all on function internal.table_fair_ensure(text,bigint),internal.table_fair_sample(text,bigint,integer,integer),
 internal.table_fair_immutable(),internal.table_fair_capture(),internal.table_fair_capture_shared(),
 internal.table_fair_public(text,bigint),internal.table_fair_history(text) from public,anon,authenticated,service_role;

-- Backfill only unfinished outcomes whose random draws have not happened yet.
select internal.table_fair_ensure('blackjack',round_no) from public.ig_bj_table where phase='betting';
select internal.table_fair_ensure('baccarat',round_no) from public.ig_event_tables where game='baccarat';
select internal.table_fair_ensure(game,round_no) from public.ig_mp_tables where game='craps' or (game='roulette' and pending_result is null);


-- Preserve all existing authorization, row locks, retries, deadlines and settlement rules.

CREATE OR REPLACE FUNCTION public.ig_bj_action(p_actor uuid, p_action text, p_request uuid DEFAULT NULL::uuid, p_units integer DEFAULT NULL::integer, p_target text DEFAULT NULL::text, p_expected_round bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 t public.ig_bj_table%rowtype; me public.ig_bj_seats%rowtype; player public.ig_bj_seats%rowtype;
 old public.ig_bj_receipts%rowtype;
 role_name text; vacant integer; new_controller uuid;
 shoe integer[];i integer;j integer; tmp integer;drawn integer;index_next integer;
 result jsonb; seat_results jsonb:='[]'::jsonb;
 dealer_score integer; player_score integer; main_return integer; pair_return integer;
 first_card integer;second_card integer;suit1 integer;suit2 integer;
 is_blackjack boolean;dealer_blackjack boolean;final_status text;
 v_cards integer[];next_turn uuid; v_status text;
begin
 if p_action not in ('join','leave','bet','deal','hit','stand','resolve','claim') then raise exception 'invalid action' using errcode='22023';end if;
 select ur.role::text into role_name from public.user_roles ur join public.profiles pr on pr.id=ur.user_id
   where ur.user_id=p_actor and pr.is_excluded=false;
 if role_name not in ('player','admin','superadmin') or role_name is null then
   raise exception 'ineligible account' using errcode='42501';end if;
 select * into strict t from public.ig_bj_table where id='blackjack' for update;
 if p_action='join' then
   update public.ig_bj_seats set seated=false where seated and main_bet=0 and pairs_bet=0
     and seen_at<now()-interval '10 minutes';
   if not exists(select 1 from public.ig_bj_seats where user_id=p_actor and seated) then
     select n into vacant from generate_series(0,6) n where not exists(
       select 1 from public.ig_bj_seats s where s.seat_no=n and s.seated) order by n limit 1;
     if vacant is null then raise exception 'table full' using errcode='22023';end if;
     insert into public.ig_bj_seats(user_id,seat_no) values(p_actor,vacant)
       on conflict(user_id) do update set seated=true,seat_no=excluded.seat_no,seen_at=now();
   else
     update public.ig_bj_seats set seen_at=now() where user_id=p_actor;
   end if;
   if t.controller is null or not exists(select 1 from public.ig_bj_seats where user_id=t.controller and seated) then
     update public.ig_bj_table set controller=p_actor,revision=revision+1,
       betting_closes_at=case when phase='betting' then now()+interval '12 seconds' else betting_closes_at end,
       updated_at=now() where id='blackjack';
   end if;
   return jsonb_build_object('ok',true,'joined',true);
 end if;
 select * into me from public.ig_bj_seats where user_id=p_actor for update;
 if not found or not me.seated then raise exception 'seat required' using errcode='42501';end if;
 update public.ig_bj_seats set seen_at=now() where user_id=p_actor;
 if p_action='leave' then
   if t.phase<>'betting' or me.main_bet>0 or me.pairs_bet>0 then
     raise exception 'cannot leave during active hand or pending bets' using errcode='22023';end if;
   update public.ig_bj_seats set seated=false where user_id=p_actor;
   if t.controller=p_actor then
     select user_id into new_controller from public.ig_bj_seats where seated order by seat_no limit 1;
     update public.ig_bj_table set controller=new_controller,revision=revision+1,
       betting_closes_at=now()+interval '12 seconds',updated_at=now() where id='blackjack';
   else update public.ig_bj_table set revision=revision+1 where id='blackjack';end if;
   return jsonb_build_object('ok',true,'joined',false);
 end if;
 if p_action='claim' then
   if t.controller is not null and t.controller<>p_actor and exists(
     select 1 from public.ig_bj_seats where user_id=t.controller and seated
       and seen_at>now()-interval '60 seconds') then
     raise exception 'controller still active' using errcode='42501';end if;
   update public.ig_bj_table set controller=p_actor,revision=revision+1,updated_at=now() where id='blackjack';
   return jsonb_build_object('ok',true);
 end if;
 if p_action='bet' then
   if p_request is null or p_units not between 1 and 100 or p_target not in ('main','perfect_pairs') then
     raise exception 'invalid wager' using errcode='22023';end if;
   select * into old from public.ig_bj_receipts where request_id=p_request;
   if found then
     if old.user_id<>p_actor or old.action<>'bet' or old.response->>'bet'<>p_target or (old.response->>'units')::integer<>p_units then raise exception 'invalid replay' using errcode='23505';end if;
     return old.response;
   end if;
   if t.phase<>'betting' or now()>=t.betting_closes_at or me.chips<p_units then
     raise exception 'betting closed or insufficient practice chips' using errcode='22023';end if;
   if p_target='main' then
     if me.main_bet>0 then raise exception 'main bet already placed' using errcode='22023';end if;
     update public.ig_bj_seats set main_bet=p_units,chips=chips-p_units where user_id=p_actor;
   else
     if me.main_bet=0 or me.pairs_bet>0 then raise exception 'pairs bet needs main bet' using errcode='22023';end if;
     update public.ig_bj_seats set pairs_bet=p_units,chips=chips-p_units where user_id=p_actor;
   end if;
   update public.ig_bj_table set revision=revision+1 where id='blackjack';
   result:=jsonb_build_object('ok',true,'bet',p_target,'units',p_units);
   insert into public.ig_bj_receipts(request_id,user_id,action,round_no,response)
     values(p_request,p_actor,'bet',t.round_no,result);
   return result;
 end if;
 if p_request is null then raise exception 'missing request ID' using errcode='23505';end if;
 select * into old from public.ig_bj_receipts where request_id=p_request;
 if found then
   if old.user_id<>p_actor or old.action<>p_action then raise exception 'invalid replay' using errcode='23505';end if;
   return old.response;
 end if;
 if p_expected_round is distinct from t.round_no then
   raise exception 'stale round' using errcode='23505';end if;

 if p_action='deal' then
   if t.phase<>'betting' or now()<t.betting_closes_at or t.controller<>p_actor then
     raise exception 'cannot deal now' using errcode='42501';end if;
   if not exists(select 1 from public.ig_bj_seats where seated and main_bet>0) then
     raise exception 'need at least one main practice bet' using errcode='22023';end if;
   select array_agg(((n-1)%52) order by n) into shoe from generate_series(1,312) n;
   for i in 1..311 loop
     j:=i+internal.table_fair_sample('blackjack',t.round_no,i-1,313-i);
     tmp:=shoe[i];shoe[i]:=shoe[j];shoe[j]:=tmp;
   end loop;
   index_next:=1;
   update public.ig_bj_seats set cards='{}',stood=false where seated;
   -- One card to each seated betting hand, then dealer, then second card to each.
   for i in 1..2 loop
     for player in select * from public.ig_bj_seats where seated and main_bet>0 order by seat_no loop
       update public.ig_bj_seats set cards=array_append(cards,shoe[index_next])
         where user_id=player.user_id;
       index_next:=index_next+1;
     end loop;
     if i=1 then first_card:=shoe[index_next];else second_card:=shoe[index_next];end if;
     index_next:=index_next+1;
   end loop;
   update public.ig_bj_table set deck=shoe,next_card=index_next,dealer_cards=array[first_card,second_card],
     phase='playing',revision=revision+1,updated_at=now() where id='blackjack';
   for player in select * from public.ig_bj_seats where seated and main_bet>0 loop
     if public.ig_bj_total(player.cards)=21 then
       update public.ig_bj_seats set stood=true where user_id=player.user_id;
     end if;
   end loop;
   if public.ig_bj_total(array[first_card,second_card])=21 then
     update public.ig_bj_seats set stood=true where seated and main_bet>0;
   end if;
   select user_id into next_turn from public.ig_bj_seats where seated and main_bet>0 and not stood order by seat_no limit 1;
   update public.ig_bj_table set turn_actor=next_turn,phase=case when next_turn is null then 'showdown' else 'playing' end,
      turn_deadline_at=case when next_turn is null then null else clock_timestamp()+interval '20 seconds' end
      where id='blackjack';
   result:=jsonb_build_object('ok',true,'phase',case when next_turn is null then 'showdown' else 'playing' end);
 elsif p_action in ('hit','stand') then
   if t.phase<>'playing' or t.turn_actor<>p_actor then raise exception 'not current player' using errcode='42501';end if;
   if t.turn_deadline_at is null or t.turn_deadline_at<=clock_timestamp() then
     raise exception 'turn has expired' using errcode='22023';
   end if;
   if p_action='hit' then
     if t.next_card>312 then raise exception 'shoe exhausted' using errcode='22023';end if;
     v_cards:=array_append(me.cards,t.deck[t.next_card]);
     update public.ig_bj_seats set cards=v_cards,stood=(public.ig_bj_total(v_cards)>=21) where user_id=p_actor;
     update public.ig_bj_table set next_card=next_card+1 where id='blackjack';
   else
     update public.ig_bj_seats set stood=true where user_id=p_actor;
   end if;
   select user_id into next_turn from public.ig_bj_seats where seated and main_bet>0 and not stood
     order by seat_no limit 1;
   update public.ig_bj_table set turn_actor=next_turn,
     phase=case when next_turn is null then 'showdown' else 'playing' end,
     turn_deadline_at=case when next_turn is null then null else clock_timestamp()+interval '20 seconds' end,
     revision=revision+1,updated_at=now() where id='blackjack';
   result:=jsonb_build_object('ok',true,'nextActor',next_turn);
 elsif p_action='resolve' then
   if t.phase<>'showdown' or t.controller<>p_actor then raise exception 'not ready for settlement' using errcode='42501';end if;
   v_cards:=t.dealer_cards;
   index_next:=t.next_card;
   while public.ig_bj_total(v_cards)<17 loop
     v_cards:=array_append(v_cards,t.deck[index_next]);index_next:=index_next+1;
   end loop;
   dealer_score:=public.ig_bj_total(v_cards);
   dealer_blackjack:=(array_length(v_cards,1)=2 and dealer_score=21);
   for player in select * from public.ig_bj_seats where seated and main_bet>0 order by seat_no loop
     player_score:=public.ig_bj_total(player.cards);
     is_blackjack:=array_length(player.cards,1)=2 and player_score=21;
     main_return:=0;pair_return:=0;
     if player_score>21 then v_status:='bust';
     elsif dealer_blackjack and is_blackjack then main_return:=player.main_bet;v_status:='push';
     elsif dealer_blackjack then v_status:='lose';
     elsif is_blackjack then main_return:=floor(player.main_bet*2.5)::integer;v_status:='blackjack';
     elsif dealer_score>21 or player_score>dealer_score then main_return:=player.main_bet*2;v_status:='win';
     elsif player_score=dealer_score then main_return:=player.main_bet;v_status:='push';
     else v_status:='lose';end if;
     if player.pairs_bet>0 and array_length(player.cards,1)>=2 then
       first_card:=player.cards[1];second_card:=player.cards[2];
       if first_card%13=second_card%13 then
         suit1:=first_card/13;suit2:=second_card/13;
         pair_return:=case when suit1=suit2 then player.pairs_bet*26
           when (suit1 in (0,3) and suit2 in (0,3)) or (suit1 in (1,2) and suit2 in (1,2))
             then player.pairs_bet*13 else player.pairs_bet*6 end;
       end if;
     end if;
     update public.ig_bj_seats set chips=chips+main_return+pair_return,
       main_bet=0,pairs_bet=0,cards='{}',stood=false where user_id=player.user_id;
     seat_results:=seat_results||jsonb_build_array(jsonb_build_object(
       'seat',player.seat_no,'status',v_status,'playerCards',to_jsonb(player.cards),
       'playerTotal',player_score,'returned',main_return,'pairsReturned',pair_return));
   end loop;
   result:=jsonb_build_object('round',t.round_no,'dealerCards',to_jsonb(v_cards),
     'dealerTotal',dealer_score,'seats',seat_results,'practiceOnly',true);
   insert into public.ig_bj_history(round_no,settled) values(t.round_no,result);
   update public.ig_bj_table set round_no=round_no+1,phase='betting',deck='{}',
     next_card=1,turn_actor=null,turn_deadline_at=null,dealer_cards='{}',last_result=result,
     betting_closes_at=now()+interval '12 seconds',revision=revision+1,
     updated_at=now() where id='blackjack';
   result:=jsonb_build_object('ok',true,'result',result);
 else
   raise exception 'invalid command' using errcode='22023';
 end if;
 insert into public.ig_bj_receipts(request_id,user_id,action,round_no,response)
   values(p_request,p_actor,p_action,t.round_no,result);
 return result;
end$function$;

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
      j:=i+internal.table_fair_sample('baccarat',room.round_no,i-1,417-i);
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

CREATE OR REPLACE FUNCTION public.ig_mp_action_manual(p_actor uuid, p_game text, p_action text, p_request uuid DEFAULT NULL::uuid, p_target text DEFAULT NULL::text, p_units integer DEFAULT NULL::integer, p_expected_round bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  t public.ig_mp_tables%rowtype;
  seat public.ig_mp_players%rowtype;
  bet public.ig_mp_bets%rowtype;
  past public.ig_mp_bets%rowtype;
  old_event public.ig_mp_events%rowtype;
  d1 integer; d2 integer; landed integer; total integer;
  point_before integer; point_after integer; payout integer; n integer;
  new_shooter uuid; qualifies boolean; win boolean; multiplier integer;
  rolled jsonb; v_user_role text; stake text;
  reds integer[] := array[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
begin
  if p_game not in ('craps','roulette') or p_action not in ('join','leave','bet','roll','spin','claim') then
    raise exception 'invalid action' using errcode='22023';
  end if;
  select ur.role::text into v_user_role
    from public.user_roles ur join public.profiles pr on pr.id=ur.user_id
   where ur.user_id=p_actor and pr.is_excluded=false;
  if v_user_role is null or v_user_role not in ('player','admin','superadmin') then
    raise exception 'account not eligible' using errcode='42501';
  end if;
  -- Game actions, chips and order of play share one database row lock.
  select * into strict t from public.ig_mp_tables where game=p_game for update;
  if p_action='join' then
    if p_game='craps' and p_target is not null and p_target not in ('shooter','action') then
      raise exception 'INVALID_SEAT_MODE' using errcode='22023';
    end if;
    if p_game='roulette' and p_target is not null then
      raise exception 'UNEXPECTED_ROULETTE_SEAT_MODE' using errcode='22023';
    end if;
    -- Inactive seats free up after ten minutes, but their practice-chip ledger stays
    -- permanently attached to their account. Never mint another initial allocation.
    update public.ig_mp_players set seated=false
      where game=p_game and seated and seen_at < now()-interval '10 minutes';
    if t.shooter_id is not null and not exists(
      select 1 from public.ig_mp_players p where p.game=p_game
        and p.user_id=t.shooter_id and p.seated
    ) then
      t.shooter_id := null;
      update public.ig_mp_tables set shooter_id=null,revision=revision+1,updated_at=now()
        where game=p_game;
    end if;
    if not exists(select 1 from public.ig_mp_players where game=p_game and user_id=p_actor and seated)
       and (select count(*) from public.ig_mp_players where game=p_game and seated)>=24 then
      raise exception 'table full' using errcode='22023';
    end if;
    insert into public.ig_mp_players(game,user_id) values(p_game,p_actor)
      on conflict(game,user_id) do update set seen_at=now(),seated=true;
    if p_game='craps' then
      -- NULL means heartbeat/rejoin: preserve the player's previous choice.
      -- The default for new seats is action-only, and explicitly opting into
      -- shooter duty places that player in the eligible FIFO shooter queue.
      if p_target is not null then
        update public.ig_mp_players set craps_join_mode=p_target,
          craps_shooter_requested_at=case when p_target='shooter' then
            case when craps_join_mode='shooter'
                 then coalesce(craps_shooter_requested_at,now()) else now() end
            else null end
          where game='craps' and user_id=p_actor;
      end if;
      if t.shooter_id=p_actor and
         exists(select 1 from public.ig_mp_players where game='craps'
            and user_id=p_actor and craps_join_mode='action') then
        -- Relinquishing the dice is intentional, not a table disconnect.
        t.shooter_id:=null;
      end if;
      if t.shooter_id is null then
        select p.user_id into new_shooter from public.ig_mp_players p
        where p.game='craps' and p.seated and p.craps_join_mode='shooter'
          and p.seen_at>now()-interval '60 seconds'
        order by p.craps_shooter_requested_at nulls last,p.joined_at,p.user_id limit 1;
        t.shooter_id:=new_shooter;
        update public.ig_mp_tables set shooter_id=new_shooter,
          betting_closes_at=case when new_shooter is null then now()
                else now()+interval '12 seconds' end,
          revision=revision+1,updated_at=now() where game=p_game;
      end if;
    elsif t.shooter_id is null then
      update public.ig_mp_tables set shooter_id=p_actor,
        betting_closes_at=now()+interval '12 seconds',revision=revision+1,updated_at=now() where game=p_game;
    end if;
    return jsonb_build_object('ok',true,'joined',true,
      'seatMode',case when p_game='craps' then
        (select craps_join_mode from public.ig_mp_players
          where game='craps' and user_id=p_actor) else 'shooter' end,
      'isShooter',t.shooter_id=p_actor);
  end if;
  select * into seat from public.ig_mp_players where game=p_game and user_id=p_actor for update;
  if not found then raise exception 'join table first' using errcode='42501'; end if;
  if p_action='leave' then
    if seat.seated then
      update public.ig_mp_players set seated=false,seen_at=now() where game=p_game and user_id=p_actor;
      if t.shooter_id=p_actor then
        select p.user_id into new_shooter from public.ig_mp_players p
          where p.game=p_game and p.seated and p.seen_at>now()-interval '60 seconds'
            and (p_game<>'craps' or p.craps_join_mode='shooter')
          order by case when p_game='craps' then p.craps_shooter_requested_at end nulls last,
                   p.joined_at,p.user_id limit 1;
        update public.ig_mp_tables set shooter_id=new_shooter,
            betting_closes_at=case when new_shooter is null then now() else now()+interval '12 seconds' end,
            revision=revision+1,updated_at=now() where game=p_game;
      else
        update public.ig_mp_tables set revision=revision+1,updated_at=now() where game=p_game;
      end if;
    end if;
    return jsonb_build_object('ok',true,'joined',false);
  end if;
  if not seat.seated then raise exception 'join table first' using errcode='42501'; end if;
  update public.ig_mp_players set seen_at=now() where game=p_game and user_id=p_actor;
  if p_action='claim' then
    if p_game='craps' and seat.craps_join_mode<>'shooter' then
      raise exception 'SHOOTER_OPT_IN_REQUIRED' using errcode='42501';
    end if;
    if p_game='craps' and exists(
       select 1 from public.ig_mp_players p
       where p.game='craps' and p.seated and p.craps_join_mode='shooter'
         and p.seen_at>now()-interval '60 seconds' and p.user_id<>p_actor
         and (p.craps_shooter_requested_at, p.joined_at,p.user_id)
             < (coalesce(seat.craps_shooter_requested_at,now()),seat.joined_at,p_actor)
    ) then
      raise exception 'SHOOTER_QUEUE_TURN_REQUIRED' using errcode='42501';
    end if;
    if t.shooter_id is not null and t.shooter_id<>p_actor
       and exists(select 1 from public.ig_mp_players where game=p_game and user_id=t.shooter_id
                 and seated and seen_at > now()-interval '60 seconds') then
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
    if now()>=t.betting_closes_at then raise exception 'betting is closed for this round' using errcode='22023'; end if;
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
  if now()<t.betting_closes_at then raise exception 'betting window still open' using errcode='22023'; end if;
  if t.shooter_id is distinct from p_actor then raise exception 'only current shooter/dealer may act' using errcode='42501'; end if;
  point_before := t.point;
  point_after := t.point;
  if p_game='craps' then
    d1:=internal.table_fair_sample('craps',t.round_no,0,6)+1; d2:=internal.table_fair_sample('craps',t.round_no,1,6)+1; total:=d1+d2;
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
    select p.user_id into new_shooter from public.ig_mp_players p
      join public.ig_mp_players current_seat on current_seat.game=p.game and current_seat.user_id=p_actor
      where p.game=p_game and p.user_id<>p_actor and p.seated
        and p.craps_join_mode='shooter' and p.seen_at>now()-interval '60 seconds'
      order by p.craps_shooter_requested_at nulls last,p.joined_at,p.user_id limit 1;
    new_shooter:=coalesce(new_shooter,p_actor);
  end if;
  update public.ig_mp_tables set round_no=round_no+1,point=point_after,
      shooter_id=new_shooter,last_result=rolled,betting_closes_at=now()+interval '12 seconds',revision=revision+1,updated_at=now()
      where game=p_game;
  insert into public.ig_mp_events(game,request_id,actor,round_no,result)
    values(p_game,p_request,p_actor,t.round_no,rolled);
  return jsonb_build_object('ok',true,'replayed',false,'result',rolled);
end $function$;

create or replace function ig_internal.roulette_tick() returns jsonb
language plpgsql security definer set search_path='' as $$
declare t public.ig_mp_tables%rowtype; b public.ig_mp_bets%rowtype;
 landed integer; n integer; multiplier integer; payout integer; win boolean;
 reds integer[]:=array[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
 stamp timestamptz; rolled jsonb; phase text;
begin
 select * into t from public.ig_mp_tables where game='roulette' for update skip locked;
 if not found then return jsonb_build_object('phase','busy'); end if;
 stamp:=clock_timestamp();
 if stamp<t.betting_closes_at then return jsonb_build_object('phase','betting','round',t.round_no); end if;
 if t.pending_result is null then
  landed:=internal.table_fair_sample('roulette',t.round_no,0,37);
  rolled:=jsonb_build_object('game','roulette','round',t.round_no,'number',landed,'color',case when landed=0 then 'green' when landed=any(reds) then 'red' else 'black' end,'presentationEndsAt',t.presentation_ends_at,'operator','house');
  insert into public.ig_mp_events(game,request_id,actor,round_no,result) values('roulette',gen_random_uuid(),null,t.round_no,rolled);
  update public.ig_mp_tables set pending_result=rolled,last_result=rolled,revision=revision+1,updated_at=stamp where game='roulette';
  t.pending_result:=rolled;phase:='spinning';
 end if;
 if stamp>=t.presentation_ends_at then
  landed:=(t.pending_result->>'number')::integer;
  for b in select * from public.ig_mp_bets where game='roulette' and status='active' and placed_round=t.round_no order by created_at,id for update loop
   win:=false;multiplier:=1;
   if b.target like 'number_%' then n:=substring(b.target from 8)::integer;win:=landed=n;multiplier:=35;
   elsif b.target='red' then win:=landed<>0 and landed=any(reds);
   elsif b.target='black' then win:=landed<>0 and not landed=any(reds);
   elsif b.target='odd' then win:=landed<>0 and landed%2=1;
   elsif b.target='even' then win:=landed<>0 and landed%2=0;
   elsif b.target='low' then win:=landed between 1 and 18;
   elsif b.target='high' then win:=landed between 19 and 36;
   elsif b.target like 'dozen_%' then n:=substring(b.target from 7)::integer;win:=landed between (n-1)*12+1 and n*12;multiplier:=2;
   elsif b.target like 'column_%' then n:=substring(b.target from 8)::integer;win:=landed<>0 and (landed-1)%3+1=n;multiplier:=2;
   end if;
   payout:=case when win then b.units*(multiplier+1) else 0 end;
   update public.ig_mp_bets set status='settled',paid_units=payout,outcome=case when win then 'win' else 'lose' end,settled_at=stamp where id=b.id;
   if payout>0 then update public.ig_mp_players set chips=chips+payout where game='roulette' and user_id=b.user_id; end if;
  end loop;
  update public.ig_mp_tables set round_no=round_no+1,round_started_at=stamp,betting_closes_at=stamp+interval '27 seconds',presentation_ends_at=stamp+interval '30 seconds',pending_result=null,shooter_id=null,revision=revision+1,updated_at=stamp where game='roulette';
  phase:='betting';
 end if;
 if phase is not null then
  -- Public invalidation signal contains no account or wager data. Clients still
  -- fetch an authenticated snapshot and never trust broadcast outcomes/balances.
  begin perform realtime.send(jsonb_build_object('game','roulette','phase',phase),'roulette-clock','ig-practice-roulette-clock',false);
  exception when others then raise warning 'Roulette clock broadcast unavailable'; end;
 end if;
 return jsonb_build_object('phase',coalesce(phase,'spinning'),'round',t.round_no);
end $$;

CREATE OR REPLACE FUNCTION public.ig_bj_state(p_actor uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare room public.ig_bj_table%rowtype; seated_players jsonb; me public.ig_bj_seats%rowtype;
  upcards jsonb;dealer_visible jsonb;turn_user uuid;
begin
 if not exists(select 1 from public.profiles p join public.user_roles r on r.user_id=p.id
   where p.id=p_actor and p.is_excluded=false and r.role::text in ('player','tester','admin','superadmin')) then
   raise exception 'ineligible account' using errcode='42501';end if;
 select * into strict room from public.ig_bj_table where id='blackjack';
 select * into me from public.ig_bj_seats where user_id=p_actor and seated;
 select coalesce(jsonb_agg(jsonb_build_object('id',user_id,'seat',seat_no,
   'chips',case when user_id=p_actor then chips else null end,
   'cards',to_jsonb(cards),'total',public.ig_bj_total(cards),
   'mainBet',main_bet,'pairsBet',pairs_bet,'stood',stood,
   'active',seen_at>now()-interval '60 seconds') order by seat_no),'[]'::jsonb)
   into seated_players from public.ig_bj_seats where seated;
 dealer_visible:=case when room.phase='playing' then to_jsonb(array[room.dealer_cards[1]])
   else to_jsonb(room.dealer_cards) end;
 return jsonb_build_object('game','blackjack','round',room.round_no,'phase',room.phase,
   'revision',room.revision,'controllerId',room.controller,'turnActor',room.turn_actor,
   'bettingClosesAt',room.betting_closes_at,'serverTime',now(),
   'dealerCards',dealer_visible,'dealerHidden',room.phase='playing',
   'turnDeadlineAt',room.turn_deadline_at,
   'lastResult',room.last_result,'players',seated_players,
   'joined',me.user_id is not null,'chips',coalesce(me.chips,0),
   'practiceOnly',true,'realMoneyEnabled',false)||jsonb_build_object('fairness',internal.table_fair_public('blackjack',room.round_no),'fairnessHistory',internal.table_fair_history('blackjack'));
end$function$;

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
    'joined',own is not null,'chips',coalesce(own,0),'practiceOnly',true,'realMoneyEnabled',false)||jsonb_build_object('fairness',internal.table_fair_public(p_game,t.round_no),'fairnessHistory',internal.table_fair_history(p_game));
end $$;

create or replace function public.ig_mp_state(p_actor uuid,p_game text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s jsonb;t public.ig_mp_tables%rowtype;
begin
 s:=public.ig_mp_state_manual(p_actor,p_game);
 if p_game='roulette' then
  select * into strict t from public.ig_mp_tables where game='roulette';
  s:=s||jsonb_build_object('betsOpen',clock_timestamp()<t.betting_closes_at and t.pending_result is null,'roundEndsAt',t.presentation_ends_at,'presentationEndsAt',t.presentation_ends_at,'roundStartedAt',t.round_started_at,'phase',case when clock_timestamp()<t.betting_closes_at and t.pending_result is null then 'betting' else 'spinning' end,'operator','house','serverTime',clock_timestamp());
 end if;return s||jsonb_build_object('fairness',internal.table_fair_public(p_game,(s->>'round')::bigint),'fairnessHistory',internal.table_fair_history(p_game));
end $$;

CREATE OR REPLACE FUNCTION public.ig_crash_v2_fill_queue()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare k integer; bytes bytea; r numeric; point numeric; duration integer; seed text; batch_count integer;
begin
 -- Use the same lock as round advancement, including standalone service calls.
 perform 1 from public.ig_crash_v2_runtime where singleton=1 for update;
 select count(*) into batch_count from public.ig_crash_v2_queue where status='queued';
 if batch_count >= 5 then return; end if;
 for k in 1..(25-batch_count) loop
  bytes:=extensions.gen_random_bytes(4);
  r:=(get_byte(bytes,0)::numeric*16777216 + get_byte(bytes,1)::numeric*65536
      + get_byte(bytes,2)::numeric*256+get_byte(bytes,3)::numeric)/4294967296.0;
  if r < 0.01 then point:=0;
  else point:=least(12000,round(0.99/(1-(r-0.01)/0.99),2)); end if;
  duration:=greatest(500,least(40000,round(40000*ln(1+point)/ln(12001))::integer));
  seed:=encode(extensions.gen_random_bytes(32),'hex');
  insert into public.ig_crash_v2_queue(seed_secret,crash_point,duration_ms,commitment)
   values(seed,point,duration,encode(extensions.digest(seed||':'||point::numeric(10,2)::text||':'||duration::text,'sha256'),'hex'));
 end loop;
end $function$;
