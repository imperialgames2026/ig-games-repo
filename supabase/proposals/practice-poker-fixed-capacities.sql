-- REVIEW ONLY: supersedes practice-tournament-eight-seat-entries.sql.
-- ONE approved transaction, AFTER journal hooks, BEFORE receipt binding/resolver.
-- Fixed NLHE formats2/4/6/8/9; occupied count may be any2..selected capacity.
-- Omaha remains configured6. No money/RLS/auth/deployed metadata changes.
-- Existing unsupported configured formats abort; never silently convert7 to8.
do $$begin
 if exists(select 1 from public.poker_events_v1 where game='nl_holdem'
  and coalesce((config->>'seatsPerTable')::int,0) not in (2,4,6,8,9))
 or exists(select 1 from public.ig_poker_tournament_presets where
  seats_per_table not in (2,4,6,8,9) or (variant='omaha' and seats_per_table<>6)) then
  raise exception 'EXISTING_FORMAT_REQUIRES_EXPLICIT_REVIEW';
 end if;
end $$;
alter table public.poker_events_v1 add constraint poker_event_fixed_capacity
 check(game<>'nl_holdem' or coalesce((config->>'seatsPerTable')::int,0) in (2,4,6,8,9));
alter table public.poker_tables_v1 add column seat_capacity integer;
update public.poker_tables_v1 t set seat_capacity=case when t.variant='omaha' then 6
 when t.event_id is null then 8 else (select (e.config->>'seatsPerTable')::int from public.poker_events_v1 e where e.id=t.event_id) end;
alter table public.poker_tables_v1 alter column seat_capacity set not null,
 add constraint poker_table_fixed_capacity check((variant='holdem' and seat_capacity in (2,4,6,8,9)) or (variant='omaha' and seat_capacity=6));
alter table public.poker_event_entries_v1 drop constraint poker_event_entries_v1_seat_no_check,
 add constraint poker_event_entries_v1_seat_no_check check(seat_no between 0 and 8);
alter table public.poker_seats_v1 drop constraint poker_seats_v1_seat_no_check,
 add constraint poker_seats_v1_seat_no_check check(seat_no between 0 and 8);
alter table public.ig_poker_tournament_presets drop constraint ig_poker_tournament_presets_seats_per_table_check,
 add constraint ig_poker_tournament_presets_seats_per_table_check check(seats_per_table in (2,4,6,8,9));
create schema ig_practice_table_config;
revoke all on schema ig_practice_table_config from public,anon,authenticated,service_role;
create function ig_practice_table_config.initialize_capacity() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' and new.seat_capacity is distinct from old.seat_capacity and
 (old.hand_no>0 or exists(select 1 from public.poker_seats_v1 where table_id=old.id and user_id<>old.owner_id)) then
  raise exception 'TABLE_CAPACITY_LOCKED';
 end if;
 if new.seat_capacity is null then
  if new.event_id is not null then select (config->>'seatsPerTable')::int into new.seat_capacity from public.poker_events_v1 where id=new.event_id;
  else new.seat_capacity:=case when new.variant='omaha' then 6 else 8 end;end if;
 end if;
 return new;
end $$;
create trigger practice_table_capacity before insert or update of seat_capacity on public.poker_tables_v1
 for each row execute function ig_practice_table_config.initialize_capacity();
create function ig_practice_table_config.enforce_seat() returns trigger
language plpgsql security invoker set search_path='' as $$
declare capacity integer;
begin
 select seat_capacity into strict capacity from public.poker_tables_v1 where id=new.table_id;
 if new.seat_no<0 or new.seat_no>=capacity then raise exception 'SEAT_OUTSIDE_TABLE_CAPACITY' using errcode='23514';end if;
 return new;
end $$;
create trigger practice_seat_capacity before insert or update of table_id,seat_no on public.poker_seats_v1
 for each row execute function ig_practice_table_config.enforce_seat();
create function ig_practice_table_config.enforce_event_entry() returns trigger
language plpgsql security invoker set search_path='' as $$
declare capacity integer; parent_event uuid;
begin
 -- Registration is unassigned; elimination clears assignment before seat delete.
 if new.table_id is null and new.seat_no is null then
  if new.status='seated' then raise exception 'SEATED_ENTRY_REQUIRES_ASSIGNMENT' using errcode='23514';end if;
  return new;
 end if;
 if new.table_id is null or new.seat_no is null or new.status<>'seated' then
  raise exception 'INVALID_EVENT_ENTRY_ASSIGNMENT' using errcode='23514';
 end if;
 select seat_capacity,event_id into strict capacity,parent_event from public.poker_tables_v1 where id=new.table_id;
 if parent_event is distinct from new.event_id or new.seat_no<0 or new.seat_no>=capacity then
  raise exception 'ENTRY_OUTSIDE_EVENT_TABLE_CAPACITY' using errcode='23514';
 end if;
 if not exists(select 1 from public.poker_seats_v1 where table_id=new.table_id
  and user_id=new.user_id and seat_no=new.seat_no) then
  raise exception 'ENTRY_PLAYER_SEAT_MISMATCH' using errcode='23514';
 end if;
 return new;
end $$;
create trigger practice_event_entry_capacity before insert or update of event_id,user_id,status,table_id,seat_no on public.poker_event_entries_v1
 for each row execute function ig_practice_table_config.enforce_event_entry();
revoke all on all functions in schema ig_practice_table_config from public,anon,authenticated,service_role;

-- Exact body fragment patching preserves installed ledger hooks, function OID,
-- ACL, security mode, search_path and function-local context configuration.
do $patch$
declare x record;definition text;matches integer;
begin
 for x in select * from (values
 ('public.poker_join_v1(uuid,uuid)','seat_limit:=case when t.variant=''holdem'' then 8 else 6 end;','seat_limit:=t.seat_capacity;',1),
 ('public.poker_start_v2(uuid,uuid,jsonb,text,text,integer)','players>8','players>t.seat_capacity',1),
 ('public.poker_start_v2(uuid,uuid,jsonb,text,text,integer)','+8)%8','+t.seat_capacity)%t.seat_capacity',5),
 ('public.poker_capture_dealt_count_v1()','(case when new.variant=''omaha'' then 6 else 8 end)','new.seat_capacity',1),
 ('public.poker_commit_plan_v1(uuid,integer,jsonb,text,integer)','case when variant=''omaha'' then 6 else 8 end','seat_capacity',1),
 ('public.poker_advance_v1(uuid)','(case when t.variant=''omaha'' then 6 else 8 end)','t.seat_capacity',2),
 ('public.poker_action_v3(uuid,uuid,uuid,bigint,text,bigint,boolean)','(x.seat_no-s.seat_no+10)%10','(x.seat_no-s.seat_no+t.seat_capacity)%t.seat_capacity',1),
 ('public.poker_event_start_v1(uuid,uuid,bigint,uuid)','max_seats<6 OR max_seats>8','coalesce(max_seats,0) NOT IN (2,4,6,8,9) OR capacity IS NULL OR capacity<2 OR capacity>max_seats*coalesce((e.config->>''tableCount'')::int,0)',1),
 ('public.poker_event_start_v1(uuid,uuid,bigint,uuid)','(e.config->>''tableCount'')::integer NOT BETWEEN 1 AND 30','coalesce((e.config->>''tableCount'')::integer,0) NOT BETWEEN 1 AND 30',1),
 ('public.poker_event_sync_v1(uuid)','greatest(6,least(8,(e.config->>''seatsPerTable'')::int))','(e.config->>''seatsPerTable'')::int',3),
 ('public.ig_poker_tournament_preset_save(uuid,jsonb,uuid)','v_seats not between 6 and 8','coalesce(v_seats,0) not in (2,4,6,8,9)',1)
 ) a(signature,old_text,new_text,expected) loop
  select pg_get_functiondef(x.signature::regprocedure) into definition;
  matches:=(length(definition)-length(replace(definition,x.old_text,'')))/length(x.old_text);
  if matches<>x.expected then raise exception 'CAPACITY_SOURCE_MISMATCH: % expected% got%',x.signature,x.expected,matches;end if;
  execute replace(definition,x.old_text,x.new_text);
 end loop;
end $patch$;

create function public.poker_create_capacity_v1(p_owner uuid,p_variant text,p_capacity integer)
returns uuid language plpgsql security invoker set search_path='' as $$
declare result uuid;
begin
 if p_variant is null or p_capacity is null or p_variant not in ('holdem','omaha')
 or (p_variant='holdem' and p_capacity not in (2,4,6,8,9)) or (p_variant='omaha' and p_capacity<>6) then
  raise exception 'INVALID_FIXED_TABLE_CAPACITY' using errcode='22023';
 end if;
 if not exists(select 1 from public.profiles p join public.user_roles r on r.user_id=p.id
  where p.id=p_owner and not p.is_excluded and r.role in ('player','admin','superadmin')) then
  raise exception 'PLAYER_NOT_ELIGIBLE' using errcode='42501';
 end if;
 if p_variant='omaha' then result:=public.poker_create_omaha_v1(p_owner);else result:=public.poker_create_v1(p_owner);end if;
 update public.poker_tables_v1 set seat_capacity=p_capacity where id=result and owner_id=p_owner;
 return result;
end $$;
revoke all on function public.poker_create_capacity_v1(uuid,text,integer) from public,anon,authenticated;
grant execute on function public.poker_create_capacity_v1(uuid,text,integer) to service_role;
