-- Staging-only support supervisor triage and auditable alert queues.
-- Read/write strictly through server-authorized Edge Functions.
create table if not exists public.ig_support_supervisor_queue (
 ticket_id uuid primary key references public.ig_support_tickets(id) on delete cascade,
 message_id uuid not null references public.ig_support_messages(id) on delete cascade,
 state text not null default 'pending' check(state in ('pending','processing','reviewed','error')),
 claimed_at timestamptz,
 updated_at timestamptz not null default now(),
 error_code text
);
create table if not exists public.ig_support_supervisor_reviews (
 ticket_id uuid primary key references public.ig_support_tickets(id) on delete cascade,
 message_id uuid not null references public.ig_support_messages(id) on delete cascade,
 category text not null check(category in ('account','payments','kyc','technical','gaming','responsible_play','security','other')),
 priority text not null check(priority in ('low','normal','high')),
 requires_superadmin boolean not null default false,
 reason text not null default '',
 suggested_reply text,
 classification_source text not null check(classification_source in ('rules','ai_plus_rules')),
 reviewed_at timestamptz not null default now()
);
create table if not exists public.ig_support_supervisor_alerts (
 id uuid primary key default gen_random_uuid(),
 ticket_id uuid not null references public.ig_support_tickets(id) on delete cascade,
 message_id uuid not null references public.ig_support_messages(id) on delete cascade,
 category text not null,
 priority text not null,
 email_state text not null default 'disabled' check(email_state in ('disabled','pending','sending','sent','failed')),
 sms_state text not null default 'disabled' check(sms_state in ('disabled','pending','sending','sent','failed')),
 email_attempted_at timestamptz,
 sms_attempted_at timestamptz,
 created_at timestamptz not null default now(),
 unique(ticket_id,message_id)
);
create index if not exists ig_support_supervisor_queue_pending on public.ig_support_supervisor_queue(state,updated_at);
create index if not exists ig_support_supervisor_alerts_recent on public.ig_support_supervisor_alerts(created_at desc);
alter table public.ig_support_supervisor_queue enable row level security;
alter table public.ig_support_supervisor_reviews enable row level security;
alter table public.ig_support_supervisor_alerts enable row level security;
revoke all on public.ig_support_supervisor_queue,public.ig_support_supervisor_reviews,public.ig_support_supervisor_alerts from public,anon,authenticated;
grant select,insert,update on public.ig_support_supervisor_queue,public.ig_support_supervisor_reviews,public.ig_support_supervisor_alerts to service_role;

create or replace function public.ig_support_supervisor_enqueue()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.sender_kind='player' then
  insert into public.ig_support_supervisor_queue(ticket_id,message_id,state,claimed_at,updated_at,error_code)
  values(new.ticket_id,new.id,'pending',null,now(),null)
  on conflict(ticket_id) do update set
   message_id=excluded.message_id,state='pending',claimed_at=null,
   updated_at=now(),error_code=null;
 end if;
 return new;
end;$$;
revoke all on function public.ig_support_supervisor_enqueue() from public,anon,authenticated;
drop trigger if exists ig_support_supervisor_enqueue_message on public.ig_support_messages;
create trigger ig_support_supervisor_enqueue_message
 after insert on public.ig_support_messages
 for each row execute function public.ig_support_supervisor_enqueue();

-- Preserve existing player messages for initial staging triage; avoid duplicates.
insert into public.ig_support_supervisor_queue(ticket_id,message_id)
select distinct on (m.ticket_id) m.ticket_id,m.id
from public.ig_support_messages m
where m.sender_kind='player'
order by m.ticket_id,m.created_at desc,m.id desc
on conflict(ticket_id) do nothing;


