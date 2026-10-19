begin;
do $test$
declare
 a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); game text; op uuid; c jsonb; r jsonb; replay jsonb;
 before_wallet jsonb; after_wallet jsonb; i integer; v jsonb;
begin
 insert into auth.users(id,email) values(a,'originals-a-'||a||'@example.invalid'),(b,'originals-b-'||b||'@example.invalid');
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 select to_jsonb(w) into before_wallet from public.wallets w where user_id=a;
 foreach game in array array['coin','hashdice','limbo','plinko','wheel'] loop
  op:=gen_random_uuid();
  c:=public.ig_originals_practice(a,'commit',game,op,null);
  if c ? 'serverSeed' or c ? 'server_seed' or c ? 'outcome' then raise exception 'Commitment leaked secret'; end if;
  if public.ig_originals_practice(a,'commit',game,op,null) is distinct from c then raise exception 'Commit retry changed seed'; end if;
  begin perform public.ig_originals_practice(b,'reveal',game,op,'fixed-seed');
   raise exception 'Cross-owner reveal accepted'; exception when unique_violation then null; end;
  r:=public.ig_originals_practice(a,'reveal',game,op,'fixed-seed');
  replay:=public.ig_originals_practice(a,'reveal',game,op,'fixed-seed');
  if r is distinct from replay then raise exception 'Reveal changed on retry'; end if;
  if encode(extensions.digest(r->>'serverSeed','sha256'),'hex')<>c->>'server_seed_hash' then raise exception 'Commitment mismatch'; end if;
  begin perform public.ig_originals_practice(a,'reveal',game,op,'changed-seed');
   raise exception 'Changed seed accepted'; exception when unique_violation then null; end;
 end loop;
 -- Known vectors computed independently with Python hashlib/hmac.
 if internal.originals_practice_outcome(repeat('ab',32),'client:unicode-🎲','coin')<>'{"coin":"tails"}'::jsonb
 or internal.originals_practice_outcome(repeat('ab',32),'client:unicode-🎲','hashdice')<>'{"roll":19861}'::jsonb
 or internal.originals_practice_outcome(repeat('ab',32),'client:unicode-🎲','limbo')<>'{"multiplier":63.97}'::jsonb
 or internal.originals_practice_outcome(repeat('ab',32),'client:unicode-🎲','wheel')<>'{"segment":3,"color":"purple"}'::jsonb
 or internal.originals_practice_outcome(repeat('ab',32),'client:unicode-🎲','plinko')<>'{"path":[1,0,0,1,0,1,1,0,0,1,1,1],"bin":7,"rows":12}'::jsonb then
  raise exception 'Independent proof vectors differ'; end if;
 update public.user_roles set role='tester' where user_id=a;
 v:=public.ig_originals_practice(a,'history','coin',null,null);
 if jsonb_array_length(v->'rounds')<>1 then raise exception 'History did not return own revealed proof'; end if;
 begin perform public.ig_originals_practice(a,'commit','coin',gen_random_uuid(),null);
  raise exception 'Tester round accepted'; exception when insufficient_privilege then null; end;
 update public.user_roles set role='player' where user_id=a;
 update public.profiles set is_excluded=true where id=a;
 begin perform public.ig_originals_practice(a,'history','coin',null,null);
  raise exception 'Excluded history accepted'; exception when insufficient_privilege then null; end;
 update public.profiles set is_excluded=false where id=a;
 for i in 1..10 loop perform public.ig_originals_practice(a,'commit','coin',gen_random_uuid(),null); end loop;
 begin perform public.ig_originals_practice(a,'commit','coin',gen_random_uuid(),null);
  raise exception 'Pending-round limit not enforced'; exception when sqlstate '54000' then null; end;
 select to_jsonb(w) into after_wallet from public.wallets w where user_id=a;
 if before_wallet is distinct from after_wallet then raise exception 'Practice changed a monetary wallet'; end if;
 if exists(select 1 from public.transactions where user_id=a) then raise exception 'Practice wrote a transaction'; end if;
 if has_function_privilege('authenticated','public.ig_originals_practice(uuid,text,text,uuid,text)','EXECUTE') then raise exception 'Server-only RPC exposed'; end if;
end $test$;
select 'PASS: five independent game vectors, hidden commitments, owner isolation, immutable retry, role/exclusion guards, rate limit and unchanged wallets' as result;
rollback;
