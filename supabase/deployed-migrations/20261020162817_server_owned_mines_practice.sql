-- Mines practice: the board and server seed are never sent during an active round.
create table public.ig_mines_practice_rounds (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 mine_count integer not null check(mine_count between 1 and 24),
 server_seed text not null,
 server_seed_hash text not null,
 client_seed text,
 mines integer[],
 picks integer[] not null default '{}',
 phase text not null default 'committed' check(phase in ('committed','active','ended')),
 end_reason text check(end_reason in ('mine','cleared','stopped')),
 version integer not null default 0 check(version between 0 and 27),
 receipts jsonb not null default '{}',
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 check((phase='committed' and client_seed is null and mines is null) or
       (phase<>'committed' and client_seed is not null and cardinality(mines)=mine_count)),
 check((phase='ended')=(end_reason is not null))
);
create index ig_mines_practice_owner_time on public.ig_mines_practice_rounds(user_id,created_at desc);
create unique index ig_mines_practice_one_active on public.ig_mines_practice_rounds(user_id) where phase='active';
alter table public.ig_mines_practice_rounds enable row level security;
revoke all on public.ig_mines_practice_rounds from public,anon,authenticated;
grant select,insert,update on public.ig_mines_practice_rounds to service_role;

create or replace function internal.mines_practice_board(p_seed text,p_client text,p_count integer)
returns integer[] language plpgsql immutable security invoker set search_path = ''
as $$
declare deck integer[]:=array(select generate_series(0,24)); i integer; j integer; tmp integer;
 b bigint; sample_limit bigint; sample bigint; d bytea; attempt integer; result integer[];
begin
 if p_count is null or p_count not between 1 and 24 or p_seed is null or p_client is null then
  raise exception 'Invalid board inputs' using errcode='22023'; end if;
 for i in 0..p_count-1 loop
  b:=25-i; sample_limit:=(4294967296/b)*b; attempt:=0;
  loop
   d:=extensions.hmac('mines-v1:'||p_count||':'||p_client||':'||i||':'||attempt,p_seed,'sha256');
   sample:=get_byte(d,0)::bigint*16777216+get_byte(d,1)::bigint*65536+get_byte(d,2)::bigint*256+get_byte(d,3)::bigint;
   exit when sample<sample_limit;
   attempt:=attempt+1;
   if attempt>=64 then raise exception 'Sampling failed'; end if;
  end loop;
  j:=i+(sample%b)::integer;
  tmp:=deck[i+1]; deck[i+1]:=deck[j+1]; deck[j+1]:=tmp;
 end loop;
 select array_agg(n order by n) into result from unnest(deck[1:p_count]) n;
 return result;
end $$;

create or replace function internal.mines_practice_snapshot(r public.ig_mines_practice_rounds)
returns jsonb language sql immutable security invoker set search_path = ''
as $$
 select jsonb_build_object('roundId',r.id,'mineCount',r.mine_count,'phase',r.phase,'version',r.version,
  'serverSeedHash',r.server_seed_hash,'clientSeed',r.client_seed,'picks',to_jsonb(r.picks),
  'endReason',r.end_reason,'algorithm','hmac-sha256-mines-v1','practiceOnly',true)
 ||case when r.phase='ended' then jsonb_build_object('serverSeed',r.server_seed,'mines',to_jsonb(r.mines)) else '{}'::jsonb end
$$;

create or replace function internal.mines_practice(p_actor uuid,p_action text,p_round uuid default null,p_request uuid default null,
 p_version integer default null,p_cell integer default null,p_mine_count integer default null,p_client_seed text default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare r public.ig_mines_practice_rounds%rowtype; role_name text; old jsonb; payload jsonb; response jsonb;
 seed text; recent bigint; pending bigint;
begin
 if (select auth.jwt()->>'role') is distinct from 'service_role' then raise exception 'Service role required' using errcode='42501'; end if;
 if p_actor is null or p_action is null or p_action not in ('current','state','commit','start','pick','finish') then
  raise exception 'Invalid action' using errcode='22023'; end if;
 perform 1 from public.profiles where id=p_actor and is_excluded=false for share;
 if not found then raise exception 'Ineligible account' using errcode='42501'; end if;
 select role into role_name from public.user_roles where user_id=p_actor for share;
 if role_name is null or role_name not in ('player','tester','admin','superadmin') then raise exception 'Ineligible role' using errcode='42501'; end if;
 if p_action in ('current','state') then
  if p_request is not null or p_version is not null or p_cell is not null or p_mine_count is not null or p_client_seed is not null
  or (p_action='current' and p_round is not null) or (p_action='state' and p_round is null) then
   raise exception 'Unexpected state arguments' using errcode='22023'; end if;
  if p_action='current' then
   select * into r from public.ig_mines_practice_rounds where user_id=p_actor
    order by (phase='active') desc,created_at desc limit 1;
   if not found then return null; end if;
  else
   select * into r from public.ig_mines_practice_rounds where id=p_round and user_id=p_actor;
   if not found then raise exception 'Round not found' using errcode='P0002'; end if;
  end if;
  return internal.mines_practice_snapshot(r);
 end if;
 if role_name='tester' then raise exception 'Read-only account' using errcode='42501'; end if;
 if p_round is null then raise exception 'Round required' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('mines:'||p_actor::text,0));
 select * into r from public.ig_mines_practice_rounds where id=p_round for update;
 if found and r.user_id<>p_actor then raise exception 'Round not found' using errcode='P0002'; end if;
 if p_action='commit' then
  if p_request is not null or p_version is not null or p_cell is not null or p_client_seed is not null
  or p_mine_count is null or p_mine_count not between 1 and 24 then raise exception 'Invalid commitment' using errcode='22023'; end if;
  if r.id is null then
   if exists(select 1 from public.ig_mines_practice_rounds where user_id=p_actor and phase='active') then
    raise exception 'Finish your active round first' using errcode='23505'; end if;
   select count(*) filter(where created_at>clock_timestamp()-interval '1 minute'),count(*) filter(where phase='committed')
    into recent,pending from public.ig_mines_practice_rounds where user_id=p_actor and created_at>clock_timestamp()-interval '15 minutes';
   if recent>=60 or pending>=10 then raise exception 'Round limit reached' using errcode='54000'; end if;
   seed:=encode(extensions.gen_random_bytes(32),'hex');
   insert into public.ig_mines_practice_rounds(id,user_id,mine_count,server_seed,server_seed_hash)
    values(p_round,p_actor,p_mine_count,seed,encode(extensions.digest(seed,'sha256'),'hex')) returning * into r;
  elsif r.mine_count<>p_mine_count then raise exception 'Commitment conflict' using errcode='23505'; end if;
  return jsonb_build_object('phase','committed','roundId',r.id,'mineCount',r.mine_count,'version',0,
   'serverSeedHash',r.server_seed_hash,'algorithm','hmac-sha256-mines-v1','practiceOnly',true);
 end if;
 if r.id is null then raise exception 'Round not found' using errcode='P0002'; end if;
 if p_request is null or p_version is null or p_version not between 0 and 27 or p_mine_count is not null
 or (p_action='start' and (p_cell is not null or p_client_seed is null or length(p_client_seed) not between 1 and 128))
 or (p_action='pick' and (p_cell is null or p_cell not between 0 and 24 or p_client_seed is not null))
 or (p_action='finish' and (p_cell is not null or p_client_seed is not null)) then
  raise exception 'Invalid round action' using errcode='22023'; end if;
 payload:=jsonb_build_object('action',p_action,'version',p_version,'cell',p_cell,'clientSeed',p_client_seed);
 old:=r.receipts->p_request::text;
 if old is not null then
  if old->'payload' is distinct from payload then raise exception 'Request conflict' using errcode='23505'; end if;
  return old->'response';
 end if;
 if r.version<>p_version then raise exception 'Stale round version' using errcode='23505'; end if;
 if p_action='start' then
  if r.phase<>'committed' then raise exception 'Round already started' using errcode='22023'; end if;
  r.client_seed:=p_client_seed; r.mines:=internal.mines_practice_board(r.server_seed,p_client_seed,r.mine_count); r.phase:='active';
 else
  if r.phase<>'active' then raise exception 'Round is not active' using errcode='22023'; end if;
  if p_action='pick' then
   if p_cell=any(r.picks) then raise exception 'Tile already selected' using errcode='22023'; end if;
   r.picks:=array_append(r.picks,p_cell);
   if p_cell=any(r.mines) then r.phase:='ended'; r.end_reason:='mine';
   elsif cardinality(r.picks)=25-r.mine_count then r.phase:='ended'; r.end_reason:='cleared'; end if;
  else r.phase:='ended'; r.end_reason:='stopped'; end if;
 end if;
 r.version:=r.version+1; response:=internal.mines_practice_snapshot(r);
 update public.ig_mines_practice_rounds set client_seed=r.client_seed,mines=r.mines,picks=r.picks,phase=r.phase,
  end_reason=r.end_reason,version=r.version,updated_at=clock_timestamp(),
  receipts=receipts||jsonb_build_object(p_request::text,jsonb_build_object('payload',payload,'response',response)) where id=r.id;
 return response;
end $$;

create or replace function public.ig_mines_practice(p_actor uuid,p_action text,p_round uuid default null,p_request uuid default null,
 p_version integer default null,p_cell integer default null,p_mine_count integer default null,p_client_seed text default null)
returns jsonb language sql security invoker set search_path = ''
as $$ select internal.mines_practice(p_actor,p_action,p_round,p_request,p_version,p_cell,p_mine_count,p_client_seed) $$;
revoke all on function internal.mines_practice_board(text,text,integer),internal.mines_practice_snapshot(public.ig_mines_practice_rounds),
 internal.mines_practice(uuid,text,uuid,uuid,integer,integer,integer,text),public.ig_mines_practice(uuid,text,uuid,uuid,integer,integer,integer,text) from public,anon,authenticated;
grant execute on function internal.mines_practice_board(text,text,integer),internal.mines_practice_snapshot(public.ig_mines_practice_rounds),
 internal.mines_practice(uuid,text,uuid,uuid,integer,integer,integer,text),public.ig_mines_practice(uuid,text,uuid,uuid,integer,integer,integer,text) to service_role;
