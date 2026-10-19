-- Explicit defense in depth: wallet balances must never be writable via browser roles.
revoke insert, update, delete on public.wallets from anon, authenticated;


