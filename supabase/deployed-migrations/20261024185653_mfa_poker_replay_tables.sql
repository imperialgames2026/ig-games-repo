-- The recorded poker replay migration runs after the original MFA migration.
-- Add only restrictive requirements; backend-only tables retain zero client grants.
create policy customer_mfa_required on public.poker_hand_ledger_v1
 as restrictive for all to authenticated
 using ((select internal.mfa_satisfied()))
 with check ((select internal.mfa_satisfied()));
create policy customer_mfa_required on public.poker_hand_steps_v1
 as restrictive for all to authenticated
 using ((select internal.mfa_satisfied()))
 with check ((select internal.mfa_satisfied()));
