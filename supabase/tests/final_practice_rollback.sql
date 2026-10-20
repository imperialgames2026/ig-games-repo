begin;
do $$
declare a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();round_uuid uuid;req uuid;r jsonb;started jsonb;ended jsonb;opts jsonb;g text;seed text;client text:='client:unicode-🎲';pick text;layout jsonb;blocked boolean;balance numeric;
begin
 insert into auth.users(id,email) values(a,'final-a-'||a||'@example.invalid'),(b,'final-b-'||b||'@example.invalid');
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 if internal.final_practice_sample(repeat('ab',32),client,'darts',0,100)<>30 or internal.final_practice_sample(repeat('ab',32),client,'dicezone',0,100)<>11 or internal.final_practice_card(repeat('ab',32),client,0)<>'{"rank":9,"suit":0}'::jsonb or internal.final_practice_layout(repeat('ab',32),client,'easy')<>'[[0],[1],[1],[0],[0],[2],[0],[0],[2]]'::jsonb then raise exception 'Independent Python vectors differ';end if;
 foreach g in array array['darts','dicezone','hilo','towers'] loop
  round_uuid:=gen_random_uuid();req:=gen_random_uuid();opts:=case g when 'hilo' then '{}'::jsonb when 'dicezone' then '{"start":1,"end":50}'::jsonb else '{"difficulty":"easy"}'::jsonb end;
  r:=public.ig_final_practice(a,'commit',g,round_uuid,p_options=>opts);
  if r?'serverSeed' or r?'layout' or r->>'phase'<>'committed' then raise exception 'Commit leaked secrets';end if;
  if public.ig_final_practice(a,'commit',g,round_uuid,p_options=>opts) is distinct from r then raise exception 'Commit replay changed';end if;
  begin perform public.ig_final_practice(b,'commit',g,round_uuid,p_options=>opts);raise exception 'Other owner accepted';exception when unique_violation then null;end;
  begin perform public.ig_final_practice(a,'commit',g,gen_random_uuid(),p_options=>opts);raise exception 'Second active round accepted';exception when unique_violation then null;end;
  started:=public.ig_final_practice(a,'start',g,round_uuid,req,0,p_client=>client);
  if public.ig_final_practice(a,'start',g,round_uuid,req,0,p_client=>client) is distinct from started then raise exception 'Start replay changed';end if;
  begin perform public.ig_final_practice(a,'start',g,round_uuid,req,0,p_client=>'altered');raise exception 'Seed replay changed';exception when unique_violation then null;end;
  update public.user_roles set role='tester' where user_id=a;
  begin perform public.ig_final_practice(a,'start',g,round_uuid,req,0,p_client=>client);raise exception 'Tester retry allowed';exception when insufficient_privilege then null;end;
  if public.ig_final_practice(a,'current',g)->>'roundId'<>round_uuid::text then raise exception 'Tester lost own read';end if;
  update public.user_roles set role='player' where user_id=a;
  update public.profiles set is_excluded=true where id=a;
  begin perform public.ig_final_practice(a,'start',g,round_uuid,req,0,p_client=>client);raise exception 'Excluded retry allowed';exception when insufficient_privilege then null;end;
  update public.profiles set is_excluded=false where id=a;
  if g in ('hilo','towers') then
   if started?'serverSeed' or started?'layout' then raise exception 'Active state leaked future outcomes';end if;
   select server_seed into seed from public.ig_final_practice_rounds where public.ig_final_practice_rounds.id=round_uuid;
   if g='hilo' then pick:=case when (internal.final_practice_card(seed,client,1)->>'rank')::integer>=(started->'outcome'->>'rank')::integer then 'higherOrSame' else 'lowerOrSame' end;
   else layout:=internal.final_practice_layout(seed,client,'easy');select x::text into pick from generate_series(0,2) x where not(layout->0 @> to_jsonb(x)) limit 1;end if;
   req:=gen_random_uuid();r:=public.ig_final_practice(a,'move',g,round_uuid,req,1,p_choice=>pick);
   if r->>'phase'<>'active' or r?'serverSeed' or r?'layout' then raise exception 'Valid move failed privacy';end if;
   if public.ig_final_practice(a,'move',g,round_uuid,req,1,p_choice=>pick) is distinct from r then raise exception 'Move replay changed';end if;
   begin perform public.ig_final_practice(a,'move',g,round_uuid,gen_random_uuid(),1,p_choice=>pick);raise exception 'Stale move allowed';exception when unique_violation then null;end;
   ended:=public.ig_final_practice(a,'finish',g,round_uuid,gen_random_uuid(),2);
  else ended:=started;end if;
  if ended->>'phase'<>'ended' or not(ended?'serverSeed') then raise exception 'Missing reveal';end if;
  if encode(extensions.digest(ended->>'serverSeed','sha256'),'hex')<>ended->>'serverSeedHash' then raise exception 'Commitment hash differs';end if;
  if g='towers' and ended->'layout' is distinct from internal.final_practice_layout(ended->>'serverSeed',client,'easy') then raise exception 'Board proof differs';end if;
 end loop;
 begin perform public.ig_final_practice(a,'commit','towers',gen_random_uuid(),p_options=>'{"difficulty":"nightmare"}');raise exception 'Impossible legacy level enabled';exception when invalid_parameter_value then null;end;
 begin perform public.ig_final_practice(a,'commit','dicezone',gen_random_uuid(),p_options=>'{"start":0,"end":101}');raise exception 'Invalid zone accepted';exception when invalid_parameter_value then null;end;
 if has_table_privilege('authenticated','public.ig_final_practice_rounds','select') or has_function_privilege('authenticated','public.ig_final_practice(uuid,text,text,uuid,uuid,integer,jsonb,text,text)','execute') then raise exception 'Hidden round service exposed';end if;
 select sum(cent_balance+igd_balance+igt_balance) into balance from public.wallets where user_id in(a,b);
 if balance<>0 or exists(select 1 from public.transactions where user_id in(a,b)) then raise exception 'Practice changed financial ledger';end if;
end $$;
rollback;
