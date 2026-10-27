-- REVIEW ONLY. Not a migration and deliberately absent from backend-manifest.json.
-- Run in ONE transaction after current-main reconciliation and runtime approval.
-- Audits existing nonredeemable game chips; creates no wallet, exchange or game.
create schema ig_practice_audit;
revoke all on schema ig_practice_audit from public,anon,authenticated,service_role;

create table ig_practice_audit.heads (
 source text not null, account_key text not null, component text not null,
 player_id uuid not null, pool text not null, balance bigint not null check(balance>=0),
 game text not null, table_id uuid, tournament_id uuid,
 revision bigint not null, primary key(source,account_key,component)
);
create table ig_practice_audit.entries (
 id bigint generated always as identity primary key,
 asset text not null default 'PRACTICE_CHIP' check(asset='PRACTICE_CHIP'),
 redeemable boolean not null default false check(not redeemable),
 source text not null, account_key text not null, component text not null,
 revision bigint not null, player_id uuid not null, pool text not null,
 game text not null, table_id uuid, tournament_id uuid, round_ref text,
 actor_id uuid, actor_kind text not null check(actor_kind in ('account','system')),
 request_ref text not null, operation text not null, reason text not null,
 kind text not null check(kind in ('opening','grant','wager','payout','escrow','retirement','adjustment','refund','reversal','relocation')),
 reverses_id bigint unique references ig_practice_audit.entries(id),
 before_units bigint not null check(before_units>=0), after_units bigint not null check(after_units>=0),
 delta bigint generated always as (after_units-before_units) stored,
 counter_delta bigint generated always as (before_units-after_units) stored,
 transaction_ref text not null default pg_current_xact_id()::text,
 recorded_at timestamptz not null default clock_timestamp(),
 unique(source,account_key,component,revision)
);
-- Zero-cost registration is an audit event, never a fabricated token debit.
create table ig_practice_audit.registrations (
 tournament_id uuid not null, player_id uuid not null, actor_id uuid,
 request_ref text not null, fee_units bigint not null check(fee_units=0),
 transaction_ref text not null default pg_current_xact_id()::text,
 recorded_at timestamptz not null default clock_timestamp(),
 primary key(tournament_id,player_id)
);
alter table ig_practice_audit.heads enable row level security;
alter table ig_practice_audit.entries enable row level security;
alter table ig_practice_audit.registrations enable row level security;
revoke all on all tables in schema ig_practice_audit from public,anon,authenticated,service_role;
revoke all on all sequences in schema ig_practice_audit from public,anon,authenticated,service_role;

create function ig_practice_audit.immutable() returns trigger
language plpgsql security invoker set search_path='' as $$
begin raise exception 'PRACTICE_JOURNAL_APPEND_ONLY'; end $$;
create trigger immutable_entries before update or delete or truncate on ig_practice_audit.entries
 for each statement execute function ig_practice_audit.immutable();
create trigger immutable_registrations before update or delete or truncate on ig_practice_audit.registrations
 for each statement execute function ig_practice_audit.immutable();

create function ig_practice_audit.post(
 s text,k text,c text,u uuid,pool_name text,g text,t uuid,e uuid,r text,
 before_value bigint,after_value bigint,why text,entry_kind text
) returns void language plpgsql security definer set search_path='' as $$
declare h ig_practice_audit.heads%rowtype; ctx jsonb; original ig_practice_audit.entries%rowtype; correction bigint;
begin
 ctx:=coalesce(nullif(current_setting('ig.practice_audit_context',true),'')::jsonb,'{}');
 insert into ig_practice_audit.heads(source,account_key,component,player_id,pool,game,table_id,tournament_id,balance,revision)
 values(s,k,c,u,pool_name,g,t,e,0,0) on conflict do nothing;
 select * into strict h from ig_practice_audit.heads where source=s and account_key=k and component=c for update;
 if h.balance<>before_value or h.player_id<>u or h.pool<>pool_name then
  raise exception 'PRACTICE_JOURNAL_BALANCE_MISMATCH';
 end if;
 if before_value=after_value and entry_kind<>'opening' then return; end if;
 if ctx->>'kind' in ('refund','reversal') then
  correction:=(ctx->>'reversesId')::bigint;
  select * into strict original from ig_practice_audit.entries where id=correction;
  if original.source<>s or original.account_key<>k or original.component<>c
   or after_value-before_value<>-original.delta or original.delta=0
   or (ctx->>'kind'='refund' and (original.kind<>'wager' or original.delta>=0))
   or nullif(ctx->>'request','') is null or nullif(ctx->>'actor','') is null then
   raise exception 'PRACTICE_JOURNAL_INVALID_COMPENSATION';
  end if;
  entry_kind:=ctx->>'kind';why:=coalesce(ctx->>'reason',why);
 end if;
 insert into ig_practice_audit.entries(source,account_key,component,revision,player_id,pool,game,table_id,tournament_id,round_ref,
 actor_id,actor_kind,request_ref,operation,reason,kind,reverses_id,before_units,after_units)
 values(s,k,c,h.revision+1,u,pool_name,g,t,e,r,
 nullif(ctx->>'actor','')::uuid,case when nullif(ctx->>'actor','') is null then 'system' else 'account' end,
 coalesce(nullif(ctx->>'request',''),'tx:'||pg_current_xact_id()::text),
 coalesce(ctx->>'operation','server balance change'),why,entry_kind,correction,before_value,after_value);
 update ig_practice_audit.heads set balance=after_value,revision=h.revision+1 where source=s and account_key=k and component=c;
end $$;

create function ig_practice_audit.capture_balance() returns trigger
language plpgsql security definer set search_path='' as $$
declare a jsonb; b jsonb; row_data jsonb; ctx jsonb; g text; pool_name text; k text;
 u uuid;t uuid;e uuid;r text; c text; before_value bigint;after_value bigint; why text; entry_kind text;
begin
 if tg_op='INSERT' then a:='{}';b:=to_jsonb(new);
 elsif tg_op='DELETE' then a:=to_jsonb(old);b:='{}';
 else a:=to_jsonb(old);b:=to_jsonb(new); end if;
 row_data:=case when tg_op='DELETE' then a else b end;
 u:=(row_data->>'user_id')::uuid;
 ctx:=coalesce(nullif(current_setting('ig.practice_audit_context',true),'')::jsonb,'{}');
 if tg_table_name='poker_seats_v1' then
  t:=(row_data->>'table_id')::uuid;
  k:=t::text||':'||u::text;
  select event_id,hand_no::text,case when variant='omaha' then 'omaha' else 'poker' end into e,r,g
   from public.poker_tables_v1 where id=t;
  if g is null and tg_op='DELETE' then
   select tournament_id,game into e,g from ig_practice_audit.heads where source=tg_table_name and account_key=k limit 1;
  end if;
  if g is null then raise exception 'PRACTICE_JOURNAL_POKER_TABLE_MISSING'; end if;
  pool_name:=coalesce('tournament:'||e::text,'table:'||t::text);
 else
  g:=case when tg_table_name='ig_bj_seats' then 'blackjack' when tg_table_name='ig_crash_v2_seats' then 'crash-trenball' else row_data->>'game' end;
  pool_name:=tg_table_name||':'||g;k:=g||':'||u::text;
  if tg_table_name='ig_mp_players' then select round_no::text into r from public.ig_mp_tables where game=g;
  elsif tg_table_name='ig_event_seats' then select round_no::text into r from public.ig_event_tables where game=g;
  elsif tg_table_name='ig_bj_seats' then select round_no::text into r from public.ig_bj_table where id='blackjack';
  elsif tg_table_name='ig_crash_v2_seats' then select round_no::text into r from public.ig_crash_v2_runtime where singleton=1;
  else raise exception 'PRACTICE_JOURNAL_SOURCE_NOT_SUPPORTED'; end if;
 end if;
 -- Identity changes would move chips between players/pools without an explicit debit.
 if tg_op='UPDATE' and (a->'user_id' is distinct from b->'user_id' or a->'table_id' is distinct from b->'table_id' or a->'game' is distinct from b->'game') then
  raise exception 'PRACTICE_JOURNAL_IDENTITY_IMMUTABLE';
 end if;
 foreach c in array case when tg_table_name='poker_seats_v1' then array['stack','committed'] else array['chips'] end loop
  before_value:=coalesce((a->>c)::bigint,0);after_value:=coalesce((b->>c)::bigint,0);
  if before_value=after_value and tg_op<>'INSERT' then continue; end if;
  entry_kind:=case when ctx->>'action'='sync' and tg_op in ('INSERT','DELETE') then 'relocation'
   when tg_op='INSERT' then 'grant' when tg_op='DELETE' then 'retirement'
   when ctx->>'operation' is null then 'adjustment'
   when c='committed' then 'escrow'
   when after_value<before_value then 'wager'
   when ctx->>'action'='refill' then 'grant' else 'payout' end;
  -- Exact native operation stays attached; an unexplained credit is not called a refund.
  why:=tg_table_name||'.'||c||':'||lower(tg_op)||':'||coalesce(ctx->>'action','system');
  perform ig_practice_audit.post(tg_table_name,k,c,u,pool_name,g,t,e,r,before_value,after_value,why,entry_kind);
 end loop;
 return case when tg_op='DELETE' then old else new end;
end $$;

create function ig_practice_audit.capture_registration() returns trigger
language plpgsql security definer set search_path='' as $$
declare e public.poker_events_v1%rowtype;ctx jsonb;
begin
 select * into strict e from public.poker_events_v1 where id=new.event_id;
 if e.format not in ('scheduled_mtt','sit_and_go') or e.config->'practiceOnly' is distinct from 'true'::jsonb
 or e.config->'realValueEnabled'='true'::jsonb or coalesce((e.config->>'buyInUnits')::numeric,-1)<>0 then
  raise exception 'PRACTICE_JOURNAL_FREE_EVENT_REQUIRED';
 end if;
 ctx:=coalesce(nullif(current_setting('ig.practice_audit_context',true),'')::jsonb,'{}');
 insert into ig_practice_audit.registrations(tournament_id,player_id,actor_id,request_ref,fee_units)
 values(new.event_id,new.user_id,nullif(ctx->>'actor','')::uuid,'register:'||new.event_id||':'||new.user_id,0);
 return new;
end $$;

-- Installation must take the same locks before opening snapshots and trigger setup.
lock table public.ig_mp_players,public.ig_event_seats,public.ig_bj_seats,
 public.ig_crash_v2_seats,public.poker_seats_v1,public.poker_event_entries_v1 in share row exclusive mode;
do $$ declare s text; r record; c text; g text; pool_name text; k text; t uuid; e uuid; hand text;
begin
 foreach s in array array['ig_mp_players','ig_event_seats','ig_bj_seats','ig_crash_v2_seats','poker_seats_v1'] loop
  for r in execute format('select to_jsonb(x) j from public.%I x',s) loop
   t:=null;e:=null;hand:=null;
   if s='poker_seats_v1' then
    t:=(r.j->>'table_id')::uuid;
    select event_id,hand_no::text,case when variant='omaha' then 'omaha' else 'poker' end into e,hand,g from public.poker_tables_v1 where id=t;
    pool_name:=coalesce('tournament:'||e::text,'table:'||t::text);k:=t||':'||(r.j->>'user_id');
   else
    g:=case when s='ig_bj_seats' then 'blackjack' when s='ig_crash_v2_seats' then 'crash-trenball' else r.j->>'game' end;
    pool_name:=s||':'||g;k:=g||':'||(r.j->>'user_id');
   end if;
   foreach c in array case when s='poker_seats_v1' then array['stack','committed'] else array['chips'] end loop
    perform ig_practice_audit.post(s,k,c,(r.j->>'user_id')::uuid,pool_name,g,t,e,hand,0,(r.j->>c)::bigint,'snapshot at audit boundary, not historical issuance','opening');
   end loop;
  end loop;
  execute format('create trigger practice_balance_journal after insert or update or delete on public.%I for each row execute function ig_practice_audit.capture_balance()',s);
 end loop;
end $$;
create trigger practice_registration_journal after insert on public.poker_event_entries_v1
 for each row execute function ig_practice_audit.capture_registration();

-- Attach verified server RPC arguments inside existing functions. No wrapper APIs,
-- grant changes, auth changes, or replacement game logic. Fail on incompatible bodies.
-- Function-local SET resets the context on exit, including nested calls and errors.
do $$ declare spec record; f oid; definition text; body text; patched text; hook text;
begin
 for spec in select * from (values
 ('ig_mp_action','p_actor','p_request::text','p_action'),
 ('ig_event_action','p_actor','p_request::text','p_action'),
 ('ig_bj_action','p_actor','p_request::text','p_action'),
 ('ig_crash_v2_action','p_actor','p_request::text','p_action'),
 ('ig_crash_v2_tick','NULL::uuid','NULL::text',quote_literal('tick')),
 ('roulette_tick','NULL::uuid','NULL::text',quote_literal('settle')),
 ('ig_mp_craps_refill','p_actor','p_request::text',quote_literal('refill')),
 ('poker_create_v1','p_owner','NULL::text',quote_literal('create')),
 ('poker_create_omaha_v1','p_owner','NULL::text',quote_literal('create')),
 ('poker_join_v1','p_actor','NULL::text',quote_literal('join')),
 ('poker_start_v2','p_owner','NULL::text',quote_literal('start')),
 ('poker_start_omaha_v1','p_owner','NULL::text',quote_literal('start')),
 ('poker_action_v3','p_actor','p_action_id::text','p_action'),
 ('poker_settle_v1','NULL::uuid','NULL::text',quote_literal('settle')),
 ('poker_event_register_v1','p_actor','NULL::text',quote_literal('register')),
 ('poker_event_start_v1','p_actor','p_request::text',quote_literal('start')),
 ('poker_event_sync_v1','NULL::uuid','NULL::text',quote_literal('sync'))
 ) x(name,actor,request,action) loop
  select p.oid into strict f from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname=case when spec.name='roulette_tick' then 'ig_internal' else 'public' end and p.proname=spec.name;
  select prosrc,pg_get_functiondef(f) into body,definition from pg_proc where oid=f;
  hook:=format(E'\n perform pg_catalog.set_config(''ig.practice_audit_context'',jsonb_build_object(''actor'',%s,''request'',%s,''operation'',%L,''action'',%s)::text,true);\n',spec.actor,spec.request,spec.name,spec.action);
  patched:=regexp_replace(body,E'(^|[\n\r])([ \t]*)begin\\y',E'\\1\\2begin'||hook,'i');
  if patched=body or position('ig.practice_audit_context' in body)>0 then raise exception 'PRACTICE_JOURNAL_PATCH_MISMATCH: %',spec.name; end if;
  execute replace(definition,body,patched);
  execute format('alter function %s set ig.practice_audit_context = %L',f::regprocedure,'');
 end loop;
end $$;

-- Privileged offline reconciliation compares BOTH live source rows and journal.
-- A retired seat must reconcile to zero, including parent-table cascades.
create view ig_practice_audit.live_balances with (security_invoker=true) as
 select 'ig_mp_players'::text source,game||':'||user_id account_key,'chips'::text component,chips balance from public.ig_mp_players
 union all select 'ig_event_seats',game||':'||user_id,'chips',chips from public.ig_event_seats
 union all select 'ig_bj_seats','blackjack:'||user_id,'chips',chips from public.ig_bj_seats
 union all select 'ig_crash_v2_seats','crash-trenball:'||user_id,'chips',chips from public.ig_crash_v2_seats
 union all select 'poker_seats_v1',table_id||':'||user_id,'stack',stack from public.poker_seats_v1
 union all select 'poker_seats_v1',table_id||':'||user_id,'committed',committed from public.poker_seats_v1;
create view ig_practice_audit.reconciliation with (security_invoker=true) as
 select h.source,h.account_key,h.component,h.balance,coalesce(l.balance,0) as live_balance,
 coalesce(sum(j.delta),0) as journal_balance,
 h.balance=coalesce(sum(j.delta),0) and h.balance=coalesce(l.balance,0) as consistent
 from ig_practice_audit.heads h left join ig_practice_audit.entries j
 using(source,account_key,component) left join ig_practice_audit.live_balances l
 using(source,account_key,component) group by h.source,h.account_key,h.component,h.balance,l.balance
 union all select l.source,l.account_key,l.component,null::bigint,l.balance,null::numeric,false
 from ig_practice_audit.live_balances l where not exists(select 1 from ig_practice_audit.heads h
 where h.source=l.source and h.account_key=l.account_key and h.component=l.component);
revoke all on all functions in schema ig_practice_audit from public,anon,authenticated,service_role;
revoke all on all tables in schema ig_practice_audit from public,anon,authenticated,service_role;
comment on schema ig_practice_audit is 'Private nonredeemable practice-chip audit only; no money conversion, purchase, transfer or withdrawal API.';
