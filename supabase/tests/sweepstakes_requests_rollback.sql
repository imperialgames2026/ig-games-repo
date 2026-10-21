begin;
do $test$
declare
 player uuid:=gen_random_uuid(); other_player uuid:=gen_random_uuid(); staff uuid:=gen_random_uuid(); tester uuid:=gen_random_uuid();
 request_id uuid:=gen_random_uuid(); claim_id uuid:=gen_random_uuid(); actor uuid; n integer; before_wallet jsonb;
begin
 insert into auth.users(id,email) values(player,'request-player-'||player||'@example.invalid'),
 (other_player,'request-other-'||other_player||'@example.invalid'),(staff,'request-staff-'||staff||'@example.invalid'),(tester,'request-tester-'||tester||'@example.invalid');
 update public.user_roles set role='admin' where user_id=staff;
 update public.user_roles set role='tester' where user_id=tester;
 select to_jsonb(w) into before_wallet from public.wallets w where user_id=player;
 perform set_config('request.jwt.claim.sub',player::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',player,'role','authenticated','is_anonymous',false)::text,true);
 set local role authenticated;
 insert into public.ig_entry_requests(id,entry_count) values(request_id,3);
 if not exists(select 1 from public.ig_entry_requests where id=request_id and user_id=player and status='pending') then raise exception 'Owner/default status missing';end if;
 begin
  insert into public.ig_entry_requests(id,entry_count) values(request_id,3);
  raise exception 'Duplicate request allowed';
 exception when unique_violation then null;end;
 begin
  insert into public.ig_entry_requests(entry_count,user_id) values(1,other_player);
  raise exception 'Spoofed owner allowed';
 exception when insufficient_privilege then null;end;
 begin
  insert into public.ig_entry_requests(entry_count,status) values(1,'eligible');
  raise exception 'Player self-approved entry';
 exception when insufficient_privilege then null;end;
 begin
  insert into public.ig_entry_requests(entry_count) values(11);
  raise exception 'Invalid entry count allowed';
 exception when check_violation then null;end;
 begin
  insert into public.ig_prize_claim_requests(amount,prize_category) values('2.10','cash_equivalent');
  raise exception 'Unapproved KYC allowed';
 exception when insufficient_privilege then null;end;
 reset role;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',player,'role','service_role')::text,true);
 update public.profiles set kyc_status='approved' where id=player;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',player,'role','authenticated','is_anonymous',false)::text,true);
 set local role authenticated;
 insert into public.ig_prize_claim_requests(id,amount,prize_category,network,wallet_address) values(claim_id,'9999999999999999.99','crypto','SOL','ExampleDeliveryAddress123');
 if not exists(select 1 from public.ig_prize_claim_requests where id=claim_id and amount='9999999999999999.99' and status='submitted') then raise exception 'Exact requested amount changed';end if;
 begin
  insert into public.ig_prize_claim_requests(amount,prize_category,network,wallet_address) values('1.00','crypto','','');
  raise exception 'Missing delivery details allowed';
 exception when check_violation then null;end;
 begin
  insert into public.ig_prize_claim_requests(amount,prize_category) values('0.00','cash_equivalent');
  raise exception 'Zero amount allowed';
 exception when check_violation then null;end;
 begin
  insert into public.ig_prize_claim_requests(amount,prize_category) values('1.001','cash_equivalent');
  raise exception 'Fractional precision allowed';
 exception when check_violation then null;end;
 begin
  update public.ig_prize_claim_requests set status='fulfilled' where id=claim_id;
  raise exception 'Client fulfillment allowed';
 exception when insufficient_privilege then null;end;
 begin
  delete from public.ig_entry_requests where id=request_id;
  raise exception 'Client audit deletion allowed';
 exception when insufficient_privilege then null;end;
 reset role;
 foreach actor in array array[other_player,tester] loop
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','is_anonymous',false,'user_metadata',jsonb_build_object('role','superadmin'))::text,true);
  set local role authenticated;
  select count(*) into n from public.ig_entry_requests where id=request_id;
  if n<>0 then raise exception 'Other account read owner entries';end if;
  select count(*) into n from public.ig_prize_claim_requests where id=claim_id;
  if n<>0 then raise exception 'Other account read owner claim';end if;
  reset role;
 end loop;
 perform set_config('request.jwt.claim.sub',tester::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',tester,'role','authenticated','is_anonymous',false)::text,true);
 set local role authenticated;
 begin
  insert into public.ig_entry_requests(entry_count) values(1);
  raise exception 'Tester mutation allowed';
 exception when insufficient_privilege then null;end;
 reset role;
 perform set_config('request.jwt.claim.sub',staff::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',staff,'role','authenticated','is_anonymous',false)::text,true);
 set local role authenticated;
 if not exists(select 1 from public.ig_entry_requests where id=request_id) or not exists(select 1 from public.ig_prize_claim_requests where id=claim_id) then raise exception 'Canonical admin cannot audit';end if;
 reset role;
 update public.user_roles set role='player' where user_id=staff;
 set local role authenticated;
 if exists(select 1 from public.ig_prize_claim_requests where id=claim_id) then raise exception 'Demoted admin retains audit access';end if;
 reset role;
 perform set_config('request.jwt.claim.sub',player::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',player,'role','service_role')::text,true);
 update public.profiles set is_excluded=true where id=player;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',player,'role','authenticated','is_anonymous',false)::text,true);
 set local role authenticated;
 begin
  insert into public.ig_entry_requests(entry_count) values(1);
  raise exception 'Excluded entry accepted';
 exception when insufficient_privilege then null;end;
 begin
  insert into public.ig_prize_claim_requests(amount,prize_category) values('1.00','cash_equivalent');
  raise exception 'Excluded claim accepted';
 exception when insufficient_privilege then null;end;
 reset role;
 if (select to_jsonb(w) from public.wallets w where user_id=player) is distinct from before_wallet then raise exception 'Intake changed financial wallet';end if;
 perform set_config('request.jwt.claim.sub','',true);
 perform set_config('request.jwt.claims','{}',true);
 set local role anon;
 begin
  perform id from public.ig_entry_requests;
  raise exception 'Anonymous intake read allowed';
 exception when insufficient_privilege then null;end;
 reset role;
end $test$;
select 'PASS: request ownership, immutable intake, pending status, KYC, exact decimal amount, role/exclusion, admin demotion, and unchanged wallet' as result;
rollback;
