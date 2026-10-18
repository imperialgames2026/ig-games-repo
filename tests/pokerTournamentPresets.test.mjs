import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=read('supabase/migrations/20261018013000_poker_tournament_staging_presets.sql');
const api=read('supabase/functions/ig-poker-tournament-admin/index.ts');
const ui=read('pages/SuperadminPokerTournaments.jsx');
const desk=read('pages/PokerMultiTable.jsx');
const routes=read('App.jsx');
test('superadmin tournament presets are staging-only and 6-8 seats x 1-30 tables',()=>{
 assert.match(sql,/seats_per_table between 6 and 8/);
 assert.match(sql,/table_count between 1 and 30/);
 assert.match(sql,/v_role is distinct from 'superadmin'/);
 assert.match(sql,/real_money_enabled boolean not null default false check\(real_money_enabled=false\)/);
 assert.match(sql,/fee_collection_enabled boolean not null default false check\(fee_collection_enabled=false\)/);
 assert.match(sql,/rake_from_forced_bets boolean not null default false check\(rake_from_forced_bets=false\)/);
 assert.match(sql,/v_variant='omaha' and v_seats<>6/);
 assert.match(sql,/to service_role/);
 assert.match(routes, /path==='SuperadminPokerTournaments' \? \['superadmin'\]/);
});
test('rake controls are an uncollected draft, not wallet deductions',()=>{
 assert.match(ui,/Rake percentage per contested pot/);
 assert.match(ui,/Never rake forced small blinds, big blinds or antes/);
 assert.match(ui,/Bomb Pot specification \(not yet playable\)/);
 assert.match(sql,/rake_bps between 0 and 1000/);
 assert.match(sql,/rakeCollected',false/);
 assert.doesNotMatch(api,/\.from\(["'](?:wallets|transactions|withdrawal_requests)["']/);
 assert.match(api,/auth\.getUser\(token\)/);
 assert.match(api,/role\?\.role!=="superadmin"/);
});
test('three independent practice table views have a hard limit',()=>{
 assert.match(desk,/\.slice\(0,3\)/);
 assert.match(desk,/tables\.length>=3/);
 assert.match(desk,/\/PlayPoker\?tableId=/);
 assert.match(desk,/iframe/);
 assert.match(read('components/games/HoldemPracticeTable.jsx'),/PokerMultiTable/);
});
