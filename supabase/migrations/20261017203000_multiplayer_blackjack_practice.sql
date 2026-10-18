-- Multiplayer 6-deck Blackjack staging; nonredeemable chips and immutable server-resolved actions.
-- NEVER use this ledger for cryptocurrency, payments or redeemable wagers.
create table if not exists public.ig_bj_table (
  id text primary key default 'blackjack' check(id='blackjack'),
  round_no bigint not null default 1 check(round_no>0),
  phase text not null default 'betting' check(phase in ('betting','playing','showdown')),
  controller uuid references auth.users(id) on delete set null,
  turn_actor uuid references auth.users(id) on delete set null,
  betting_closes_at timestamptz not null default(now()+interval '12 seconds'),
  deck integer[] not null default '{}',
  next_card integer not null default 1,
  dealer_cards integer[] not null default '{}',
  last_result jsonb,
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);
insert into public.ig_bj_table(id) values('blackjack') on conflict do nothing;
create table if not exists public.ig_bj_seats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  seat_no integer not null check(seat_no between 0 and 6),
  seated boolean not null default true,
  chips bigint not null default 1000 check(chips>=0 and chips<=100000000),
  main_bet integer not null default 0 check(main_bet between 0 and 100),
  pairs_bet integer not null default 0 check(pairs_bet between 0 and 100),
  cards integer[] not null default '{}',
  stood boolean not null default false,
  joined_at timestamptz not null default now(),
  seen_at timestamptz not null default now()
);
create unique index if not exists ig_bj_active_seat on public.ig_bj_seats(seat_no) where seated;
create table if not exists public.ig_bj_receipts (
  request_id uuid primary key,
  user_id uuid not null references auth.users(id),
  action text not null,
  round_no bigint not null,
  response jsonb not null,
  created_at timestamptz not null default now()
);
create table if not exists public.ig_bj_history (
  round_no bigint primary key,
  settled jsonb not null,
  created_at timestamptz not null default now()
);
do $$declare t text;
begin foreach t in array array['ig_bj_table','ig_bj_seats','ig_bj_receipts','ig_bj_history'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select,insert,update,delete on public.%I to service_role',t);
end loop;end$$;

create or replace function public.ig_bj_total(p_cards integer[]) returns integer
language plpgsql immutable set search_path='' as $$
declare card integer; n integer; aces integer:=0; score integer:=0;
begin
 foreach card in array p_cards loop
  n:=(card%13)+1;
  if n=1 then score:=score+11;aces:=aces+1;
  else score:=score+least(n,10);end if;
 end loop;
 while score>21 and aces>0 loop score:=score-10; aces:=aces-1;end loop;
 return score;
end$$;
revoke all on function public.ig_bj_total(integer[]) from public,anon,authenticated;
grant execute on function public.ig_bj_total(integer[]) to service_role;

create or replace function public.ig_bj_action(
 p_actor uuid,p_action text,p_request uuid default null,p_units integer default null,
 p_target text default null,p_expected_round bigint default null
) returns jsonb language plpgsql security definer set search_path='' as $$
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
     select user_id into new_controller from public.ig_bj_seats where seated order by seat_no limit1;
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
     if old.user_id<>p_actor or old.action<>'bet' then raise exception 'invalid replay' using errcode='23505';end if;
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
     j:=i+public.ig_mp_random(313-i);
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
   select user_id into next_turn from public.ig_bj_seats where seated and main_bet>0 and not stood order by seat_no limit1;
   update public.ig_bj_table set turn_actor=next_turn,phase=case when next_turn is null then 'showdown' else 'playing' end
      where id='blackjack';
   result:=jsonb_build_object('ok',true,'phase',case when next_turn is null then 'showdown' else 'playing' end);
 elsif p_action in ('hit','stand') then
   if t.phase<>'playing' or t.turn_actor<>p_actor then raise exception 'not current player' using errcode='42501';end if;
   if p_action='hit' then
     if t.next_card>312 then raise exception 'shoe exhausted' using errcode='22023';end if;
     v_cards:=array_append(me.cards,t.deck[t.next_card]);
     update public.ig_bj_seats set cards=v_cards,stood=(public.ig_bj_total(v_cards)>=21) where user_id=p_actor;
     update public.ig_bj_table set next_card=next_card+1 where id='blackjack';
   else
     update public.ig_bj_seats set stood=true where user_id=p_actor;
   end if;
   select user_id into next_turn from public.ig_bj_seats where seated and main_bet>0 and not stood
     order by seat_no limit1;
   update public.ig_bj_table set turn_actor=next_turn,
     phase=case when next_turn is null then 'showdown' else 'playing' end,
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
     next_card=1,turn_actor=null,dealer_cards='{}',last_result=result,
     betting_closes_at=now()+interval '12 seconds',revision=revision+1,
     updated_at=now() where id='blackjack';
   result:=jsonb_build_object('ok',true,'result',result);
 else
   raise exception 'invalid command' using errcode='22023';
 end if;
 insert into public.ig_bj_receipts(request_id,user_id,action,round_no,response)
   values(p_request,p_actor,p_action,t.round_no,result);
 return result;
end$$;
revoke all on function public.ig_bj_action(uuid,text,uuid,integer,text,bigint) from public,anon,authenticated;
grant execute on function public.ig_bj_action(uuid,text,uuid,integer,text,bigint) to service_role;

create or replace function public.ig_bj_state(p_actor uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
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
   'lastResult',room.last_result,'players',seated_players,
   'joined',me.user_id is not null,'chips',coalesce(me.chips,0),
   'practiceOnly',true,'realMoneyEnabled',false);
end$$;
revoke all on function public.ig_bj_state(uuid) from public,anon,authenticated;
grant execute on function public.ig_bj_state(uuid) to service_role;
