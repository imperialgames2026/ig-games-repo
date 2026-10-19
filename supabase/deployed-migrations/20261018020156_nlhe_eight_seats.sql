-- NLHE eight-handed staging tables; Omaha remains at six.
-- Seat assignment and clockwise blind/button rotation must agree on 0..7 seat IDs.
CREATE OR REPLACE FUNCTION public.poker_join_v1(p_table uuid,p_actor uuid)
RETURNS integer LANGUAGE plpgsql SET search_path TO '' AS $$
declare t public.poker_tables_v1%rowtype; seat int; seat_limit int;
begin
 select * into t from public.poker_tables_v1 where id=p_table for update;
 if not found or t.status<>'waiting' then raise exception 'JOIN_CLOSED';end if;
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
declare t public.poker_tables_v1%rowtype;players int;button_no int;sb int;bb int;actor int;idx int:=0;entry record;
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
 select seat_no into actor from public.poker_seats_v1 where table_id=p_table and stack>0 and seat_no<>bb order by (seat_no-bb+8)%8 limit 1;
 update public.poker_tables_v1 set status='playing',version=version+1,button=button_no,turn_index=actor,street='preflop',current_bet=t.big_blind,min_raise=t.big_blind,private_deck=p_deck,dealt_count=players,deck_commitment=p_commitment,seed_secret=p_seed,hand_no=p_hand_no,turn_started_at=clock_timestamp(),turn_deadline_at=clock_timestamp()+interval '10 seconds',turn_extension_used=false,board='[]'::jsonb,last_action_at=now() where id=p_table;
 return jsonb_build_object('tableId',p_table,'button',button_no,'smallBlind',sb,'bigBlind',bb,'version',t.version+1);
end $function$;



