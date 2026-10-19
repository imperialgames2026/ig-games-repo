
do $do$
declare def text;
begin
 select pg_get_functiondef('public.ig_crash_v2_fill_queue()'::regprocedure) into def;
 execute replace(def,'gen_random_bytes(', 'extensions.gen_random_bytes(');
end $do$;


