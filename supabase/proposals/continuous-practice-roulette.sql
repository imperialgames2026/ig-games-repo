-- Practice only: an independent house clock. No wallet or redeemable currency.
create schema if not exists ig_internal;
revoke all on schema ig_internal from public,anon,authenticated;
alter table public.ig_mp_tables add column if not exists round_started_at timestamptz;
alter table public.ig_mp_tables add column if not exists presentation_ends_at timestamptz;
alter table public.ig_mp_tables add column if not exists pending_result jsonb;
alter table public.ig_mp_events alter column actor drop not null;
alter table public.ig_mp_events add constraint ig_mp_event_house_actor check(actor is not null or game='roulette');
alter table public.ig_mp_players alter column chips type bigint;
alter table public.ig_mp_players drop constraint ig_mp_players_chips_check;
alter table public.ig_mp_players add constraint ig_mp_players_chips_check check(chips between 0 and 9007199254740991);
-- Preserve existing bets and balances while establishing the first house cycle.
update public.ig_mp_tables set round_started_at=clock_timestamp(),betting_closes_at=clock_timestamp()+interval '27 seconds',presentation_ends_at=clock_timestamp()+interval '30 seconds',pending_result=null,shooter_id=null,revision=revision+1 where game='roulette';

create function ig_internal.roulette_tick() returns jsonb
language plpgsql security definer set search_path='' as $$
declare t public.ig_mp_tables%rowtype; b public.ig_mp_bets%rowtype;
 landed integer; n integer; multiplier integer; payout integer; win boolean;
 reds integer[]:=array[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
 stamp timestamptz; rolled jsonb; phase text;
begin
 select * into t from public.ig_mp_tables where game='roulette' for update skip locked;
 if not found then return jsonb_build_object('phase','busy'); end if;
 stamp:=clock_timestamp();
 if stamp<t.betting_closes_at then return jsonb_build_object('phase','betting','round',t.round_no); end if;
 if t.pending_result is null then
  landed:=public.ig_mp_random(37);
  rolled:=jsonb_build_object('game','roulette','round',t.round_no,'number',landed,'color',case when landed=0 then 'green' when landed=any(reds) then 'red' else 'black' end,'presentationEndsAt',t.presentation_ends_at,'operator','house');
  insert into public.ig_mp_events(game,request_id,actor,round_no,result) values('roulette',gen_random_uuid(),null,t.round_no,rolled);
  update public.ig_mp_tables set pending_result=rolled,last_result=rolled,revision=revision+1,updated_at=stamp where game='roulette';
  t.pending_result:=rolled;phase:='spinning';
 end if;
 if stamp>=t.presentation_ends_at then
  landed:=(t.pending_result->>'number')::integer;
  for b in select * from public.ig_mp_bets where game='roulette' and status='active' and placed_round=t.round_no order by created_at,id for update loop
   win:=false;multiplier:=1;
   if b.target like 'number_%' then n:=substring(b.target from 8)::integer;win:=landed=n;multiplier:=35;
   elsif b.target='red' then win:=landed<>0 and landed=any(reds);
   elsif b.target='black' then win:=landed<>0 and not landed=any(reds);
   elsif b.target='odd' then win:=landed<>0 and landed%2=1;
   elsif b.target='even' then win:=landed<>0 and landed%2=0;
   elsif b.target='low' then win:=landed between 1 and 18;
   elsif b.target='high' then win:=landed between 19 and 36;
   elsif b.target like 'dozen_%' then n:=substring(b.target from 7)::integer;win:=landed between (n-1)*12+1 and n*12;multiplier:=2;
   elsif b.target like 'column_%' then n:=substring(b.target from 8)::integer;win:=landed<>0 and (landed-1)%3+1=n;multiplier:=2;
   end if;
   payout:=case when win then b.units*(multiplier+1) else 0 end;
   update public.ig_mp_bets set status='settled',paid_units=payout,outcome=case when win then 'win' else 'lose' end,settled_at=stamp where id=b.id;
   if payout>0 then update public.ig_mp_players set chips=chips+payout where game='roulette' and user_id=b.user_id; end if;
  end loop;
  update public.ig_mp_tables set round_no=round_no+1,round_started_at=stamp,betting_closes_at=stamp+interval '27 seconds',presentation_ends_at=stamp+interval '30 seconds',pending_result=null,shooter_id=null,revision=revision+1,updated_at=stamp where game='roulette';
  phase:='betting';
 end if;
 if phase is not null then
  -- Public invalidation signal contains no account or wager data. Clients still
  -- fetch an authenticated snapshot and never trust broadcast outcomes/balances.
  begin perform realtime.send(jsonb_build_object('game','roulette','phase',phase),'roulette-clock','ig-practice-roulette-clock',false);
  exception when others then raise warning 'Roulette clock broadcast unavailable'; end;
 end if;
 return jsonb_build_object('phase',coalesce(phase,'spinning'),'round',t.round_no);
end $$;
revoke all on function ig_internal.roulette_tick() from public,anon,authenticated,service_role;

alter function public.ig_mp_action(uuid,text,text,uuid,text,integer,bigint) rename to ig_mp_action_manual;
revoke all on function public.ig_mp_action_manual(uuid,text,text,uuid,text,integer,bigint) from public,anon,authenticated,service_role;
create function public.ig_mp_action(p_actor uuid,p_game text,p_action text,p_request uuid default null,p_target text default null,p_units integer default null,p_expected_round bigint default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t public.ig_mp_tables%rowtype; seat public.ig_mp_players%rowtype; past public.ig_mp_bets%rowtype; v_id uuid;
begin
 if p_game='craps' then return public.ig_mp_action_manual(p_actor,p_game,p_action,p_request,p_target,p_units,p_expected_round); end if;
 if p_game is distinct from 'roulette' or p_action is null or p_action not in ('join','leave','bet') then raise exception 'roulette is operated by the house clock' using errcode='22023'; end if;
 if not exists(select 1 from public.profiles pr join public.user_roles ur on ur.user_id=pr.id where pr.id=p_actor and not pr.is_excluded and ur.role::text in ('player','admin','superadmin')) then raise exception 'account not eligible' using errcode='42501'; end if;
 select * into strict t from public.ig_mp_tables where game='roulette' for update;
 if p_action='join' then
  if p_target is not null then raise exception 'unexpected roulette seat mode' using errcode='22023'; end if;
  -- No 24-seat dealer queue. All roulette participants are bettors.
  insert into public.ig_mp_players(game,user_id) values('roulette',p_actor) on conflict(game,user_id) do update set seated=true,seen_at=clock_timestamp();
  return jsonb_build_object('ok',true,'joined',true);
 end if;
 select * into seat from public.ig_mp_players where game='roulette' and user_id=p_actor for update;
 if not found or not seat.seated then raise exception 'join table first' using errcode='42501'; end if;
 if p_action='leave' then update public.ig_mp_players set seated=false,seen_at=clock_timestamp() where game='roulette' and user_id=p_actor;return jsonb_build_object('ok',true,'joined',false);end if;
 if p_request is null or p_units is null or p_units<1 or p_units>100 or p_target is null then raise exception 'invalid practice bet' using errcode='22023';end if;
 select * into past from public.ig_mp_bets where game='roulette' and user_id=p_actor and request_id=p_request;
 if found then
  if past.target<>p_target or past.units<>p_units then raise exception 'request replay mismatch' using errcode='23505';end if;
  return jsonb_build_object('ok',true,'betId',past.id,'replayed',true);
 end if;
 if clock_timestamp()>=t.betting_closes_at or t.pending_result is not null then raise exception 'betting is closed for this round' using errcode='22023';end if;
 if not(p_target in ('red','black','odd','even','low','high','dozen_1','dozen_2','dozen_3','column_1','column_2','column_3') or p_target ~ '^number_([0-9]|[1-2][0-9]|3[0-6])$') or seat.chips<p_units then raise exception 'invalid target or insufficient practice chips' using errcode='22023';end if;
 update public.ig_mp_players set chips=chips-p_units,seen_at=clock_timestamp() where game='roulette' and user_id=p_actor;
 insert into public.ig_mp_bets(game,user_id,request_id,target,units,placed_round) values('roulette',p_actor,p_request,p_target,p_units,t.round_no) returning id into v_id;
 update public.ig_mp_tables set revision=revision+1,updated_at=clock_timestamp() where game='roulette';
 return jsonb_build_object('ok',true,'betId',v_id,'replayed',false);
end $$;
revoke all on function public.ig_mp_action(uuid,text,text,uuid,text,integer,bigint) from public,anon,authenticated;
grant execute on function public.ig_mp_action(uuid,text,text,uuid,text,integer,bigint) to service_role;

alter function public.ig_mp_state(uuid,text) rename to ig_mp_state_manual;
revoke all on function public.ig_mp_state_manual(uuid,text) from public,anon,authenticated,service_role;
create function public.ig_mp_state(p_actor uuid,p_game text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s jsonb;t public.ig_mp_tables%rowtype;
begin
 s:=public.ig_mp_state_manual(p_actor,p_game);
 if p_game='roulette' then
  select * into strict t from public.ig_mp_tables where game='roulette';
  s:=s||jsonb_build_object('betsOpen',clock_timestamp()<t.betting_closes_at and t.pending_result is null,'roundEndsAt',t.presentation_ends_at,'presentationEndsAt',t.presentation_ends_at,'roundStartedAt',t.round_started_at,'phase',case when clock_timestamp()<t.betting_closes_at and t.pending_result is null then 'betting' else 'spinning' end,'operator','house','serverTime',clock_timestamp());
 end if;return s;
end $$;
revoke all on function public.ig_mp_state(uuid,text) from public,anon,authenticated;
grant execute on function public.ig_mp_state(uuid,text) to service_role;
select cron.schedule('ig-practice-roulette-30s','1 second','select ig_internal.roulette_tick();');
