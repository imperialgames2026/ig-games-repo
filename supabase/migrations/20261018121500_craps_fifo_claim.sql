-- Enforce FIFO claim policy after initial shooter-queue migration.
CREATE OR REPLACE FUNCTION public.ig_mp_action(p_actor uuid, p_game text, p_action text, p_request uuid DEFAULT NULL::uuid, p_target text DEFAULT NULL::text, p_units integer DEFAULT NULL::integer, p_expected_round bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  t public.ig_mp_tables%rowtype;
  seat public.ig_mp_players%rowtype;
  bet public.ig_mp_bets%rowtype;
  past public.ig_mp_bets%rowtype;
  old_event public.ig_mp_events%rowtype;
  d1 integer; d2 integer; landed integer; total integer;
  point_before integer; point_after integer; payout integer; n integer;
  new_shooter uuid; qualifies boolean; win boolean; multiplier integer;
  rolled jsonb; v_user_role text; stake text;
  reds integer[] := array[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
begin
  if p_game not in ('craps','roulette') or p_action not in ('join','leave','bet','roll','spin','claim') then
    raise exception 'invalid action' using errcode='22023';
  end if;
  select ur.role::text into v_user_role
    from public.user_roles ur join public.profiles pr on pr.id=ur.user_id
   where ur.user_id=p_actor and pr.is_excluded=false;
  if v_user_role is null or v_user_role not in ('player','admin','superadmin') then
    raise exception 'account not eligible' using errcode='42501';
  end if;
  -- Game actions, chips and order of play share one database row lock.
  select * into strict t from public.ig_mp_tables where game=p_game for update;
  if p_action='join' then
    if p_game='craps' and p_target is not null and p_target not in ('shooter','action') then
      raise exception 'INVALID_SEAT_MODE' using errcode='22023';
    end if;
    if p_game='roulette' and p_target is not null then
      raise exception 'UNEXPECTED_ROULETTE_SEAT_MODE' using errcode='22023';
    end if;
    -- Inactive seats free up after ten minutes, but their practice-chip ledger stays
    -- permanently attached to their account. Never mint another initial allocation.
    update public.ig_mp_players set seated=false
      where game=p_game and seated and seen_at < now()-interval '10 minutes';
    if t.shooter_id is not null and not exists(
      select 1 from public.ig_mp_players p where p.game=p_game
        and p.user_id=t.shooter_id and p.seated
    ) then
      t.shooter_id := null;
      update public.ig_mp_tables set shooter_id=null,revision=revision+1,updated_at=now()
        where game=p_game;
    end if;
    if not exists(select 1 from public.ig_mp_players where game=p_game and user_id=p_actor and seated)
       and (select count(*) from public.ig_mp_players where game=p_game and seated)>=24 then
      raise exception 'table full' using errcode='22023';
    end if;
    insert into public.ig_mp_players(game,user_id) values(p_game,p_actor)
      on conflict(game,user_id) do update set seen_at=now(),seated=true;
    if p_game='craps' then
      -- NULL means heartbeat/rejoin: preserve the player's previous choice.
      -- The default for new seats is action-only, and explicitly opting into
      -- shooter duty places that player in the eligible FIFO shooter queue.
      if p_target is not null then
        update public.ig_mp_players set craps_join_mode=p_target,
          craps_shooter_requested_at=case when p_target='shooter' then
            case when craps_join_mode='shooter'
                 then coalesce(craps_shooter_requested_at,now()) else now() end
            else null end
          where game='craps' and user_id=p_actor;
      end if;
      if t.shooter_id=p_actor and
         exists(select 1 from public.ig_mp_players where game='craps'
            and user_id=p_actor and craps_join_mode='action') then
        -- Relinquishing the dice is intentional, not a table disconnect.
        t.shooter_id:=null;
      end if;
      if t.shooter_id is null then
        select p.user_id into new_shooter from public.ig_mp_players p
        where p.game='craps' and p.seated and p.craps_join_mode='shooter'
          and p.seen_at>now()-interval '60 seconds'
        order by p.craps_shooter_requested_at nulls last,p.joined_at,p.user_id limit 1;
        t.shooter_id:=new_shooter;
        update public.ig_mp_tables set shooter_id=new_shooter,
          betting_closes_at=case when new_shooter is null then now()
                else now()+interval '12 seconds' end,
          revision=revision+1,updated_at=now() where game=p_game;
      end if;
    elsif t.shooter_id is null then
      update public.ig_mp_tables set shooter_id=p_actor,
        betting_closes_at=now()+interval '12 seconds',revision=revision+1,updated_at=now() where game=p_game;
    end if;
    return jsonb_build_object('ok',true,'joined',true,
      'seatMode',case when p_game='craps' then
        (select craps_join_mode from public.ig_mp_players
          where game='craps' and user_id=p_actor) else 'shooter' end,
      'isShooter',t.shooter_id=p_actor);
  end if;
  select * into seat from public.ig_mp_players where game=p_game and user_id=p_actor for update;
  if not found then raise exception 'join table first' using errcode='42501'; end if;
  if p_action='leave' then
    if seat.seated then
      update public.ig_mp_players set seated=false,seen_at=now() where game=p_game and user_id=p_actor;
      if t.shooter_id=p_actor then
        select p.user_id into new_shooter from public.ig_mp_players p
          where p.game=p_game and p.seated and p.seen_at>now()-interval '60 seconds'
            and (p_game<>'craps' or p.craps_join_mode='shooter')
          order by case when p_game='craps' then p.craps_shooter_requested_at end nulls last,
                   p.joined_at,p.user_id limit 1;
        update public.ig_mp_tables set shooter_id=new_shooter,
            betting_closes_at=case when new_shooter is null then now() else now()+interval '12 seconds' end,
            revision=revision+1,updated_at=now() where game=p_game;
      else
        update public.ig_mp_tables set revision=revision+1,updated_at=now() where game=p_game;
      end if;
    end if;
    return jsonb_build_object('ok',true,'joined',false);
  end if;
  if not seat.seated then raise exception 'join table first' using errcode='42501'; end if;
  update public.ig_mp_players set seen_at=now() where game=p_game and user_id=p_actor;
  if p_action='claim' then
    if p_game='craps' and seat.craps_join_mode<>'shooter' then
      raise exception 'SHOOTER_OPT_IN_REQUIRED' using errcode='42501';
    end if;
    if p_game='craps' and exists(
       select 1 from public.ig_mp_players p
       where p.game='craps' and p.seated and p.craps_join_mode='shooter'
         and p.seen_at>now()-interval '60 seconds' and p.user_id<>p_actor
         and (p.craps_shooter_requested_at, p.joined_at,p.user_id)
             < (coalesce(seat.craps_shooter_requested_at,now()),seat.joined_at,p_actor)
    ) then
      raise exception 'SHOOTER_QUEUE_TURN_REQUIRED' using errcode='42501';
    end if;
    if t.shooter_id is not null and t.shooter_id<>p_actor
       and exists(select 1 from public.ig_mp_players where game=p_game and user_id=t.shooter_id
                 and seated and seen_at > now()-interval '60 seconds') then
      raise exception 'current shooter still active' using errcode='42501';
    end if;
    update public.ig_mp_tables set shooter_id=p_actor,revision=revision+1,updated_at=now() where game=p_game;
    return jsonb_build_object('ok',true,'shooter',p_actor);
  end if;
  if p_action='bet' then
    if p_request is null or p_target is null or p_units is null or p_units<1 or p_units>100 then
      raise exception 'invalid practice bet' using errcode='22023';
    end if;
    select * into past from public.ig_mp_bets where game=p_game and user_id=p_actor and request_id=p_request;
    if found then
      if past.target<>p_target or past.units<>p_units then
        raise exception 'request replay mismatch' using errcode='23505';
      end if;
      return jsonb_build_object('ok',true,'betId',past.id,'replayed',true);
    end if;
    if now()>=t.betting_closes_at then raise exception 'betting is closed for this round' using errcode='22023'; end if;
    if p_game='craps' then
      qualifies := p_target in ('pass','dont_pass','field','any_seven','place_4','place_5','place_6','place_8','place_9','place_10');
      if p_target in ('pass','dont_pass') and t.point is not null then qualifies:=false; end if;
    else
      qualifies := p_target in ('red','black','odd','even','low','high','dozen_1','dozen_2','dozen_3','column_1','column_2','column_3')
        or (p_target ~ '^number_([0-9]|[1-2][0-9]|3[0-6])$');
    end if;
    if not qualifies or seat.chips < p_units then raise exception 'invalid target or insufficient practice chips' using errcode='22023'; end if;
    update public.ig_mp_players set chips=chips-p_units where game=p_game and user_id=p_actor;
    insert into public.ig_mp_bets(game,user_id,request_id,target,units,placed_round)
       values (p_game,p_actor,p_request,p_target,p_units,t.round_no) returning * into bet;
    update public.ig_mp_tables set revision=revision+1,updated_at=now() where game=p_game;
    return jsonb_build_object('ok',true,'betId',bet.id,'replayed',false);
  end if;
  if p_action not in ('roll','spin') or (p_game='craps' and p_action<>'roll') or
       (p_game='roulette' and p_action<>'spin') or p_request is null or p_expected_round is null then
    raise exception 'invalid round action' using errcode='22023';
  end if;
  select * into old_event from public.ig_mp_events where game=p_game and request_id=p_request;
  if found then
    if old_event.actor<>p_actor then raise exception 'request replay mismatch' using errcode='42501'; end if;
    return jsonb_build_object('ok',true,'replayed',true,'result',old_event.result);
  end if;
  if t.round_no<>p_expected_round then raise exception 'stale round; refresh table' using errcode='23505'; end if;
  if now()<t.betting_closes_at then raise exception 'betting window still open' using errcode='22023'; end if;
  if t.shooter_id is distinct from p_actor then raise exception 'only current shooter/dealer may act' using errcode='42501'; end if;
  point_before := t.point;
  point_after := t.point;
  if p_game='craps' then
    d1:=public.ig_mp_random(6)+1; d2:=public.ig_mp_random(6)+1; total:=d1+d2;
    if point_before is null then
      if total in (4,5,6,8,9,10) then point_after:=total; end if;
    elsif total=point_before or total=7 then point_after:=null;
    end if;
    rolled:=jsonb_build_object('game','craps','round',t.round_no,'dice',jsonb_build_array(d1,d2),
       'total',total,'pointBefore',point_before,'pointAfter',point_after,'shooter',p_actor);
  else
    landed:=public.ig_mp_random(37);
    rolled:=jsonb_build_object('game','roulette','round',t.round_no,'number',landed,
       'color',case when landed=0 then 'green' when landed=any(reds) then 'red' else 'black' end,
       'shooter',p_actor);
  end if;
  -- Every active practice bet is settled here, atomically with the result.
  for bet in select * from public.ig_mp_bets where game=p_game and status='active'
                and (p_game='craps' or placed_round=t.round_no) order by created_at,id for update
  loop
    payout:=null;
    if p_game='craps' then
      if bet.target='field' then
        payout:=case when total in (2,12) then bet.units*3
                     when total in (3,4,9,10,11) then bet.units*2 else 0 end;
      elsif bet.target='any_seven' then payout:=case when total=7 then bet.units*5 else 0 end;
      elsif bet.target='pass' then
        if point_before is null then
          if total in (7,11) then payout:=bet.units*2;
          elsif total in (2,3,12) then payout:=0; end if;
        elsif total=point_before then payout:=bet.units*2;
        elsif total=7 then payout:=0; end if;
      elsif bet.target='dont_pass' then
        if point_before is null then
          if total in (7,11) then payout:=0;
          elsif total in (2,3) then payout:=bet.units*2;
          elsif total=12 then payout:=bet.units; end if;
        elsif total=point_before then payout:=0;
        elsif total=7 then payout:=bet.units*2; end if;
      elsif bet.target like 'place_%' and point_before is not null then
        n:=substring(bet.target from 7)::integer;
        if total=7 then payout:=0;
        elsif total=n then
          payout:=case when n in (4,10) then bet.units+floor(bet.units*9.0/5.0)::integer
                       when n in (5,9) then bet.units+floor(bet.units*7.0/5.0)::integer
                       else bet.units+floor(bet.units*7.0/6.0)::integer end;
        end if;
      end if;
    else
      win:=false; multiplier:=1;
      if bet.target like 'number_%' then
        n:=substring(bet.target from 8)::integer; win:=(landed=n); multiplier:=35;
      elsif bet.target='red' then win:=(landed<>0 and landed=any(reds));
      elsif bet.target='black' then win:=(landed<>0 and not landed=any(reds));
      elsif bet.target='odd' then win:=(landed<>0 and landed%2=1);
      elsif bet.target='even' then win:=(landed<>0 and landed%2=0);
      elsif bet.target='low' then win:=(landed>=1 and landed<=18);
      elsif bet.target='high' then win:=(landed>=19 and landed<=36);
      elsif bet.target like 'dozen_%' then
        n:=substring(bet.target from 7)::integer;
        win:=(landed between ((n-1)*12+1) and (n*12)); multiplier:=2;
      elsif bet.target like 'column_%' then
        n:=substring(bet.target from 8)::integer;
        win:=(landed<>0 and (landed-1)%3+1=n); multiplier:=2;
      end if;
      payout:=case when win then bet.units*(multiplier+1) else 0 end;
    end if;
    if payout is not null then
      update public.ig_mp_bets set status='settled',paid_units=payout,
        outcome=case when payout=0 then 'lose' when payout=bet.units then 'push' else 'win' end,
        settled_at=now() where id=bet.id;
      if payout>0 then
        update public.ig_mp_players set chips=chips+payout where game=p_game and user_id=bet.user_id;
      end if;
    end if;
  end loop;
  new_shooter:=t.shooter_id;
  if p_game='craps' and point_before is not null and total=7 then
    select p.user_id into new_shooter from public.ig_mp_players p
      join public.ig_mp_players current_seat on current_seat.game=p.game and current_seat.user_id=p_actor
      where p.game=p_game and p.user_id<>p_actor and p.seated
        and p.craps_join_mode='shooter' and p.seen_at>now()-interval '60 seconds'
      order by p.craps_shooter_requested_at nulls last,p.joined_at,p.user_id limit 1;
    new_shooter:=coalesce(new_shooter,p_actor);
  end if;
  update public.ig_mp_tables set round_no=round_no+1,point=point_after,
      shooter_id=new_shooter,last_result=rolled,betting_closes_at=now()+interval '12 seconds',revision=revision+1,updated_at=now()
      where game=p_game;
  insert into public.ig_mp_events(game,request_id,actor,round_no,result)
    values(p_game,p_request,p_actor,t.round_no,rolled);
  return jsonb_build_object('ok',true,'replayed',false,'result',rolled);
end $function$;
