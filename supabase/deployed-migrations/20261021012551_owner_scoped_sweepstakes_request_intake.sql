-- Requests are immutable intake records, not awarded entries or payable prizes.
create table public.ig_entry_requests (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references public.profiles(id),
 entry_count integer not null check(entry_count between 1 and 10),
 status text not null default 'pending' check(status in ('pending','eligible','selected','void','used')),
 created_at timestamptz not null default now()
);
create table public.ig_prize_claim_requests (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references public.profiles(id),
 amount text not null check(amount ~ '^(0|[1-9][0-9]{0,15})[.][0-9]{2}$' and amount::numeric>0),
 prize_category text not null check(prize_category in ('crypto','cash_equivalent')),
 network text not null default '',
 wallet_address text not null default '',
 status text not null default 'submitted' check(status in ('submitted','kyc_required','under_review','approved','fulfilled','rejected')),
 created_at timestamptz not null default now(),
 check ((prize_category='cash_equivalent' and network='' and wallet_address='') or
  (prize_category='crypto' and length(btrim(network)) between 1 and 40 and length(btrim(wallet_address)) between 10 and 256
   and network !~ '[[:cntrl:]]' and wallet_address !~ '[[:space:][:cntrl:]]'))
);
alter table public.ig_entry_requests enable row level security;
alter table public.ig_prize_claim_requests enable row level security;
revoke all on public.ig_entry_requests,public.ig_prize_claim_requests from public,anon,authenticated;
grant select on public.ig_entry_requests,public.ig_prize_claim_requests to authenticated;
grant insert(id,entry_count) on public.ig_entry_requests to authenticated;
grant insert(id,amount,prize_category,network,wallet_address) on public.ig_prize_claim_requests to authenticated;
grant all on public.ig_entry_requests,public.ig_prize_claim_requests to service_role;
create policy own_entry_request_read on public.ig_entry_requests for select to authenticated
 using(user_id=(select auth.uid()) and not coalesce((select auth.jwt()->>'is_anonymous')::boolean,false));
create policy staff_entry_request_read on public.ig_entry_requests for select to authenticated using((select public.is_admin()));
create policy own_entry_request_create on public.ig_entry_requests for insert to authenticated
 with check(user_id=(select auth.uid()) and status='pending'
 and not coalesce((select auth.jwt()->>'is_anonymous')::boolean,false)
 and exists(select 1 from public.profiles p join public.user_roles r on r.user_id=p.id
  where p.id=(select auth.uid()) and not p.is_excluded and r.role in ('player','admin','superadmin')));
create policy own_prize_request_read on public.ig_prize_claim_requests for select to authenticated
 using(user_id=(select auth.uid()) and not coalesce((select auth.jwt()->>'is_anonymous')::boolean,false));
create policy staff_prize_request_read on public.ig_prize_claim_requests for select to authenticated using((select public.is_admin()));
create policy own_prize_request_create on public.ig_prize_claim_requests for insert to authenticated
 with check(user_id=(select auth.uid()) and status='submitted'
 and not coalesce((select auth.jwt()->>'is_anonymous')::boolean,false)
 and exists(select 1 from public.profiles p join public.user_roles r on r.user_id=p.id
  where p.id=(select auth.uid()) and not p.is_excluded and p.kyc_status='approved' and r.role in ('player','admin','superadmin')));
create index ig_entry_request_owner_date on public.ig_entry_requests(user_id,created_at desc);
create index ig_prize_request_owner_date on public.ig_prize_claim_requests(user_id,created_at desc);
-- Serialize intake per actor. This is an abuse ceiling, not an eligibility rule.
create function internal.request_intake_limit() returns trigger language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ig-intake:'||tg_table_name||':'||new.user_id::text,0));
 if tg_table_name='ig_entry_requests' then
  select count(*) into n from public.ig_entry_requests where user_id=new.user_id and created_at>now()-interval '1 hour';
 else
  select count(*) into n from public.ig_prize_claim_requests where user_id=new.user_id and created_at>now()-interval '1 hour';
 end if;
 if n>=60 then raise exception 'Request limit reached. Try again later.' using errcode='P0001';end if;
 return new;
end $$;
revoke all on function internal.request_intake_limit() from public,anon,authenticated;
create trigger entry_intake_limit before insert on public.ig_entry_requests for each row execute function internal.request_intake_limit();
create trigger prize_intake_limit before insert on public.ig_prize_claim_requests for each row execute function internal.request_intake_limit();
comment on table public.ig_entry_requests is 'Fresh-start AMOE intake only. Pending requests confer no eligible entries; trusted review applies official rules. No client update/delete.';
comment on table public.ig_prize_claim_requests is 'Owner-scoped claim intake with server KYC and canonical role checks. No credit, debit, reserve, fulfillment or provider execution. Trusted review must validate entitlement and delivery details.';
notify pgrst,'reload schema';
