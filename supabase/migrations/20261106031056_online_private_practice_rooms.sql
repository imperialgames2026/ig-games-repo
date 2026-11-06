-- Nonfinancial private practice rooms. Raw state never has client table grants.
create table public.ig_pvp_review_rooms (
 id uuid primary key,
 owner_id uuid not null references auth.users(id),
 game text not null check (game in ('chess','rummy','rummy6','spades','battleship','battleship6')),
 revision bigint not null check (revision >= 1),
 data jsonb not null check (jsonb_typeof(data)='object'),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index ig_pvp_review_rooms_owner_idx on public.ig_pvp_review_rooms(owner_id);
create table public.ig_pvp_review_receipts (
 actor_id uuid not null references auth.users(id),
 request_id uuid not null,
 room_id uuid not null references public.ig_pvp_review_rooms(id),
 payload jsonb not null,
 receipt jsonb not null,
 created_at timestamptz not null default now(),
 primary key (actor_id,request_id)
);
create index ig_pvp_review_receipts_actor_time_idx on public.ig_pvp_review_receipts(actor_id,created_at desc);
alter table public.ig_pvp_review_rooms enable row level security;
alter table public.ig_pvp_review_receipts enable row level security;
revoke all on public.ig_pvp_review_rooms,public.ig_pvp_review_receipts from public,anon,authenticated,service_role;
create function public.ig_pvp_review_eligible(p_actor uuid) returns text language plpgsql security definer set search_path=pg_catalog,public as $$
declare r text;
begin
 select ur.role::text into r from public.profiles p join public.user_roles ur on ur.user_id=p.id join auth.users u on u.id=p.id where p.id=p_actor and p.is_excluded=false and u.email_confirmed_at is not null;
 if r is null or r not in ('player','tester','admin','superadmin') then raise exception 'ACCOUNT_NOT_ELIGIBLE' using errcode='42501'; end if;
 return r;
end $$;
create function public.ig_pvp_review_read(p_actor uuid,p_room uuid default null,p_request uuid default null) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare r public.ig_pvp_review_rooms; rec public.ig_pvp_review_receipts;
begin
 perform public.ig_pvp_review_eligible(p_actor);
 if p_request is not null then select * into rec from public.ig_pvp_review_receipts where actor_id=p_actor and request_id=p_request; end if;
 if rec.request_id is not null then p_room=rec.room_id; end if;
 if p_room is null then return jsonb_build_object('room',null,'receipt',null); end if;
 select * into r from public.ig_pvp_review_rooms where id=p_room;
 if r.id is null then raise exception 'ROOM_NOT_FOUND' using errcode='P0001'; end if;
 if not (r.data->'members' @> jsonb_build_array(p_actor::text)) then raise exception 'ROOM_MEMBERSHIP_REQUIRED' using errcode='42501'; end if;
 return jsonb_build_object('room',r.data,'receipt',rec.receipt,'payload',rec.payload);
end $$;
create function public.ig_pvp_review_commit(p_actor uuid,p_request uuid,p_payload jsonb,p_room jsonb,p_expected bigint) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
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
 if (p_payload->>'requestId')::uuid<>p_request or p_room->>'game' not in ('chess','rummy','rummy6','spades','battleship','battleship6') then raise exception 'INVALID_REQUEST'; end if;
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
revoke all on function public.ig_pvp_review_eligible(uuid),public.ig_pvp_review_read(uuid,uuid,uuid),public.ig_pvp_review_commit(uuid,uuid,jsonb,jsonb,bigint) from public,anon,authenticated;
grant execute on function public.ig_pvp_review_read(uuid,uuid,uuid),public.ig_pvp_review_commit(uuid,uuid,jsonb,jsonb,bigint) to service_role;
comment on table public.ig_pvp_review_rooms is 'Private online practice state; no wallet, wagers, purchased chips, payouts or redemption.';
