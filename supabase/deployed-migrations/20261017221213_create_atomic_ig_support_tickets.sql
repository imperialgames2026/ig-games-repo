-- Original Base44 SupportChat -> authenticated Supabase support tickets.
-- Dedicated non-financial customer support. Edge-function service role only.
create table if not exists public.ig_support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  subject text not null check (char_length(subject) between 3 and 120),
  status text not null default 'open' check (status in ('open','in_progress','closed')),
  assigned_to uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, request_id)
);
create index if not exists ig_support_tickets_owner_recent_idx
  on public.ig_support_tickets(user_id,updated_at desc);
create index if not exists ig_support_tickets_status_recent_idx
  on public.ig_support_tickets(status,updated_at desc);

create table if not exists public.ig_support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.ig_support_tickets(id) on delete cascade,
  sender_id uuid not null references auth.users(id),
  sender_kind text not null check (sender_kind in ('player','staff')),
  request_id uuid not null,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  unique (ticket_id,request_id)
);
create index if not exists ig_support_messages_ticket_created_idx
  on public.ig_support_messages(ticket_id,created_at,id);

alter table public.ig_support_tickets enable row level security;
alter table public.ig_support_messages enable row level security;
revoke all on public.ig_support_tickets from public,anon,authenticated;
revoke all on public.ig_support_messages from public,anon,authenticated;

-- Atomic/idempotent ticket creation. The Edge function verifies JWT + role.
create or replace function public.ig_support_open(
  p_user uuid, p_subject text, p_body text, p_request uuid
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare v_ticket uuid; v_existing uuid;
begin
  if p_user is null or p_request is null or
     p_subject is null or char_length(btrim(p_subject)) not between 3 and 120 or
     p_body is null or char_length(btrim(p_body)) not between 1 and 2000 then
    raise exception 'Invalid support ticket' using errcode='22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_user::text)::bigint);
  select id into v_existing from public.ig_support_tickets
    where user_id = p_user and request_id = p_request;
  if v_existing is not null then return v_existing; end if;
  if (select count(*) from public.ig_support_tickets
      where user_id = p_user and status <> 'closed') >= 3 then
    raise exception 'Too many open tickets' using errcode='22023';
  end if;
  insert into public.ig_support_tickets(user_id,subject,request_id)
    values (p_user,btrim(p_subject),p_request) returning id into v_ticket;
  insert into public.ig_support_messages(ticket_id,sender_id,sender_kind,request_id,body)
    values (v_ticket,p_user,'player',p_request,btrim(p_body));
  return v_ticket;
end $$;

-- Atomic/idempotent message posting with serialisation against a closing ticket.
create or replace function public.ig_support_post(
  p_actor uuid, p_ticket uuid, p_body text, p_request uuid, p_is_staff boolean
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare v_ticket public.ig_support_tickets%rowtype; v_message uuid; v_existing uuid;
begin
  if p_actor is null or p_ticket is null or p_request is null or
     p_body is null or char_length(btrim(p_body)) not between 1 and 2000 or
     p_is_staff is null then
    raise exception 'Invalid support message' using errcode='22023';
  end if;
  select * into v_ticket from public.ig_support_tickets where id = p_ticket for update;
  if not found or (v_ticket.user_id <> p_actor and not p_is_staff) then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  select id into v_existing from public.ig_support_messages
    where ticket_id = p_ticket and request_id = p_request;
  if v_existing is not null then return v_existing; end if;
  if v_ticket.status = 'closed' then
    raise exception 'Ticket closed' using errcode='22023';
  end if;
  if (select count(*) from public.ig_support_messages where ticket_id = p_ticket) >= 100 then
    raise exception 'Ticket message limit reached' using errcode='22023';
  end if;
  insert into public.ig_support_messages
    (ticket_id,sender_id,sender_kind,request_id,body)
    values(p_ticket,p_actor,case when p_is_staff then 'staff' else 'player' end,
           p_request,btrim(p_body))
    returning id into v_message;
  update public.ig_support_tickets
     set updated_at = now(),
         status = case when p_is_staff then 'in_progress' else status end,
         assigned_to = case when p_is_staff then p_actor else assigned_to end
   where id = p_ticket;
  return v_message;
end $$;

create or replace function public.ig_support_staff_status(
  p_actor uuid,p_ticket uuid,p_status text
) returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_actor is null or p_ticket is null or p_status not in ('open','in_progress','closed')
     or p_status is null then
    raise exception 'Invalid status' using errcode='22023';
  end if;
  update public.ig_support_tickets
     set status=p_status, updated_at=now(),
         assigned_to=case when p_status='in_progress' then p_actor else assigned_to end
   where id=p_ticket;
  if not found then raise exception 'Ticket not found' using errcode='22023'; end if;
  return true;
end $$;

revoke all on function public.ig_support_open(uuid,text,text,uuid) from public,anon,authenticated;
revoke all on function public.ig_support_post(uuid,uuid,text,uuid,boolean) from public,anon,authenticated;
revoke all on function public.ig_support_staff_status(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.ig_support_open(uuid,text,text,uuid) to service_role;
grant execute on function public.ig_support_post(uuid,uuid,text,uuid,boolean) to service_role;
grant execute on function public.ig_support_staff_status(uuid,uuid,text) to service_role;

comment on table public.ig_support_tickets is
'Server-managed authenticated support queue replacing Base44 SupportChat; no financial operations.';


