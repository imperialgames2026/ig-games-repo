-- Phase 2: append-only administrative audit foundation.
-- Only trusted server-side operations may write audit records.
create table if not exists public.admin_action_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id),
  target_id uuid not null references auth.users(id),
  action text not null check (action in ('exclude','restore','wallet_adjustment')),
  reason text not null check (length(trim(reason)) between 8 and 2000),
  request_id uuid not null unique,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.admin_action_audit enable row level security;
revoke all on public.admin_action_audit from public, anon, authenticated;
comment on table public.admin_action_audit is 'Server-only audit trail; no browser read or write permissions. Administrative actions require separately verified atomic handlers.';


