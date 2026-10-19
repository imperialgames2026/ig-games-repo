-- Staging migration: replace Base44 getWeeklyTokenLeaderboard with a bounded,
-- server-only aggregate of completed practice CENT wins. Never expose emails.
create or replace function public.legacy_weekly_practice_leaderboard()
returns table(rank bigint, name text, total_won numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  with winners as (
    select t.user_id, sum(t.cent_amount) as won
    from public.transactions t
    join public.profiles p on p.id = t.user_id
    where t.type = 'win'
      and t.status = 'completed'
      and t.currency = 'CENT'
      and t.cent_amount > 0
      and p.is_excluded = false
      and t.created_at >= date_trunc('week', now() at time zone 'UTC') - interval '1 day'
      and t.created_at < date_trunc('week', now() at time zone 'UTC') + interval '6 days'
    group by t.user_id
  )
  select row_number() over(order by w.won desc, w.user_id) as rank,
         'Player ' || upper(substring(md5(w.user_id::text) from 1 for 8)) as name,
         w.won as total_won
    from winners w
    order by w.won desc, w.user_id
    limit 10
$$;
revoke all on function public.legacy_weekly_practice_leaderboard() from public, anon, authenticated;
grant execute on function public.legacy_weekly_practice_leaderboard() to service_role;
comment on function public.legacy_weekly_practice_leaderboard() is
'Server-only weekly UTC practice CENT win totals. Pseudonyms only; no redeemable/token valuation.';


