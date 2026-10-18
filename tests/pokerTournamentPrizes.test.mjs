import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const db=read('supabase/migrations/20261018041500_poker_tournament_prizes_100_places.sql');
const snapshot=read('supabase/migrations/20261018042500_poker_event_prize_plan_snapshot.sql');
const edge=read('supabase/functions/ig-poker-tournament-admin/index.ts');
const ui=read('components/admin/TournamentPayoutEditor.jsx');
const page=read('pages/SuperadminPokerTournaments.jsx');
test('payout schedule 1-100 places, bounded by actual configured tournament capacity',()=>{
 assert.match(db,/place integer not null check\(place between 1 and 100\)/);
 assert.match(db,/paid_places between 0 and 100 and paid_places<=seats_per_table\*table_count/);
 assert.match(db,/v_count>least\(100,p.seats_per_table\*p.table_count\)/);
 assert.match(db,/v_place<>v_i/);
 assert.match(db,/v_amount<=0 or v_amount>1000000000/);
 assert.match(ui,/Array\.from\(\{length:count\}/);
 assert.match(ui,/\(0–\{maximum\}\)/);
 assert.match(page,/Configure prize positions \(up to 100\)/);
});
test('saved prize ladder is superadmin-only, audited, revisioned, no transfer execution',()=>{
 assert.match(db,/v_role is distinct from 'superadmin'/);
 assert.match(db,/p_expected_revision is distinct from p.payout_revision/);
 assert.match(db,/ig_poker_tournament_award_audit/);
 assert.match(db,/payoutsActivated',false/);
 assert.match(db,/revoke all on function public.ig_poker_tournament_awards_save/);
 assert.match(edge,/role\?\.role!=="superadmin"/);
 assert.match(edge,/ig_poker_tournament_awards_save/);
 assert.doesNotMatch(edge,/(?:sendTransaction|signTransaction|transferFrom|withdrawal\.approve)/i);
});
test('event prize schedule snapshots are immutable as a versioned event draft',()=>{
 assert.match(snapshot,/awardScheduleHash/);
 assert.match(snapshot,/v_hash:=encode\(extensions\.digest/);
 assert.match(snapshot,/jsonb_array_length\(v_awards\)<>p.paid_places/);
 assert.match(snapshot,/PRIZE_PLACES_EXCEED_ENTRANTS/);
 assert.match(snapshot,/'payoutsActivated',false/);
});
test('market quote never invents unsupported proprietary token prices',()=>{
 assert.match(edge,/indicativeQuote/);
 assert.match(edge,/CoinGecko public indicative quote/);
 assert.match(edge,/open.er-api.com \(reference FX rate\)/);
 assert.match(edge,/PRACTICE","IC","ID","IGD","IGN","ZEPH"/);
 assert.match(edge,/No independently verified market quote/);
 assert.match(edge,/Date\.now\(\)\/1000-last\)>3600/);
 assert.match(ui,/Market value unavailable/);
 assert.match(ui,/not guaranteed settlement values/);
});

test('prize lookup is authenticated, read-only and hides unpublished drafts',()=>{
 const viewer=read('supabase/functions/ig-poker-tournament-prizes/index.ts');
 const page=read('pages/PokerTournamentPrizes.jsx');
 assert.match(viewer,/auth\.auth\.getUser\(token\)/);
 assert.match(viewer,/\["registration","running","finished"\]\.includes/);
 assert.match(viewer,/event\.config\?\.practiceOnly!==true/);
 assert.match(viewer,/awardScheduleHash/);
 assert.match(viewer,/payoutsActivated:false/);
 assert.doesNotMatch(viewer,/\.insert\(|\.update\(|\.delete\(|\.rpc\(/);
 assert.match(page,/Tournament prize ladder/);
 assert.match(page,/indicative|Indicative/);
 assert.match(read('components/games/HoldemPracticeTable.jsx'),/PokerTournamentPrizes\?eventId=/);
});
