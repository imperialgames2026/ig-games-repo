-- Imperial Games: safe per-user preferred wallet balance display.
-- These preferences NEVER exchange, mint, transfer or settle any value.
create table if not exists public.player_wallet_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 selected_currency text not null default 'CENT'
   check (selected_currency in ('CENT','IGD','IGT')),
 updated_at timestamptz not null default now()
);
alter table public.player_wallet_preferences enable row level security;
revoke all on public.player_wallet_preferences from public, anon, authenticated;
grant select,insert (user_id,selected_currency),update (selected_currency) on public.player_wallet_preferences to authenticated;
create policy "player preferences own read" on public.player_wallet_preferences
 for select to authenticated using (user_id=(select auth.uid()));
create policy "player preferences own insert" on public.player_wallet_preferences
 for insert to authenticated with check (user_id=(select auth.uid()));
create policy "player preferences own update" on public.player_wallet_preferences
 for update to authenticated using (user_id=(select auth.uid()))
 with check (user_id=(select auth.uid()));
