-- Superadmin decisions about support escalation, never payment/withdrawal approvals.
create table if not exists public.ig_support_supervisor_decisions (
 id uuid primary key default gen_random_uuid(),
 ticket_id uuid not null references public.ig_support_tickets(id) on delete cascade,
 message_id uuid not null references public.ig_support_messages(id) on delete cascade,
 reviewer_id uuid not null references auth.users(id),
 request_id uuid not null,
 decision text not null check(decision in ('acknowledged','followup_required','review_complete')),
 note text not null check(char_length(note) between 3 and 500),
 created_at timestamptz not null default now(),
 unique(reviewer_id,request_id)
);
alter table public.ig_support_supervisor_decisions enable row level security;
revoke all on public.ig_support_supervisor_decisions from public,anon,authenticated;
grant select,insert on public.ig_support_supervisor_decisions to service_role;
create index if not exists ig_support_supervisor_decisions_ticket on public.ig_support_supervisor_decisions(ticket_id,created_at desc);
