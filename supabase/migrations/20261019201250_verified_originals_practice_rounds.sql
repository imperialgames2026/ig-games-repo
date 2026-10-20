-- Proof-backed practice outcomes. Deliberately separate from all monetary/chip ledgers.
create table public.ig_originals_practice_rounds (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 game text not null check(game in ('coin','hashdice','limbo','plinko','wheel')),
 server_seed text not null,
 server_seed_hash text not null,
 client_seed text,
 outcome jsonb,
 created_at timestamptz not null default clock_timestamp(),
 revealed_at timestamptz,
 check((revealed_at is null and client_seed is null and outcome is null)
    or (revealed_at is not null and client_seed is not null and outcome is not null))
);
create index ig_originals_practice_owner_time on public.ig_originals_practice_rounds(user_id,created_at desc);
alter table public.ig_originals_practice_rounds enable row level security;
revoke all on public.ig_originals_practice_rounds from public,anon,authenticated;
grant select,insert,update on public.ig_originals_practice_rounds to service_role;

create or replace function internal.originals_practice_outcome(p_seed text,p_client text,p_game text)
returns jsonb language plpgsql immutable security invoker set search_path = ''
as $$
declare
 bound bigint; sample_limit bigint; sample bigint; digest bytea; counter integer:=0; offset_no integer;
 samples bigint[]:='{}'; needed integer; bin integer:=0; multiplier numeric;
begin
 if p_game is null or p_game not in ('coin','hashdice','limbo','plinko','wheel') then
  raise exception 'Invalid game' using errcode='22023'; end if;
 bound:=case p_game when 'hashdice' then 100000 when 'wheel' then 20 when 'limbo' then 4294967296 else 2 end;
 sample_limit:=(4294967296/bound)*bound;
 needed:=case when p_game='plinko' then 12 else 1 end;
 while cardinality(samples)<needed loop
  if counter>=64 then raise exception 'Sampling failed'; end if;
  digest:=extensions.hmac(p_game||':'||p_client||':0:'||counter::text,p_seed,'sha256');
  counter:=counter+1;
  for offset_no in 0..7 loop
   sample:=get_byte(digest,offset_no*4)::bigint*16777216+get_byte(digest,offset_no*4+1)::bigint*65536
    +get_byte(digest,offset_no*4+2)::bigint*256+get_byte(digest,offset_no*4+3)::bigint;
   if sample<sample_limit then samples:=array_append(samples,sample%bound); end if;
   exit when cardinality(samples)>=needed;
  end loop;
 end loop;
 if p_game='coin' then return jsonb_build_object('coin',case when samples[1]=0 then 'heads' else 'tails' end);
 elsif p_game='hashdice' then return jsonb_build_object('roll',samples[1]);
 elsif p_game='limbo' then
  multiplier:=greatest(1,least(1000000,floor(98::numeric*4294967296/(4294967296-samples[1]))/100));
  return jsonb_build_object('multiplier',multiplier);
 elsif p_game='wheel' then return jsonb_build_object('segment',samples[1],'color',(array['gold','blue','pink','purple'])[samples[1]%4+1]);
 else
  select sum(n) into bin from unnest(samples) n;
  return jsonb_build_object('path',to_jsonb(samples),'bin',bin,'rows',12);
 end if;
end $$;
revoke all on function internal.originals_practice_outcome(text,text,text) from public,anon,authenticated;
grant execute on function internal.originals_practice_outcome(text,text,text) to service_role;

create or replace function internal.originals_practice(p_actor uuid,p_action text,p_game text,p_round uuid default null,p_client_seed text default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
 role_name text; r public.ig_originals_practice_rounds%rowtype; seed text; commitment text;
 total_recent bigint; pending bigint; history jsonb; result jsonb;
begin
 if (select auth.jwt()->>'role') is distinct from 'service_role' then raise exception 'Service role required' using errcode='42501'; end if;
 if p_actor is null or p_action is null or p_action not in ('commit','reveal','history') or p_game is null
 or p_game not in ('coin','hashdice','limbo','plinko','wheel') then raise exception 'Invalid request' using errcode='22023'; end if;
 perform 1 from public.profiles where id=p_actor and is_excluded=false for share;
 if not found then raise exception 'Ineligible account' using errcode='42501'; end if;
 select role into role_name from public.user_roles where user_id=p_actor for share;
 if role_name is null or role_name not in ('player','tester','admin','superadmin') then
  raise exception 'Ineligible role' using errcode='42501'; end if;
 if p_action='history' then
  if p_round is not null or p_client_seed is not null then raise exception 'Unexpected history arguments' using errcode='22023'; end if;
  select coalesce(jsonb_agg(q.proof order by q.revealed_at desc),'[]') into history from (
   select revealed_at,jsonb_build_object('phase','revealed','roundId',id,'game',game,'nonce',0,
    'serverSeed',server_seed,'serverSeedHash',server_seed_hash,'clientSeed',client_seed,'outcome',outcome,
    'algorithm','hmac-sha256-v3','practiceOnly',true) proof
   from public.ig_originals_practice_rounds where user_id=p_actor and game=p_game and revealed_at is not null
   order by revealed_at desc limit 30
  ) q;
  return jsonb_build_object('rounds',history,'practiceOnly',true);
 end if;
 if role_name='tester' then raise exception 'Read-only account' using errcode='42501'; end if;
 if p_round is null then raise exception 'Round ID required' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('originals:'||p_actor::text,0));
 select * into r from public.ig_originals_practice_rounds where id=p_round for update;
 if found and (r.user_id<>p_actor or r.game<>p_game) then raise exception 'Round conflict' using errcode='23505'; end if;
 if p_action='commit' then
  if p_client_seed is not null then raise exception 'Unexpected commitment arguments' using errcode='22023'; end if;
  if r.id is null then
   select count(*) filter(where created_at>clock_timestamp()-interval '1 minute'),
    count(*) filter(where revealed_at is null) into total_recent,pending
   from public.ig_originals_practice_rounds where user_id=p_actor and created_at>clock_timestamp()-interval '15 minutes';
   if total_recent>=60 or pending>=10 then raise exception 'Round limit reached; reveal a pending round or wait' using errcode='54000'; end if;
   seed:=encode(extensions.gen_random_bytes(32),'hex');
   commitment:=encode(extensions.digest(seed,'sha256'),'hex');
   insert into public.ig_originals_practice_rounds(id,user_id,game,server_seed,server_seed_hash)
   values(p_round,p_actor,p_game,seed,commitment) returning * into r;
  end if;
  return jsonb_build_object('phase','committed','id',r.id,'game',r.game,'server_seed_hash',r.server_seed_hash,
   'nonce',0,'algorithm','hmac-sha256-v3','practiceOnly',true);
 end if;
 if r.id is null then raise exception 'Round not found' using errcode='P0002'; end if;
 if p_client_seed is null or length(p_client_seed) not between 1 and 128 then raise exception 'Invalid client seed' using errcode='22023'; end if;
 if r.revealed_at is not null and r.client_seed is distinct from p_client_seed then
  raise exception 'Client seed conflict' using errcode='23505'; end if;
 if r.revealed_at is null then
  result:=internal.originals_practice_outcome(r.server_seed,p_client_seed,p_game);
  update public.ig_originals_practice_rounds set client_seed=p_client_seed,outcome=result,revealed_at=clock_timestamp()
  where id=r.id returning * into r;
 end if;
 return jsonb_build_object('phase','revealed','roundId',r.id,'game',r.game,'nonce',0,
  'serverSeed',r.server_seed,'serverSeedHash',r.server_seed_hash,'clientSeed',r.client_seed,'outcome',r.outcome,
  'algorithm','hmac-sha256-v3','practiceOnly',true);
end $$;
revoke all on function internal.originals_practice(uuid,text,text,uuid,text) from public,anon,authenticated;
grant execute on function internal.originals_practice(uuid,text,text,uuid,text) to service_role;

create or replace function public.ig_originals_practice(p_actor uuid,p_action text,p_game text,p_round uuid default null,p_client_seed text default null)
returns jsonb language sql security invoker set search_path = ''
as $$ select internal.originals_practice(p_actor,p_action,p_game,p_round,p_client_seed) $$;
revoke all on function public.ig_originals_practice(uuid,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.ig_originals_practice(uuid,text,text,uuid,text) to service_role;
