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
 assert.match(routes, /\['SuperadminPokerTournaments', 'AdminUsers', 'PokerBotLab'\]\.includes\(path\)/);
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

test('configured MTT start enforces 6-8 seats and <=30 physical tables',()=>{
 const migration=read('supabase/migrations/20261018014500_mtt_seat_table_limits.sql');
 assert.match(migration,/max_seats=\(e.config->>'seatsPerTable'\)::int/);
 assert.match(migration,/max_seats<6 OR max_seats>8/);
 assert.match(migration,/table_count>\(e.config->>'tableCount'\)::integer/);
 assert.match(migration,/generate_series\(0,greatest\(6,least\(8,\(e.config->>'seatsPerTable'\)::int\)\)-1\)i/);
});
test('only zero-price practice preset can create tournament draft events',()=>{
 const migration=read('supabase/migrations/20261018015000_poker_preset_create_draft_event.sql');
 assert.match(migration,/p.currency<>'PRACTICE' or p.buy_in_units<>0/);
 assert.match(migration,/poker_event_create_v1/);
 assert.match(migration,/'maxPlayers',p.seats_per_table\*p.table_count/);
 assert.match(migration,/'rakeCollected',false/);
 assert.match(api,/ig_poker_create_event_from_preset/);
 assert.match(ui,/Create draft event/);
});

test('numeric preset fields remain clearable while editing and normalize on save',()=>{
 assert.match(ui,/change\('tableCount',e\.target\.value\)/);
 assert.match(ui,/change\('initialStack',e\.target\.value\)/);
 assert.match(ui,/change\('blindLevels',\[\{\.\.\.form\.blindLevels\[0\],small:e\.target\.value\}\]\)/);
 assert.match(ui,/change\('rakePercent',e\.target\.value\)/);
 assert.match(ui,/rakeBps:Math\.round\(numberValue\(rakePercent\)\*100\)/);
 assert.match(ui,/config:numberConfig\(form\)/);
 assert.doesNotMatch(ui,/change\('tableCount',Number\(e\.target\.value\)\)/);
});
