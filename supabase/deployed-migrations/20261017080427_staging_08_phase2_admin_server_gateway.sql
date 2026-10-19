create or replace function public.admin_mutation_server(p_actor uuid,p_target uuid,p_action text,p_reason text,p_request uuid,p_currency text default null,p_delta numeric default null)
returns jsonb language sql security invoker set search_path='' as $$
 select internal.admin_mutation(p_actor,p_target,p_action,p_reason,p_request,p_currency,p_delta)
$$;
revoke all on function public.admin_mutation_server(uuid,uuid,text,text,uuid,text,numeric) from public,anon,authenticated;
grant execute on function public.admin_mutation_server(uuid,uuid,text,text,uuid,text,numeric) to service_role;


