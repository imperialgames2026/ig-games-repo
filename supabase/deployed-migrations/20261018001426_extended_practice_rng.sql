-- Extend cryptographic rejection-sampling for full baccarat shoe (416) and crash (10000).
-- No change in output distribution for existing dice or roulette calls.
create or replace function public.ig_mp_random(p_sides integer) returns integer
language plpgsql volatile set search_path = '' as $$
declare b bytea; n bigint; max_accepted bigint;
begin
  if p_sides < 2 or p_sides > 1000000 then
    raise exception 'invalid sides' using errcode='22023';
  end if;
  max_accepted := (4294967296::bigint/p_sides)*p_sides;
  loop
    b := extensions.gen_random_bytes(4);
    n := (get_byte(b,0)::bigint << 24) + (get_byte(b,1)::bigint << 16)
       + (get_byte(b,2)::bigint << 8) + get_byte(b,3)::bigint;
    if n < max_accepted then return (n % p_sides)::integer; end if;
  end loop;
end $$;
revoke all on function public.ig_mp_random(integer) from public,anon,authenticated;
grant execute on function public.ig_mp_random(integer) to service_role;


