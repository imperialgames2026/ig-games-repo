-- Free practice only. Never reads or writes a wallet, ledger or prize balance.
create table public.ig_final_practice_rounds(
 id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,
 game text not null check(game in ('darts','dicezone','hilo','towers')),
 options jsonb not null,server_seed text not null,server_hash text not null,client_seed text,
 phase text not null default 'committed' check(phase in ('committed','active','ended')),
 version integer not null default 0,history jsonb not null default '[]',outcome jsonb,
 end_reason text,receipts jsonb not null default '{}',created_at timestamptz not null default now()
);
create index ig_final_practice_owner_time on public.ig_final_practice_rounds(user_id,game,created_at desc);
create unique index ig_final_practice_one_active on public.ig_final_practice_rounds(user_id,game) where phase<>'ended';
alter table public.ig_final_practice_rounds enable row level security;
revoke all on public.ig_final_practice_rounds from public,anon,authenticated;
grant select,insert,update on public.ig_final_practice_rounds to service_role;

create function internal.final_practice_sample(seed text,client text,game text,step integer,bound integer)
returns integer language plpgsql immutable security invoker set search_path='' as $$
declare mac bytea; n bigint; lim bigint:=(4294967296/bound)*bound;
begin
 if bound<1 or step<0 then raise exception 'Invalid sample';end if;
 for attempt in 0..63 loop
  mac:=extensions.hmac('final-v1:'||game||':'||client||':'||step||':'||attempt,seed,'sha256');
  n:=get_byte(mac,0)::bigint*16777216+get_byte(mac,1)::bigint*65536+get_byte(mac,2)::bigint*256+get_byte(mac,3);
  if n<lim then return (n%bound)::integer;end if;
 end loop;
 raise exception 'Sampling failed';
end $$;

create function internal.final_practice_card(seed text,client text,step integer)
returns jsonb language sql immutable security invoker set search_path='' as $$
 select jsonb_build_object('rank',n/4+1,'suit',n%4) from (select internal.final_practice_sample(seed,client,'hilo',step,52) n) q
$$;

create function internal.final_practice_layout(seed text,client text,difficulty text)
returns jsonb language plpgsql immutable security invoker set search_path='' as $$
declare result jsonb:='[]';tiles integer[];j integer;tmp integer; mines integer:=case when difficulty='easy' then 1 else 2 end;
begin
 for level in 0..8 loop
  tiles:=array[0,1,2];
  for i in 0..mines-1 loop
   j:=i+internal.final_practice_sample(seed,client,'towers',level*3+i,3-i);
   tmp:=tiles[i+1];tiles[i+1]:=tiles[j+1];tiles[j+1]:=tmp;
  end loop;
  result:=result||jsonb_build_array(to_jsonb(tiles[1:mines]));
 end loop;
 return result;
end $$;

create function internal.final_practice_snapshot(r public.ig_final_practice_rounds)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 result:=jsonb_build_object('roundId',r.id,'game',r.game,'options',r.options,'phase',r.phase,'version',r.version,
 'serverSeedHash',r.server_hash,'clientSeed',r.client_seed,'history',r.history,'outcome',r.outcome,
 'endReason',r.end_reason,'algorithm','hmac-sha256-final-v1','practiceOnly',true);
 if r.phase='ended' then
  result:=result||jsonb_build_object('serverSeed',r.server_seed);
  if r.game='towers' then result:=result||jsonb_build_object('layout',internal.final_practice_layout(r.server_seed,r.client_seed,r.options->>'difficulty'));end if;
 end if;
 return result;
end $$;

create function internal.final_practice(p_actor uuid,p_action text,p_game text,p_round uuid default null,p_request uuid default null,
 p_version integer default null,p_options jsonb default null,p_client text default null,p_choice text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.ig_final_practice_rounds%rowtype;role_name text; payload jsonb;result jsonb; prior jsonb;
 n integer; idx integer; rank_before integer; rank_after integer; won boolean; layout jsonb; weights integer[]; mult numeric[]; cursor_no integer:=0;
begin
 if (select auth.jwt()->>'role') is distinct from 'service_role' then raise exception 'Server operation required' using errcode='42501';end if;
 if p_game is null or p_game not in ('darts','dicezone','hilo','towers') or p_action is null or p_action not in ('current','commit','start','move','finish') or p_actor is null then raise exception 'Invalid request' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('final:'||p_actor||':'||p_game,0));
 perform 1 from public.profiles p join public.user_roles u on u.user_id=p.id join auth.users a on a.id=p.id
 where p.id=p_actor and not p.is_excluded and not coalesce(a.is_anonymous,false) for share of p,u;
 if not found then raise exception 'Account ineligible' using errcode='42501';end if;
 select role into role_name from public.user_roles where user_id=p_actor;
 if role_name is null or role_name not in ('player','tester','admin','superadmin') then raise exception 'Role ineligible' using errcode='42501';end if;
 if p_action='current' then
  if p_round is not null or p_request is not null or p_version is not null or p_options is not null or p_client is not null or p_choice is not null then raise exception 'Unexpected fields' using errcode='22023';end if;
  select * into r from public.ig_final_practice_rounds where user_id=p_actor and game=p_game order by (phase<>'ended') desc,created_at desc limit 1;
  return case when r.id is null then null else internal.final_practice_snapshot(r) end;
 end if;
 if role_name='tester' then raise exception 'Read-only account' using errcode='42501';end if;
 if p_round is null then raise exception 'Round required' using errcode='22023';end if;
 select * into r from public.ig_final_practice_rounds where id=p_round for update;
 if r.id is not null and (r.user_id<>p_actor or r.game<>p_game) then raise exception 'Round conflict' using errcode='23505';end if;
 if p_action='commit' then
  if p_options is null or jsonb_typeof(p_options)<>'object' or p_request is not null or p_version is not null or p_client is not null or p_choice is not null then raise exception 'Invalid commit' using errcode='22023';end if;
  if (p_game='darts' and (p_options- 'difficulty'<>'{}' or p_options->>'difficulty' is null or p_options->>'difficulty' not in ('easy','medium','hard','expert')))
   or (p_game='towers' and (p_options-'difficulty'<>'{}' or p_options->>'difficulty' is null or p_options->>'difficulty' not in ('easy','hard')))
   or (p_game='hilo' and p_options<>'{}') then raise exception 'Invalid options' using errcode='22023';end if;
  if p_game='dicezone' then
   if p_options-array['start','end']<>'{}' or jsonb_typeof(p_options->'start') is distinct from 'number' or jsonb_typeof(p_options->'end') is distinct from 'number' then raise exception 'Invalid zone' using errcode='22023';end if;
   if (p_options->>'start')::numeric<>trunc((p_options->>'start')::numeric) or (p_options->>'end')::numeric<>trunc((p_options->>'end')::numeric)
    or (p_options->>'start')::numeric<1 or (p_options->>'end')::numeric>100 or (p_options->>'start')::numeric>(p_options->>'end')::numeric then raise exception 'Invalid zone' using errcode='22023';end if;
  end if;
  if r.id is not null then
   if r.options is distinct from p_options then raise exception 'Commit conflict' using errcode='23505';end if;
   -- Return the original commitment only, even after the round has progressed.
   return jsonb_build_object('roundId',r.id,'game',r.game,'options',r.options,'phase','committed','version',0,'serverSeedHash',r.server_hash,'clientSeed',null,'history','[]'::jsonb,'outcome',null,'endReason',null,'algorithm','hmac-sha256-final-v1','practiceOnly',true);
  end if;
  if exists(select 1 from public.ig_final_practice_rounds where user_id=p_actor and game=p_game and phase<>'ended') then raise exception 'Resume active round' using errcode='23505';end if;
  if (select count(*) from public.ig_final_practice_rounds where user_id=p_actor and created_at>now()-interval '1 minute')>=60 then raise exception 'Round limit reached' using errcode='54000';end if;
  insert into public.ig_final_practice_rounds(id,user_id,game,options,server_seed,server_hash)
  values(p_round,p_actor,p_game,p_options,encode(extensions.gen_random_bytes(32),'hex'),'pending') returning * into r;
  update public.ig_final_practice_rounds set server_hash=encode(extensions.digest(r.server_seed,'sha256'),'hex') where id=r.id returning * into r;
  return internal.final_practice_snapshot(r);
 end if;
 if r.id is null then raise exception 'Round not found' using errcode='P0002';end if;
 if p_request is null or p_version is null or p_options is not null or (p_action<>'start' and p_client is not null) or (p_action<>'move' and p_choice is not null) then raise exception 'Invalid mutation' using errcode='22023';end if;
 payload:=jsonb_build_object('action',p_action,'version',p_version,'client',p_client,'choice',p_choice);
 prior:=r.receipts->p_request::text;
 if prior is not null then
  if prior->'payload' is distinct from payload then raise exception 'Retry conflict' using errcode='23505';end if;
  return prior->'result';
 end if;
 if r.version<>p_version then raise exception 'Stale version' using errcode='23505';end if;
 if p_action='start' then
  if r.phase<>'committed' or p_client is null or length(p_client) not between 1 and 128 then raise exception 'Invalid start' using errcode='22023';end if;
  r.client_seed:=p_client;r.phase:='active';
  if r.game='hilo' then r.outcome:=internal.final_practice_card(r.server_seed,p_client,0);
  elsif r.game='dicezone' then
   n:=1+internal.final_practice_sample(r.server_seed,p_client,'dicezone',0,100);
   r.outcome:=jsonb_build_object('roll',n,'won',n between (r.options->>'start')::integer and (r.options->>'end')::integer);
   r.phase:='ended';r.end_reason:='completed';
  elsif r.game='darts' then
   n:=internal.final_practice_sample(r.server_seed,p_client,'darts',0,100);
   case r.options->>'difficulty'
    when 'easy' then weights:=array[34,26,18,12,7,3];mult:=array[0.5,0.8,1.2,1.5,2.7,8.5];
    when 'medium' then weights:=array[35,25,18,12,7,3];mult:=array[0.4,0.6,1.3,3.1,6,16];
    when 'hard' then weights:=array[38,24,17,11,7,3];mult:=array[0.2,0.5,2.5,3.6,8.8,63];
    else weights:=array[40,25,16,10,7,2];mult:=array[0.1,0.5,4.8,9.6,42,500];end case;
   for i in 1..6 loop cursor_no:=cursor_no+weights[i];if n<cursor_no then idx:=i-1;exit;end if;end loop;
   r.outcome:=jsonb_build_object('zone',idx,'multiplier',mult[idx+1]);r.phase:='ended';r.end_reason:='completed';
  end if;
 elsif p_action='finish' then
  if r.phase<>'active' then raise exception 'Round inactive' using errcode='22023';end if;
  r.phase:='ended';r.end_reason:='stopped';
 else
  if r.phase<>'active' or r.game not in ('hilo','towers') then raise exception 'Move unavailable' using errcode='22023';end if;
  n:=jsonb_array_length(r.history);
  if r.game='towers' then
   if p_choice is null or p_choice not in ('0','1','2') or n>=9 then raise exception 'Invalid tile' using errcode='22023';end if;
   layout:=internal.final_practice_layout(r.server_seed,r.client_seed,r.options->>'difficulty');
   won:=not (layout->n @> to_jsonb(p_choice::integer));
   r.history:=r.history||jsonb_build_array(jsonb_build_object('tile',p_choice::integer,'safe',won));
   if not won or n=8 then r.phase:='ended';r.end_reason:=case when won then 'cleared' else 'lost' end;end if;
  else
   if p_choice is null or p_choice not in ('higherOrSame','lowerOrSame','same') or n>=50 then raise exception 'Invalid prediction' using errcode='22023';end if;
   rank_before:=(r.outcome->>'rank')::integer;
   r.outcome:=internal.final_practice_card(r.server_seed,r.client_seed,n+1);rank_after:=(r.outcome->>'rank')::integer;
   won:=case p_choice when 'higherOrSame' then rank_after>=rank_before when 'lowerOrSame' then rank_after<=rank_before else rank_after=rank_before end;
   r.history:=r.history||jsonb_build_array(jsonb_build_object('choice',p_choice,'card',r.outcome,'won',won));
   if not won or n=49 then r.phase:='ended';r.end_reason:=case when won then 'cleared' else 'lost' end;end if;
  end if;
 end if;
 r.version:=r.version+1;result:=internal.final_practice_snapshot(r);
 r.receipts:=r.receipts||jsonb_build_object(p_request::text,jsonb_build_object('payload',payload,'result',result));
 update public.ig_final_practice_rounds set client_seed=r.client_seed,phase=r.phase,version=r.version,history=r.history,outcome=r.outcome,end_reason=r.end_reason,receipts=r.receipts where id=r.id;
 return result;
end $$;
revoke all on function internal.final_practice_sample(text,text,text,integer,integer),internal.final_practice_card(text,text,integer),internal.final_practice_layout(text,text,text),internal.final_practice_snapshot(public.ig_final_practice_rounds),internal.final_practice(uuid,text,text,uuid,uuid,integer,jsonb,text,text) from public,anon,authenticated;
grant execute on function internal.final_practice_sample(text,text,text,integer,integer),internal.final_practice_card(text,text,integer),internal.final_practice_layout(text,text,text),internal.final_practice_snapshot(public.ig_final_practice_rounds),internal.final_practice(uuid,text,text,uuid,uuid,integer,jsonb,text,text) to service_role;
create function public.ig_final_practice(p_actor uuid,p_action text,p_game text,p_round uuid default null,p_request uuid default null,p_version integer default null,p_options jsonb default null,p_client text default null,p_choice text default null)
returns jsonb language sql security invoker set search_path='' as $$ select internal.final_practice(p_actor,p_action,p_game,p_round,p_request,p_version,p_options,p_client,p_choice) $$;
revoke all on function public.ig_final_practice(uuid,text,text,uuid,uuid,integer,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.ig_final_practice(uuid,text,text,uuid,uuid,integer,jsonb,text,text) to service_role;
