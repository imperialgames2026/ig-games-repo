-- REVIEW ONLY: privileged isolated-lab assertion, NEVER expose as player RPC.
-- The future test operator supplies a nonempty JSON trace via transaction-local
-- ig.practice_acceptance_trace, from stable request IDs used in actual HTTP.
-- No example result is test evidence. House ticks/implicit grants need their
-- own lifecycle assertions; this trace does not invent request IDs for them.
do $$declare trace jsonb; item jsonb; posts bigint; units numeric;
begin
 if to_regclass('ig_practice_audit.reconciliation') is null then
  raise exception 'REVIEWED_LEDGER_PROPOSAL_REQUIRED';
 end if;
 trace:=nullif(current_setting('ig.practice_acceptance_trace',true),'')::jsonb;
 if trace is null or jsonb_typeof(trace)<>'array' or jsonb_array_length(trace)=0 then
  raise exception 'NONEMPTY_ACTUAL_HTTP_TRACE_REQUIRED';
 end if;
 if exists(select 1 from ig_practice_audit.reconciliation where not consistent)
 or exists(select 1 from ig_practice_audit.entries where redeemable or asset<>'PRACTICE_CHIP')
 or exists(select 1 from ig_practice_audit.registrations where fee_units<>0) then
  raise exception 'PRACTICE_ACCOUNTING_INVARIANT_FAILED';
 end if;
 for item in select value from jsonb_array_elements(trace) loop
  if jsonb_typeof(item)<>'object' or item->>'actorId' is null or item->>'requestId' is null
  or item->>'game' is null or item->>'expectedPosts' is null or item->>'expectedDelta' is null
  or (item->>'expectedPosts')::bigint<1 then raise exception 'INVALID_ACCEPTANCE_TRACE'; end if;
  select count(*),coalesce(sum(delta),0) into posts,units from ig_practice_audit.entries
   where actor_id=(item->>'actorId')::uuid and request_ref=item->>'requestId' and game=item->>'game';
  if posts<>(item->>'expectedPosts')::bigint or units<>(item->>'expectedDelta')::numeric then
   raise exception 'REQUEST_LEDGER_MISMATCH';
  end if;
 end loop;
end $$;
-- Select only aggregate audit evidence, not private customer/player records.
select count(*) as account_components,
 count(*) filter(where consistent) as reconciled_components,
 coalesce(sum(balance),0) as live_units,coalesce(sum(journal_balance),0) as journal_units
 from ig_practice_audit.reconciliation;
