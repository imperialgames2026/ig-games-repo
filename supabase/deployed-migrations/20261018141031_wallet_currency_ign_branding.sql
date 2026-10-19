-- Rename the preferred display currency from legacy CENT to IGN.
-- Do NOT rename the wallets.cent_balance ledger column here: wallet RPCs and
-- historical accounting still depend on the storage field name.
-- This is a label/preference migration ONLY; no balances are converted.
alter table public.player_wallet_preferences
 drop constraint if exists player_wallet_preferences_selected_currency_check;
update public.player_wallet_preferences
 set selected_currency='IGN', updated_at=now()
 where selected_currency='CENT';
alter table public.player_wallet_preferences
 alter column selected_currency set default 'IGN';
alter table public.player_wallet_preferences
 add constraint player_wallet_preferences_selected_currency_check
 check (selected_currency in ('IGN','IGD','IGT'));


