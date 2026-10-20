-- Preserve the actor-bound implementation outside the exposed API schema.
-- Do not grant table writes to authenticated callers: the private definer enforces
-- canonical roles, exclusion, auth.uid() ownership and exact idempotent receipts.
alter function public.ign_action(text, numeric, uuid, boolean) set schema internal;
alter function internal.ign_action(text, numeric, uuid, boolean) set search_path = '';
revoke all on function internal.ign_action(text, numeric, uuid, boolean) from public, anon;
grant execute on function internal.ign_action(text, numeric, uuid, boolean) to authenticated, service_role;

create function public.ign_action(
  p_action text,
  p_amount numeric default null,
  p_operation_id uuid default null,
  p_auto_stake boolean default null
) returns jsonb
language sql security invoker set search_path = ''
as $$
  select internal.ign_action(p_action, p_amount, p_operation_id, p_auto_stake);
$$;
revoke all on function public.ign_action(text, numeric, uuid, boolean) from public, anon;
grant execute on function public.ign_action(text, numeric, uuid, boolean) to authenticated, service_role;
comment on function public.ign_action(text, numeric, uuid, boolean) is
  'Invoker API for actor-bound demo IGN operations; privileged implementation stays in unexposed internal schema.';
notify pgrst, 'reload schema';
