create or replace function public.poker_advance_v1(p_table uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare t public.poker_tables_v1%rowtype; actor int;firstseat int;active_count int;offset_card int;
begin
 select * into t from public.poker_tables_v1 where id=p_table for update;
 if not found or t.status<>'showdown' or t.street='river' then raise exception 'NOT_ADVANCEABLE';end if;
 select count(*) into active_count from public.poker_seats_v1 where table_id=p_table and not folded;
 if active_count<2 then raise exception 'HAND_ALREADY_WON';end if;
 if t.street='preflop' then
  update public.poker_tables_v1 set street='flop',board=jsonb_build_array(t.private_deck->(2*active_count+1),t.private_deck->(2*active_count+2),t.private_deck->(2*active_count+3)) where id=p_table;
 elsif t.street='flop' then
  update public.poker_tables_v1 set street='turn',board=board||jsonb_build_array(t.private_deck->(2*active_count+5)) where id=p_table;
 else
  update public.poker_tables_v1 set street='river',board=board||jsonb_build_array(t.private_deck->(2*active_count+7)) where id=p_table;
 end if;
 update public.poker_seats_v1 set street_bet=0,acted=false where table_id=p_table;
 select seat_no into actor from public.poker_seats_v1 where table_id=p_table and not folded and not all_in order by (seat_no-t.button+6)%6 limit 1;
 update public.poker_tables_v1 set status=case when actor is null then 'showdown' else 'playing' end,turn_index=actor,current_bet=0,min_raise=big_blind,version=version+1 where id=p_table;
 return jsonb_build_object('tableId',p_table,'version',t.version+1,'street',(select street from public.poker_tables_v1 where id=p_table));
end $$;
create or replace function public.poker_settle_v1(p_table uuid,p_version bigint,p_awards jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare t public.poker_tables_v1%rowtype;pot bigint;awarded bigint;award record;seat_count int;alive int;
begin
 select * into t from public.poker_tables_v1 where id=p_table for update;
 if not found or t.status<>'showdown' or t.street<>'river' or t.version<>p_version then raise exception 'NOT_SETTLEABLE';end if;
 select coalesce(sum(committed),0) into pot from public.poker_seats_v1 where table_id=p_table;
 select coalesce(sum((a.value->>'chips')::bigint),0) into awarded from jsonb_array_elements(p_awards) a;
 if jsonb_typeof(p_awards)<>'array' or awarded<>pot then raise exception 'INVALID_POT_AWARDS';end if;
 for award in select (a.value->>'seat')::int seat,(a.value->>'chips')::bigint chips from jsonb_array_elements(p_awards) a loop
  if award.chips<0 or not exists(select 1 from public.poker_seats_v1 where table_id=p_table and seat_no=award.seat and not folded) then raise exception 'INVALID_WINNER';end if;
  update public.poker_seats_v1 set stack=stack+award.chips where table_id=p_table and seat_no=award.seat;
 end loop;
 update public.poker_seats_v1 set committed=0,street_bet=0 where table_id=p_table;
 update public.poker_tables_v1 set status='complete',turn_index=null,version=version+1 where id=p_table;
 return jsonb_build_object('tableId',p_table,'version',p_version+1,'settled',true,'pot',pot);
end $$;
revoke all on function public.poker_advance_v1(uuid),public.poker_settle_v1(uuid,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.poker_advance_v1(uuid),public.poker_settle_v1(uuid,bigint,jsonb) to service_role;

