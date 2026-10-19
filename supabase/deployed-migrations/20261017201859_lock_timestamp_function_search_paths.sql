-- Pin timestamp trigger function name resolution to trusted built-in functions.
-- Both bodies only call now() and mutate NEW.updated_at; public schema is unnecessary.
alter function public.set_updated_at() set search_path = pg_catalog;
alter function public.set_app_records_updated_at() set search_path = pg_catalog;


