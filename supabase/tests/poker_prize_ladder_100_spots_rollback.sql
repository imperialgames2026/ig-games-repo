-- Reproducible 100-position payout test. This script must never commit.
begin;
do $test$
declare sa uuid; adm uuid; preset jsonb; config jsonb; result jsonb; event_result jsonb; stored jsonb; awards jsonb; n int;
begin
 select ur.user_id into sa from public.user_roles ur join public.profiles p on p.id=ur.user_id
 where ur.role::text='superadmin' and p.is_excluded=false limit 1;
 if sa is null then raise exception 'No eligible staging Superadmin fixture';end if;
 select ur.user_id into adm from public.user_roles ur join public.profiles p on p.id=ur.user_id
 where ur.role::text='admin' and p.is_excluded=false limit 1;
 config:=jsonb_build_object('name','Prize ladder regression MTT','format','scheduled_mtt','variant','holdem',
 'currency','PRACTICE','seatsPerTable',8,'tableCount',30,'buyInUnits',0,'rakeBps',0,'rakeCapUnits',0,
 'bombPotsEnabled',false,'bombPotEveryHands',0,
 'blindLevels',jsonb_build_array(jsonb_build_object('small',25,'big',50,'durationMinutes',10)));
 preset:=public.ig_poker_tournament_preset_save(sa,config);
 select jsonb_agg(jsonb_build_object('position',i,'amount','0.01') order by i)
 into awards from generate_series(1,100) i;
 result:=public.ig_poker_tournament_awards_save(sa,(preset->>'id')::uuid,'BTC','USD',awards,0);
 if result->>'paidPlaces'<>'100' or result->>'totalAmount'<>'1.000000000000'
 or result->>'revision'<>'1' or result->>'payoutsActivated'<>'false'
 then raise exception 'Unexpected plan result %',result;end if;
 select count(*) into n from public.ig_poker_tournament_awards where preset_id=(preset->>'id')::uuid;
 if n<>100 then raise exception 'Award count incorrect';end if;
 event_result:=public.ig_poker_create_event_from_preset(sa,(preset->>'id')::uuid,gen_random_uuid());
 select config into stored from public.poker_events_v1 where id=(event_result->>'eventId')::uuid;
 if jsonb_array_length(stored->'awardSchedule')<>100 or stored->>'payoutAsset'<>'BTC'
 or stored->>'payoutsActivated'<>'false' or length(stored->>'awardScheduleHash')<>64
 then raise exception 'Immutable draft event payout snapshot missing';end if;
 begin
 perform public.ig_poker_tournament_awards_save(sa,(preset->>'id')::uuid,'BTC','USD',awards,0);
 raise exception 'Accepted stale revision';exception when sqlstate '40001' then null;end;
 begin
 perform public.ig_poker_tournament_awards_save(sa,(preset->>'id')::uuid,'BTC','USD',
 awards||jsonb_build_array(jsonb_build_object('position',101,'amount','1')),1);
 raise exception 'Accepted 101 paid positions';exception when sqlstate '22023' then null;end;
 begin
 perform public.ig_poker_tournament_awards_save(sa,(preset->>'id')::uuid,'BTC','USD',
 jsonb_build_array(jsonb_build_object('position',2,'amount','1')),1);
 raise exception 'Accepted noncontiguous payouts';exception when sqlstate '22023' then null;end;
 if adm is not null then
 begin
 perform public.ig_poker_tournament_awards_save(adm,(preset->>'id')::uuid,'BTC','USD',awards,1);
 raise exception 'Accepted ordinary admin edits';exception when sqlstate '42501' then null;end;
 end if;
end $test$;
rollback;
