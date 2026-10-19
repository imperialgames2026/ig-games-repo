-- Canonical read-only catalog for games that have an actually migrated backend.
-- All rows are zero-wager practice games; no paid game can be enabled here.
create table if not exists public.ig_practice_game_catalog (
  slug text primary key check (slug ~ '^[a-z0-9-]{2,40}$'),
  name text not null check (char_length(name) between 3 and 80),
  description text not null check (char_length(description) between 10 and 500),
  category text not null check (category in ('instant','table','cards')),
  game_type text not null default 'internal' check (game_type = 'internal'),
  backend_slug text not null check (backend_slug = 'provably-fair-v2'),
  route text not null check (route in ('/PlayDice')),
  practice_only boolean not null default true check (practice_only = true),
  real_wagers_enabled boolean not null default false check (real_wagers_enabled = false),
  is_active boolean not null default false,
  play_count integer not null default 0 check (play_count >= 0),
  created_at timestamptz not null default now()
);
alter table public.ig_practice_game_catalog enable row level security;
revoke all on public.ig_practice_game_catalog from public,anon,authenticated;
grant select on public.ig_practice_game_catalog to authenticated;
drop policy if exists "approved practice game catalog read" on public.ig_practice_game_catalog;
create policy "approved practice game catalog read"
 on public.ig_practice_game_catalog for select to authenticated
 using (is_active and practice_only and not real_wagers_enabled);

insert into public.ig_practice_game_catalog
  (slug,name,description,category,game_type,backend_slug,route,is_active)
values ('dice','Practice Dice',
  'Verified zero-wager practice Dice with server commitment, reveal and reproducible SHA-256/HMAC proof.',
  'instant','internal','provably-fair-v2','/PlayDice',true)
on conflict (slug) do update set
  name=excluded.name,
  description=excluded.description,
  category=excluded.category,
  game_type=excluded.game_type,
  backend_slug=excluded.backend_slug,
  route=excluded.route,
  practice_only=true,real_wagers_enabled=false,is_active=true;

comment on table public.ig_practice_game_catalog is
'Read-only validated game lobby. Only migrated practice Dice is enabled. Not a casino game ledger or authorization to wager.';


