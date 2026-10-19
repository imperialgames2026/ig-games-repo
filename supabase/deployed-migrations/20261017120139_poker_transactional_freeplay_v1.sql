create table if not exists public.poker_tables_v1(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),status text not null default 'waiting' check(status in ('waiting','playing','showdown','complete')),version bigint not null default 0,button int not null default -1,turn_index int,street text not null default 'preflop',small_blind bigint not null default 5,big_blind bigint not null default 10,current_bet bigint not null default 0,min_raise bigint not null default 10,board jsonb not null default '[]',deck_commitment text,private_deck jsonb,last_action_at timestamptz default now());
create table if not exists public.poker_seats_v1(table_id uuid not null references public.poker_tables_v1(id) on delete cascade,seat_no int not null check(seat_no between 0 and 9),user_id uuid not null references auth.users(id),stack bigint not null check(stack>=0),committed bigint not null default 0 check(committed>=0),street_bet bigint not null default 0 check(street_bet>=0),folded boolean not null default false,all_in boolean not null default false,acted boolean not null default false,private_hole jsonb not null default '[]',primary key(table_id,seat_no),unique(table_id,user_id));
create table if not exists public.poker_actions_v1(table_id uuid not null references public.poker_tables_v1(id) on delete cascade,action_id uuid not null,actor_id uuid not null,before_version bigint not null,after_version bigint not null,action text not null,chips bigint not null,result jsonb not null,primary key(table_id,action_id),unique(table_id,after_version));
alter table public.poker_tables_v1 enable row level security;alter table public.poker_seats_v1 enable row level security;alter table public.poker_actions_v1 enable row level security;
revoke all on public.poker_tables_v1,public.poker_seats_v1,public.poker_actions_v1 from anon,authenticated;
create or replace function public.poker_action_v1(p_table uuid,p_actor uuid,p_action_id uuid,p_version bigint,p_action text,p_amount bigint default 0) returns jsonb language plpgsql security invoker set search_path='' as $$
declare t public.poker_tables_v1%rowtype;s public.poker_seats_v1%rowtype; old jsonb;due bigint;paid bigint:=0;target bigint;raise_by bigint;pending int;survivors int;next_seat int;v bigint;answer jsonb;
begin
 if p_actor is null or p_action_id is null or p_version<0 then raise exception 'INVALID_REQUEST';end if;
 select * into t from public.poker_tables_v1 where id=p_table for update;
 if not found then raise exception 'TABLE_NOT_FOUND';end if;
 select result into old from public.poker_actions_v1 where table_id=p_table and action_id=p_action_id;
 if found then return old;end if;
 if t.status<>'playing' or t.version<>p_version then raise exception 'INACTIVE_OR_STALE';end if;
 select * into s from public.poker_seats_v1 where table_id=p_table and seat_no=t.turn_index for update;
 if not found or s.user_id<>p_actor or s.folded or s.all_in then raise exception 'NOT_YOUR_TURN';end if;
 due=greatest(0,t.current_bet-s.street_bet);
 if p_action='fold' then update public.poker_seats_v1 set folded=true,acted=true where table_id=p_table and seat_no=s.seat_no;
 elsif p_action='check' then
  if due<>0 then raise exception 'CANNOT_CHECK';end if;
  update public.poker_seats_v1 set acted=true where table_id=p_table and seat_no=s.seat_no;
 elsif p_action in ('call','allin','raise','bet') then
  if p_action='call' then paid=least(due,s.stack);
  elsif p_action='allin' then
   paid=s.stack;
   if s.acted and s.street_bet+paid>t.current_bet then raise exception 'NOT_REOPENED';end if;
  else
   if s.acted or p_amount is null or p_amount<=t.current_bet then raise exception 'INVALID_RAISE';end if;
   if (p_action='bet' and t.current_bet<>0) or (p_action='raise' and t.current_bet=0) then raise exception 'INVALID_BET_TYPE';end if;
   paid=p_amount-s.street_bet;
   if paid>s.stack or p_amount-t.current_bet<t.min_raise then raise exception 'INVALID_RAISE';end if;
  end if;
  target=s.street_bet+paid;
  if target>t.current_bet then
   raise_by=target-t.current_bet;
   update public.poker_tables_v1 set current_bet=target where id=p_table;
   if raise_by>=t.min_raise then
    update public.poker_tables_v1 set min_raise=raise_by where id=p_table;
    update public.poker_seats_v1 set acted=false where table_id=p_table and seat_no<>s.seat_no and not folded and not all_in;
   end if;
  end if;
  update public.poker_seats_v1 set stack=stack-paid,committed=committed+paid,street_bet=street_bet+paid,all_in=(stack=paid),acted=true where table_id=p_table and seat_no=s.seat_no;
 else raise exception 'UNKNOWN_ACTION';end if;
 select count(*) into survivors from public.poker_seats_v1 where table_id=p_table and not folded;
 if survivors=1 then
  update public.poker_seats_v1 set stack=stack+(select sum(committed) from public.poker_seats_v1 where table_id=p_table) where table_id=p_table and not folded;
  update public.poker_seats_v1 set committed=0,street_bet=0 where table_id=p_table;
  update public.poker_tables_v1 set status='complete',turn_index=null where id=p_table;
 else
  select count(*) into pending from public.poker_seats_v1 x join public.poker_tables_v1 y on y.id=x.table_id where x.table_id=p_table and not x.folded and not x.all_in and (not x.acted or x.street_bet<y.current_bet);
  if pending>0 then
   select x.seat_no into next_seat from public.poker_seats_v1 x join public.poker_tables_v1 y on y.id=x.table_id where x.table_id=p_table and not x.folded and not x.all_in and (not x.acted or x.street_bet<y.current_bet) order by (x.seat_no-s.seat_no+10)%10 limit 1;
   update public.poker_tables_v1 set turn_index=next_seat where id=p_table;
  else
   update public.poker_tables_v1 set status='showdown',turn_index=null where id=p_table;
  end if;
 end if;
 update public.poker_tables_v1 set version=version+1,last_action_at=now() where id=p_table returning version into v;
 answer=jsonb_build_object('tableId',p_table,'version',v,'accepted',true,'chipsCommitted',paid);
 insert into public.poker_actions_v1 values(p_table,p_action_id,p_actor,p_version,v,p_action,paid,answer);
 return answer;
end $$;
revoke all on function public.poker_action_v1(uuid,uuid,uuid,bigint,text,bigint) from public,anon,authenticated;
grant execute on function public.poker_action_v1(uuid,uuid,uuid,bigint,text,bigint) to service_role;

