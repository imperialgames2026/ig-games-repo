-- Ensure early automatic payouts never exceed the already committed crash result.
do $patch$
declare current_sql text; fixed_sql text;
begin
  select pg_get_functiondef('public.ig_crash_v2_tick()'::regprocedure) into current_sql;
  if position('and mode=''crash_auto'' and target<=x for update' in current_sql)=0 then
    raise exception 'Crash source no longer matches expected version';
  end if;
  fixed_sql:=replace(current_sql,'and mode=''crash_auto'' and target<=x for update',
    'and mode=''crash_auto'' and target<=x and target<=v.crash_point for update');
  execute fixed_sql;
end $patch$;
