set lock_timeout='5s';
set statement_timeout='30s';
alter table public.ig_pvp_review_rooms drop constraint ig_pvp_review_rooms_game_check;
alter table public.ig_pvp_review_rooms add constraint ig_pvp_review_rooms_game_check check (game in ('chess','rummy','rummy6','spades','battleship','battleship6','checkers','dominoes','euchre','hearts','pinochle','connectfour','backgammon','reversi','gomoku','words','poker2','poker4','poker6','poker7','poker8','poker9','omaha2','omaha4','omaha6','omaha7','omaha8','omaha9','pineapple6','crazy6','lazy6','stud5','draw5','triple27','blackjack','roulette','craps','baccarat'));
create or replace function public.ig_pvp_review_commit(p_actor uuid,p_request uuid,p_payload jsonb,p_room jsonb,p_expected bigint) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare role_name text; existing public.ig_pvp_review_rooms; rec public.ig_pvp_review_receipts; rid uuid; result jsonb; op text;
begin
 role_name=public.ig_pvp_review_eligible(p_actor);
 if role_name='tester' then raise exception 'READ_ONLY_ROLE' using errcode='42501'; end if;
 if p_request is null or p_payload is null or p_room is null or octet_length(p_payload::text)>16384 or octet_length(p_room::text)>1048576 then raise exception 'INVALID_REQUEST'; end if;
 -- Serialize each actor's receipts; then compare-and-swap under the room lock.
 perform pg_advisory_xact_lock(hashtextextended(p_actor::text,617));
 select * into rec from public.ig_pvp_review_receipts where actor_id=p_actor and request_id=p_request;
 if found then
  if rec.payload<>p_payload then raise exception 'REQUEST_PAYLOAD_CONFLICT'; end if;
  return public.ig_pvp_review_read(p_actor,rec.room_id,p_request);
 end if;
 if (select count(*) from public.ig_pvp_review_receipts where actor_id=p_actor and created_at>now()-interval '1 minute')>=240 then raise exception 'ACTION_LIMIT_REACHED'; end if;
 op=p_payload->>'op';rid=(p_room->>'id')::uuid;
 if (p_payload->>'requestId')::uuid<>p_request or p_room->>'game' not in ('chess','rummy','rummy6','spades','battleship','battleship6','checkers','dominoes','euchre','hearts','pinochle','connectfour','backgammon','reversi','gomoku','words','poker2','poker4','poker6','poker7','poker8','poker9','omaha2','omaha4','omaha6','omaha7','omaha8','omaha9','pineapple6','crazy6','lazy6','stud5','draw5','triple27','blackjack','roulette','craps','baccarat') then raise exception 'INVALID_REQUEST'; end if;
 if p_expected=0 then
  if op<>'create' or p_room->>'owner'<>p_actor::text or (p_room->>'version')::bigint<>1 or p_room->'members'<>jsonb_build_array(p_actor::text) or p_room->'seats'->>0<>p_actor::text then raise exception 'INVALID_REQUEST'; end if;
  if (select count(*) from public.ig_pvp_review_rooms where owner_id=p_actor and created_at>now()-interval '24 hours')>=20 then raise exception 'ROOM_LIMIT_REACHED'; end if;
  insert into public.ig_pvp_review_rooms(id,owner_id,game,revision,data) values(rid,p_actor,p_room->>'game',1,p_room);
 else
  select * into existing from public.ig_pvp_review_rooms where id=rid for update;
  if existing.id is null then raise exception 'ROOM_NOT_FOUND'; end if;
  if not(existing.data->'members' @> jsonb_build_array(p_actor::text)) then raise exception 'ROOM_MEMBERSHIP_REQUIRED' using errcode='42501'; end if;
  if existing.revision<>p_expected then raise exception 'ROOM_VERSION_CONFLICT'; end if;
  if (p_payload->>'roomId')::uuid<>rid or (p_payload->>'expectedVersion')::bigint<>p_expected or (p_room->>'version')::bigint<>p_expected+1 or p_room->>'game'<>existing.game or p_room->>'owner'<>existing.owner_id::text then raise exception 'INVALID_REQUEST'; end if;
  if op='invite' then
   if existing.owner_id<>p_actor then raise exception 'OWNER_REQUIRED' using errcode='42501'; end if;
   perform public.ig_pvp_review_eligible((p_payload->>'targetId')::uuid);
   if jsonb_array_length(p_room->'members')>64 then raise exception 'ROOM_LIMIT_REACHED'; end if;
  elsif op not in ('join','action') then raise exception 'INVALID_REQUEST'; end if;
  update public.ig_pvp_review_rooms set revision=p_expected+1,data=p_room,updated_at=now() where id=rid;
 end if;
 result=jsonb_build_object('protocol','ig.pvp.receipt.v1','requestId',p_request,'roomId',rid,'operation',op,'version',(p_room->>'version')::bigint);
 insert into public.ig_pvp_review_receipts(actor_id,request_id,room_id,payload,receipt) values(p_actor,p_request,rid,p_payload,result);
 return jsonb_build_object('room',p_room,'receipt',result);
end $$;
