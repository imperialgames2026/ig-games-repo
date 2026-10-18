import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PLAYER_WALLET_CURRENCIES,displayWalletBalance,playerWalletCurrency} from '../lib/playerWalletBalance.js';
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=source('supabase/migrations/20261018140000_player_wallet_display_preference.sql');
const ignSql=source('supabase/migrations/20261018150000_wallet_currency_ign_branding.sql');
const app=source('App.jsx');
const layout=source('Layout.jsx');
const bar=source('components/casino/PlayerWalletBar.jsx');

test('wallet toolbar is mounted once above all routes, including gameplay and command center',()=>{
 assert.match(app,/import PlayerWalletBar/);
 assert.match(app,/<PlayerWalletBar \/>/);
 assert.ok(app.indexOf('<PlayerWalletBar />')<app.indexOf('<AuthenticatedApp />'));
 assert.doesNotMatch(layout,/<WalletDisplay wallet=/);
 assert.match(layout,/isPlayPage/);
});
test('only existing server balances are displayed, never relabeled or converted',()=>{
 assert.deepEqual(PLAYER_WALLET_CURRENCIES.map(x=>[x.code,x.field]),[
  ['IGN','cent_balance'],['IGD','igd_balance'],['IGT','igt_balance']
 ]);
 assert.equal(playerWalletCurrency('bogus').code,'IGN');
 assert.equal(playerWalletCurrency('CENT').code,'IGN'); // old saved preference alias
 assert.equal(displayWalletBalance({cent_balance:24,igd_balance:7.5,igt_balance:102},'IGD'),'7.5');
 assert.equal(displayWalletBalance({cent_balance:24,igd_balance:7.5,igt_balance:102},'IGN'),'24');
 assert.equal(displayWalletBalance(null,'IGN'),'—');
 assert.equal(displayWalletBalance({},'IGT'),'—');
 assert.match(bar,/Changing the selected balance does not convert, swap or transfer/);
 assert.match(bar,/Practice-table chips and active bets are separate/);
 assert.doesNotMatch(bar,/(?:\.from\(['"](?:transactions|withdrawal_requests|crypto_deposit_observations)['"]\)|\.rpc\(|functions\.invoke\()/);
});
test('preferences are stored separately from wallets and protected with RLS',()=>{
 assert.match(sql,/selected_currency in \('CENT','IGD','IGT'\)/); // preserve original historical migration
 assert.match(ignSql,/set selected_currency='IGN'/);
 assert.match(ignSql,/set default 'IGN'/);
 assert.match(ignSql,/selected_currency in \('IGN','IGD','IGT'\)/);
 assert.doesNotMatch(ignSql,/alter table public\.wallets|update public\.wallets/i);
 assert.match(sql,/enable row level security/);
 assert.match(sql,/for select to authenticated using \(user_id=\(select auth\.uid\(\)\)\)/);
 assert.match(sql,/for insert to authenticated with check \(user_id=\(select auth\.uid\(\)\)\)/);
 assert.match(sql,/for update to authenticated using \(user_id=\(select auth\.uid\(\)\)\)/);
 assert.match(sql,/update \(selected_currency\)/);
 assert.doesNotMatch(sql,/(?:update|insert into) public\.(?:wallets|transactions|withdrawal_requests)/i);
});
test('currency preference is saved, no optimistic unverified success, sign-out hides balance',()=>{
 assert.match(bar,/from\('player_wallet_preferences'\)/);
 assert.match(bar,/setCurrency\(code\)/);
 assert.match(bar,/useState\('IGN'\)/);
 assert.doesNotMatch(bar,/useState\('CENT'\)/);
 assert.match(bar,/if\(response\.error\)throw response\.error/);
 assert.match(bar,/if\(isLoadingAuth\|\|!isAuthenticated\|\|!user\?\.id\)return null/);
 assert.match(bar,/setWallet\(null\);setHasWallet\(false\)/);
 assert.match(bar,/supabase\.from\('wallets'\)\.select\('user_id,cent_balance,igd_balance,igt_balance'\)/);
 assert.match(bar,/\.eq\('user_id',user\.id\)/);
});
