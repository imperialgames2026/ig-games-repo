begin;
do $test$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); round_id uuid:=gen_random_uuid(); req uuid; c jsonb; s jsonb; again jsonb;
 mines integer[]; safe integer; before_wallet jsonb; after_wallet jsonb;
begin
 insert into auth.users(id,email) values(a,'mines-a-'||a||'@example.invalid'),(b,'mines-b-'||b||'@example.invalid');
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 select to_jsonb(w) into before_wallet from public.wallets w where user_id=a;
 if internal.mines_practice_board(repeat('ab',32),'client:unicode-🎲',1)<>array[7]
 or internal.mines_practice_board(repeat('ab',32),'client:unicode-🎲',3)<>array[0,12,18]
 or internal.mines_practice_board(repeat('ab',32),'client:unicode-🎲',24)<>array[0,1,2,3,4,5,6,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24] then
  raise exception 'Independent Python board vector mismatch'; end if;
 c:=public.ig_mines_practice(a,'commit',round_id,null,null,null,3,null);
 if c ? 'mines' or c ? 'serverSeed' then raise exception 'Commitment leaked board'; end if;
 if public.ig_mines_practice(a,'commit',round_id,null,null,null,3,null) is distinct from c then raise exception 'Commit retry changed seed'; end if;
 req:=gen_random_uuid();
 s:=public.ig_mines_practice(a,'start',round_id,req,0,null,null,'test-seed');
 if s ? 'mines' or s ? 'serverSeed' or s->>'phase'<>'active' then raise exception 'Active board leaked'; end if;
 if public.ig_mines_practice(a,'start',round_id,req,0,null,null,'test-seed') is distinct from s then raise exception 'Start retry changed response'; end if;
 begin perform public.ig_mines_practice(a,'commit',gen_random_uuid(),null,null,null,3,null);
  raise exception 'Second active round allowed'; exception when unique_violation then null; end;
 begin perform public.ig_mines_practice(b,'state',round_id);
  raise exception 'Cross-owner state allowed'; exception when no_data_found then null; end;
 select r.mines into mines from public.ig_mines_practice_rounds r where id=round_id;
 select n into safe from generate_series(0,24) n where not n=any(mines) order by n limit 1;
 begin perform public.ig_mines_practice(a,'pick',round_id,gen_random_uuid(),0,safe);
  raise exception 'Stale move accepted'; exception when unique_violation then null; end;
 req:=gen_random_uuid();
 s:=public.ig_mines_practice(a,'pick',round_id,req,1,safe);
 again:=public.ig_mines_practice(a,'pick',round_id,req,1,safe);
 if again is distinct from s or jsonb_array_length(s->'picks')<>1 then raise exception 'Pick replay advanced game'; end if;
 begin perform public.ig_mines_practice(a,'pick',round_id,req,1,(safe+1)%25);
  raise exception 'Changed request accepted'; exception when unique_violation then null; end;
 begin perform public.ig_mines_practice(a,'pick',round_id,gen_random_uuid(),2,safe);
  raise exception 'Duplicate tile accepted'; exception when invalid_parameter_value then null; end;
 update public.user_roles set role='tester' where user_id=a;
 begin perform public.ig_mines_practice(a,'finish',round_id,gen_random_uuid(),2);
  raise exception 'Tester move accepted'; exception when insufficient_privilege then null; end;
 update public.user_roles set role='player' where user_id=a;
 req:=gen_random_uuid();
 s:=public.ig_mines_practice(a,'finish',round_id,req,2);
 if s->>'phase'<>'ended' or s->>'endReason'<>'stopped' or not s ? 'serverSeed' or not s ? 'mines'
 or encode(extensions.digest(s->>'serverSeed','sha256'),'hex')<>c->>'serverSeedHash' then raise exception 'Final proof unavailable or changed'; end if;
 if public.ig_mines_practice(a,'finish',round_id,req,2) is distinct from s then raise exception 'Finish replay changed response'; end if;
 round_id:=gen_random_uuid(); perform public.ig_mines_practice(a,'commit',round_id,null,null,null,24);
 perform public.ig_mines_practice(a,'start',round_id,gen_random_uuid(),0,null,null,'mine-hit');
 select r.mines into mines from public.ig_mines_practice_rounds r where id=round_id;
 s:=public.ig_mines_practice(a,'pick',round_id,gen_random_uuid(),1,mines[1]);
 if s->>'endReason'<>'mine' then raise exception 'Mine did not end game'; end if;
 round_id:=gen_random_uuid(); perform public.ig_mines_practice(a,'commit',round_id,null,null,null,24);
 perform public.ig_mines_practice(a,'start',round_id,gen_random_uuid(),0,null,null,'all-clear');
 select r.mines into mines from public.ig_mines_practice_rounds r where id=round_id;
 select n into safe from generate_series(0,24) n where not n=any(mines) limit 1;
 s:=public.ig_mines_practice(a,'pick',round_id,gen_random_uuid(),1,safe);
 if s->>'endReason'<>'cleared' then raise exception 'Last safe tile did not clear game'; end if;
 update public.profiles set is_excluded=true where id=a;
 begin perform public.ig_mines_practice(a,'current'); raise exception 'Excluded state allowed'; exception when insufficient_privilege then null; end;
 select to_jsonb(w) into after_wallet from public.wallets w where user_id=a;
 if before_wallet is distinct from after_wallet or exists(select 1 from public.transactions where user_id=a) then raise exception 'Practice changed financial data'; end if;
 if has_function_privilege('authenticated','public.ig_mines_practice(uuid,text,uuid,uuid,integer,integer,integer,text)','EXECUTE') then raise exception 'Server RPC exposed'; end if;
end $test$;
select 'PASS: Mines vectors, hidden board, ownership, replay, version locks, mine/clear/stop, tester/exclusion and unchanged wallets' as result;
rollback;
