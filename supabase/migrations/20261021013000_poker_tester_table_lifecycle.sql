-- Pending tester-chip lab migration; no wallet, payment or bot provisioning.
-- Apply only after the recorded baseline migrations. No remote deployment is
-- implied by this source file. Join between hands never resets an existing stack.
CREATE OR REPLACE FUNCTION public.poker_join_v1(p_table uuid,p_actor uuid)
RETURNS integer LANGUAGE plpgsql SET search_path TO '' AS $$
declare t public.poker_tables_v1%rowtype; seat int; seat_limit int;
begin
 select * into t from public.poker_tables_v1 where id=p_table for update;
 if not found or t.status not in ('waiting','complete') then raise exception 'JOIN_CLOSED';end if;
 seat_limit:=case when t.variant='holdem' then 8 else 6 end;
 select seat_no into seat from public.poker_seats_v1 where table_id=p_table and user_id=p_actor;
 if found then return seat;end if;
 select i into seat from generate_series(0,seat_limit-1) i
 where not exists(select 1 from public.poker_seats_v1 where table_id=p_table and seat_no=i)
 order by i limit 1;
 if seat is null then raise exception 'TABLE_FULL';end if;
 insert into public.poker_seats_v1(table_id,seat_no,user_id,stack) values(p_table,seat,p_actor,1000);
 return seat;
end $$;

CREATE OR REPLACE FUNCTION public.poker_start_v2(p_table uuid, p_owner uuid, p_deck jsonb, p_commitment text, p_seed text, p_hand_no integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare t public.poker_tables_v1%rowtype;players int;button_no int;sb int;bb int;actor int;idx int:=0;entry record;posted_bet bigint;live_count integer;
begin
 select * into t from public.poker_tables_v1 where id=p_table for update;
 if not found or t.variant<>'holdem' or t.owner_id<>p_owner or t.status NOT IN ('waiting','complete') OR p_hand_no<>t.hand_no+1 OR coalesce(length(p_seed),0)<16 OR p_commitment<>encode(extensions.digest(p_seed||':'||p_table::text||':'||p_hand_no::text,'sha256'),'hex') then raise exception 'START_DENIED';end if;
 select count(*) into players from public.poker_seats_v1 where table_id=p_table and stack>0;
 if players<2 or players>8 then raise exception 'INVALID_PLAYER_COUNT';end if;
 if jsonb_typeof(p_deck)<>'array' or jsonb_array_length(p_deck)<>52 or p_commitment !~ '^[0-9a-f]{64}$' then raise exception 'INVALID_DECK';end if;
 if (select count(distinct x.value::text) from jsonb_array_elements(p_deck) x)<>52 then raise exception 'DUPLICATE_CARDS';end if;
 -- Reset the previous hand state and rotate button, skipping broke seats.
 update public.poker_seats_v1 set committed=0,street_bet=0,folded=(stack=0),all_in=false,acted=false,private_hole='[]'::jsonb where table_id=p_table;
 select seat_no into button_no from public.poker_seats_v1 where table_id=p_table and stack>0 order by (seat_no-t.button-1+8)%8 limit 1;
 if t.button<0 then select min(seat_no) into button_no from public.poker_seats_v1 where table_id=p_table and stack>0;end if;
 for entry in select seat_no from public.poker_seats_v1 where table_id=p_table and stack>0 order by (seat_no-button_no+8)%8 loop
  update public.poker_seats_v1 set private_hole=jsonb_build_array(p_deck->idx,p_deck->(idx+players)) where table_id=p_table and seat_no=entry.seat_no;
  idx:=idx+1;
 end loop;
 if players=2 then sb=button_no;
 else select seat_no into sb from public.poker_seats_v1 where table_id=p_table and stack>0 and seat_no<>button_no order by (seat_no-button_no+8)%8 limit 1;end if;
 select seat_no into bb from public.poker_seats_v1 where table_id=p_table and stack>0 and seat_no<>sb order by (seat_no-sb+8)%8 limit 1;
 update public.poker_seats_v1 set stack=stack-least(stack,t.small_blind),committed=least(stack,t.small_blind),street_bet=least(stack,t.small_blind),all_in=(stack<=t.small_blind) where table_id=p_table and seat_no=sb;
 update public.poker_seats_v1 set stack=stack-least(stack,t.big_blind),committed=least(stack,t.big_blind),street_bet=least(stack,t.big_blind),all_in=(stack<=t.big_blind) where table_id=p_table and seat_no=bb;
 -- Multiple funded players still face the nominal big-blind bring-in. A lone
 -- funded player owes only actual posted chips from the all-in opponents.
 select max(street_bet) into posted_bet
   from public.poker_seats_v1 where table_id=p_table and not folded;
 select count(*) into live_count from public.poker_seats_v1
   where table_id=p_table and not folded and not all_in and stack>0;
 if live_count>1 then posted_bet:=greatest(posted_bet,t.big_blind);end if;
 select seat_no into actor from public.poker_seats_v1
   where table_id=p_table and not folded and not all_in and stack>0
     and (live_count>1 or street_bet<posted_bet)
   order by (seat_no-bb-1+8)%8 limit 1;
 update public.poker_tables_v1 set status=case when actor is null then 'showdown' else 'playing' end,version=version+1,button=button_no,turn_index=actor,street='preflop',current_bet=posted_bet,min_raise=t.big_blind,private_deck=p_deck,dealt_count=players,deck_commitment=p_commitment,seed_secret=p_seed,hand_no=p_hand_no,turn_started_at=case when actor is not null then clock_timestamp() else null end,turn_deadline_at=case when actor is not null then clock_timestamp()+interval '10 seconds' else null end,turn_extension_used=false,board='[]'::jsonb,last_action_at=now() where id=p_table;
 return jsonb_build_object('tableId',p_table,'button',button_no,'smallBlind',sb,'bigBlind',bb,'version',t.version+1);
end $function$;


CREATE OR REPLACE FUNCTION public.poker_start_omaha_v1(p_table uuid, p_owner uuid, p_deck jsonb, p_commitment text, p_seed text, p_hand_no integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare t public.poker_tables_v1%rowtype;players int;button_no int;sb int;bb int;actor int;idx int:=0;entry record;posted_bet bigint;live_count integer;
begin
 select * into t from public.poker_tables_v1 where id=p_table for update;
 if not found or t.variant<>'omaha' or t.owner_id<>p_owner or t.status not in ('waiting','complete')
   or p_hand_no<>t.hand_no+1 or coalesce(length(p_seed),0)<16
   or p_commitment<>encode(extensions.digest(p_seed||':'||p_table::text||':'||p_hand_no::text,'sha256'),'hex')
   then raise exception 'OMAHA_START_DENIED';end if;
 select count(*) into players from public.poker_seats_v1 where table_id=p_table and stack>0;
 if players<2 or players>6 then raise exception 'INVALID_PLAYER_COUNT';end if;
 if jsonb_typeof(p_deck)<>'array' or jsonb_array_length(p_deck)<>52 or p_commitment !~ '^[0-9a-f]{64}$'
   then raise exception 'INVALID_DECK';end if;
 if (select count(distinct x.value::text) from jsonb_array_elements(p_deck) x)<>52
   then raise exception 'DUPLICATE_CARDS';end if;
 update public.poker_seats_v1 set committed=0,street_bet=0,folded=(stack=0),
   all_in=false,acted=false,private_hole='[]'::jsonb where table_id=p_table;
 select seat_no into button_no from public.poker_seats_v1 where table_id=p_table and stack>0
   order by (seat_no-t.button-1+6)%6 limit 1;
 if t.button<0 then
   select min(seat_no) into button_no from public.poker_seats_v1 where table_id=p_table and stack>0;
 end if;
 for entry in select seat_no from public.poker_seats_v1 where table_id=p_table and stack>0
   order by (seat_no-button_no+6)%6 loop
   update public.poker_seats_v1
     set private_hole=jsonb_build_array(p_deck->idx,p_deck->(idx+players),
       p_deck->(idx+2*players),p_deck->(idx+3*players))
     where table_id=p_table and seat_no=entry.seat_no;
   idx:=idx+1;
 end loop;
 if players=2 then sb=button_no;
 else
   select seat_no into sb from public.poker_seats_v1 where table_id=p_table and stack>0 and seat_no<>button_no
      order by (seat_no-button_no+6)%6 limit 1;
 end if;
 select seat_no into bb from public.poker_seats_v1 where table_id=p_table and stack>0 and seat_no<>sb
   order by (seat_no-sb+6)%6 limit 1;
 update public.poker_seats_v1 set stack=stack-least(stack,t.small_blind),
   committed=least(stack,t.small_blind),street_bet=least(stack,t.small_blind),
   all_in=(stack<=t.small_blind) where table_id=p_table and seat_no=sb;
 update public.poker_seats_v1 set stack=stack-least(stack,t.big_blind),
   committed=least(stack,t.big_blind),street_bet=least(stack,t.big_blind),
   all_in=(stack<=t.big_blind) where table_id=p_table and seat_no=bb;
 -- Multiple funded players still face the nominal big-blind bring-in. A lone
 -- funded player owes only actual posted chips from the all-in opponents.
 select max(street_bet) into posted_bet
   from public.poker_seats_v1 where table_id=p_table and not folded;
 select count(*) into live_count from public.poker_seats_v1
   where table_id=p_table and not folded and not all_in and stack>0;
 if live_count>1 then posted_bet:=greatest(posted_bet,t.big_blind);end if;
 select seat_no into actor from public.poker_seats_v1
   where table_id=p_table and not folded and not all_in and stack>0
     and (live_count>1 or street_bet<posted_bet)
   order by (seat_no-bb-1+6)%6 limit 1;
 update public.poker_tables_v1 set status=case when actor is null then 'showdown' else 'playing' end,version=version+1,button=button_no,turn_index=actor,
   street='preflop',current_bet=posted_bet,min_raise=t.big_blind,private_deck=p_deck,dealt_count=players,deck_commitment=p_commitment,seed_secret=p_seed,hand_no=p_hand_no,turn_started_at=case when actor is not null then clock_timestamp() else null end,
   turn_deadline_at=case when actor is not null then clock_timestamp()+interval '10 seconds' else null end,turn_extension_used=false,
   board='[]'::jsonb,last_action_at=now() where id=p_table;
 return jsonb_build_object('tableId',p_table,'variant','omaha','button',button_no,
   'smallBlind',sb,'bigBlind',bb,'version',t.version+1);
end$function$;


-- One shared street transition with the correct seat ring for each variant.
CREATE OR REPLACE FUNCTION public.poker_advance_v1(p_table uuid)
RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $function$
declare t public.poker_tables_v1%rowtype;actor integer;active_count integer;
 hole_count integer;offset_card integer;seat_limit integer;live_count integer;
begin
 select * into t from public.poker_tables_v1 where id=p_table for update;
 if not found or t.status<>'showdown' or t.street='river' then raise exception 'NOT_ADVANCEABLE';end if;
 select count(*) into active_count from public.poker_seats_v1 where table_id=p_table and not folded;
 if active_count<2 then raise exception 'HAND_ALREADY_WON';end if;
 hole_count:=case when t.variant='omaha' then 4 else 2 end;
 seat_limit:=case when t.variant='omaha' then 6 else 8 end;
 offset_card:=hole_count*t.dealt_count;
 if t.street='preflop' then
  update public.poker_tables_v1 set street='flop',board=jsonb_build_array(
    t.private_deck->(offset_card+1),t.private_deck->(offset_card+2),t.private_deck->(offset_card+3)) where id=p_table;
 elsif t.street='flop' then
  update public.poker_tables_v1 set street='turn',board=board||jsonb_build_array(t.private_deck->(offset_card+5)) where id=p_table;
 else
  update public.poker_tables_v1 set street='river',board=board||jsonb_build_array(t.private_deck->(offset_card+7)) where id=p_table;
 end if;
 update public.poker_seats_v1 set street_bet=0,acted=false where table_id=p_table;
 select count(*) into live_count from public.poker_seats_v1
   where table_id=p_table and not folded and not all_in and stack>0;
 -- A lone player cannot bet against an all-in opponent; run out the board.
 if live_count>1 then
  select seat_no into actor from public.poker_seats_v1
    where table_id=p_table and not folded and not all_in and stack>0
    order by (seat_no-t.button-1+seat_limit)%seat_limit limit 1;
 end if;
 update public.poker_tables_v1 set
  status=case when actor is null then 'showdown' else 'playing' end,turn_index=actor,
  turn_started_at=case when actor is not null then clock_timestamp() else null end,
  turn_deadline_at=case when actor is not null then clock_timestamp()+interval '10 seconds' else null end,
  turn_extension_used=false,current_bet=0,min_raise=big_blind,version=version+1 where id=p_table;
 return jsonb_build_object('tableId',p_table,'variant',t.variant,'version',t.version+1,
  'street',(select street from public.poker_tables_v1 where id=p_table));
end $function$;

REVOKE ALL ON FUNCTION public.poker_join_v1(uuid,uuid), public.poker_start_v2(uuid,uuid,jsonb,text,text,integer), public.poker_start_omaha_v1(uuid,uuid,jsonb,text,text,integer), public.poker_advance_v1(uuid) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.poker_join_v1(uuid,uuid), public.poker_start_v2(uuid,uuid,jsonb,text,text,integer), public.poker_start_omaha_v1(uuid,uuid,jsonb,text,text,integer), public.poker_advance_v1(uuid) TO service_role;
