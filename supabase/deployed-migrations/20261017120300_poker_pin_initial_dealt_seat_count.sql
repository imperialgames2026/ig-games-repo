alter table public.poker_tables_v1 add column if not exists dealt_count int not null default 0;
create or replace function public.poker_capture_dealt_count_v1() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if old.status='waiting' and new.status='playing' then
  select count(*) into new.dealt_count from public.poker_seats_v1 where table_id=new.id and not folded;
 end if;
 return new;
end $$;
drop trigger if exists poker_dealt_count_v1 on public.poker_tables_v1;
create trigger poker_dealt_count_v1 before update on public.poker_tables_v1 for each row execute function public.poker_capture_dealt_count_v1();
do $$
declare body text;
begin
 body=pg_get_functiondef('public.poker_advance_v1(uuid)'::regprocedure);
 execute replace(body,'2*active_count','2*t.dealt_count');
end $$;

