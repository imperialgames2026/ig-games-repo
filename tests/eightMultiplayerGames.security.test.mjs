import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {activePracticeGameRoutes} from '../lib/practiceReleasePolicy.js';

const file = p => readFileSync(new URL('../'+p,import.meta.url),'utf8');
const app=file('App.jsx'), lobby=file('pages/Games.jsx');
const expected={
  PlayPoker:'HoldemPracticeTable',PlayOmaha:'HoldemPracticeTable',
  PlayBlackjack:'BlackjackPracticeTable',PlayMultiplayerBlackjack:'BlackjackPracticeTable',
  PlayBaccarat:'SharedEventPracticeTable',
  PlayCraps:'MultiplayerPracticeTable',PlayRoulette:'MultiplayerPracticeTable',
  PlayCrash:'CrashPracticeV2',PlayTrenball:'CrashPracticeV2',
};

test('requested eight games have staging-only authorized multiplayer routes',()=>{
  for(const [name,engine] of Object.entries(expected)){
    const page=file('pages/'+name+'.jsx');
    assert.ok(activePracticeGameRoutes.includes(name),name+' not allowlisted');
    assert.ok(page.includes(engine),name+' not wired to new engine');
    assert.doesNotMatch(page, /base44|Transaction\.create|UserWallet\.update|WalletDisplay/);
  }
  assert.match(app,/new Set\(activePracticeGameRoutes\)/);
  for(const name of ['PlayPoker','PlayOmaha','PlayBlackjack','PlayBaccarat','PlayCraps','PlayRoulette','PlayCrash','PlayTrenball'])
    assert.ok(lobby.includes("createPageUrl('"+name+"')"),name+' missing in lobby');
});

test('card rooms never call legacy wallet mutation or financial settlement',()=>{
  const files=['components/games/HoldemPracticeTable.jsx','components/games/BlackjackPracticeTable.jsx',
    'components/games/SharedEventPracticeTable.jsx','components/games/MultiplayerPracticeTable.jsx',
    'hooks/useBlackjackPractice.js','hooks/useSharedEventPractice.js'];
  for(const name of files){
    const text=file(name);
    assert.doesNotMatch(text, /base44|UserWallet|Transaction\.create|SUPABASE_SERVICE_ROLE_KEY/);
  }
});

test('Crash and Trenball derive predictions from same shared server round',()=>{
  const sql=file('supabase/migrations/20261017202000_crash_trenball_baccarat_practice.sql');
  const ui=file('components/games/SharedEventPracticeTable.jsx');
  for(const target of ['tren_red','tren_green','tren_moon','auto_150','auto_200','auto_500'])
    assert.ok(sql.includes("'"+target+"'"),target+' not supported server side');
  assert.match(sql,/matched:=v_crash<200/);
  assert.match(sql,/matched:=v_crash>=200/);
  assert.match(sql,/matched:=v_crash>=1000/);
  assert.match(sql,/public\.ig_mp_random\(10000\)/);
  assert.match(ui,/const game=mode==='baccarat'\?'baccarat':'crash'/);
  assert.match(ui,/Shared multiplayer/);
});

test('Baccarat uses eight-deck card shoe and rule-governed third card',()=>{
  const sql=file('supabase/migrations/20261017202000_crash_trenball_baccarat_practice.sql');
  assert.match(sql,/generate_series\(1,416\)/);
  assert.match(sql,/player_third/);
  assert.match(sql,/b_total=6 and player_third between 6 and 7/);
  assert.match(sql,/1\.95/);
  assert.match(sql,/winner='tie' and bet\.target in \('player','banker'\)/);
});

test('Blackjack dealer and side-bet transactions are server-owned',()=>{
  const sql=file('supabase/migrations/20261017203000_multiplayer_blackjack_practice.sql');
  assert.match(sql,/t\.turn_actor<>p_actor/);
  assert.match(sql,/public\.ig_bj_total/);
  assert.match(sql,/player\.pairs_bet\*26/);
  assert.match(sql,/player\.pairs_bet\*13/);
  assert.match(sql,/player\.pairs_bet\*6/);
  assert.match(sql,/dealer_visible:=case when room\.phase='playing'/);
  assert.match(sql,/for update/);
  assert.doesNotMatch(sql,/public\.(wallets|transactions|withdrawal_requests)/);
});

test('Omaha has exactly two hole cards and exactly three board cards',()=>{
  const handler=file('supabase/functions/poker-table-v1/index.ts');
  const sql=file('supabase/migrations/20261017204000_omaha_four_card_poker.sql');
  const fix=file('supabase/migrations/20261017204500_poker_deck_offset_fix.sql');
  assert.match(handler,/hole\.length!==4/);
  assert.match(handler,/board\.length!==5/);
  assert.match(handler,/score5\(\[hole\[a\],hole\[b\],board\[x\],board\[y\],board\[z\]\]\)/);
  assert.match(handler,/variant==="omaha"\?"poker_start_omaha_v1":"poker_start_v2"/);
  assert.match(handler,/bestOmaha/);
  assert.match(sql,/p_deck->\(idx\+3\*players\)/);
  assert.match(sql,/hole_count:=case when t\.variant='omaha' then 4 else 2 end/);
  assert.match(fix,/dealt_count=players/);
  assert.match(fix,/t\.variant<>'holdem'/);
});

test('server handlers reject unauthenticated real money action paths',()=>{
  for(const name of ['ig-shared-event-practice','ig-blackjack-practice','ig-multiplayer-practice','poker-table-v1']){
    const text=file('supabase/functions/'+name+'/index.ts');
    assert.match(text,/auth\.getUser/);
    assert.doesNotMatch(text, /\bdb\.from\(["'](?:wallets|transactions|withdrawal_requests)["']/);
  }
});

test('Blackjack, Baccarat, Crash and Trenball use compact in-game cockpits with direct wager sizing',()=>{
  const blackjack=file('components/games/BlackjackPracticeTable.jsx');
  const shared=file('components/games/SharedEventPracticeTable.jsx');
  const crash=file('components/games/CrashPracticeV2.jsx');
  for(const text of [blackjack,shared,crash]){
    assert.match(text,/game-cockpit\.css/);
    assert.match(text,/÷2/);
    assert.match(text,/×2/);
  }
  assert.match(blackjack,/ig-blackjack-screen/);
  assert.match(shared,/ig-shared-screen/);
  assert.match(crash,/ig-crash-screen/);
  assert.doesNotMatch(blackjack,/overflow-x-auto/);
  assert.doesNotMatch(shared,/overflow-x-auto/);
  assert.doesNotMatch(crash,/overflow-x-auto/);
});

test('Blackjack abandoned turns expire on server clock without giving browser authority',()=>{
  const migration=file('supabase/migrations/20261017205500_blackjack_turn_timeouts.sql');
  const api=file('supabase/functions/ig-blackjack-practice/index.ts');
  const hook=file('hooks/useBlackjackPractice.js');
  assert.match(migration,/create or replace function public\.ig_bj_timeout/);
  assert.match(migration,/room\.turn_deadline_at>clock_timestamp\(\)/);
  assert.match(migration,/set stood=true where user_id=room\.turn_actor/);
  assert.match(migration,/t\.turn_deadline_at<=clock_timestamp\(\)/);
  assert.match(migration,/grant execute on function public\.ig_bj_timeout\(uuid\) to service_role/);
  assert.match(api, /action==="tick"\?"ig_bj_timeout":"ig_bj_action"/);
  assert.match(hook,/latest\.current\?\.joined\?'tick':'state'/);
  assert.doesNotMatch(migration,/public\.(wallets|transactions|withdrawal_requests)/);
});


test('Retained shared-event engine enforces nonredeemable rounds and fixed payouts',()=>{
  const engine=file('supabase/migrations/20261017202000_crash_trenball_baccarat_practice.sql');
  const screen=file('components/games/SharedEventPracticeTable.jsx');
  const hook=file('hooks/useSharedEventPractice.js');
  const crash=file('pages/PlayCrash.jsx');
  const trenball=file('pages/PlayTrenball.jsx');
  assert.match(crash,/initialMode='crash'/);
  assert.match(trenball,/initialMode='trenball'/);
  assert.match(screen,/const game=mode==='baccarat'\?'baccarat':'crash'/);
  assert.match(hook,/ig-shared-event-practice/);
  assert.match(engine,/p_game='crash'/);
  assert.match(engine,/tren_red'[\s\S]{0,90}matched:=v_crash<200/);
  assert.match(engine,/tren_green'[\s\S]{0,90}matched:=v_crash>=200/);
  assert.match(engine,/tren_moon'[\s\S]{0,90}matched:=v_crash>=1000/);
  assert.match(engine,/decimal_multiplier:=1\.96/);
  assert.match(engine,/decimal_multiplier:=10/);
  assert.match(engine,/update public\.ig_event_seats set chips=chips\+paid/);
  assert.match(engine,/unique\(game,user_id,request_id\)/);
  assert.match(engine,/unique\(game,round_no\)/);
  assert.match(engine,/now\(\)<room\.betting_closes_at/);
  assert.doesNotMatch(engine,/public\.(?:wallets|transactions|withdrawal_requests)/i);
  const rollback=file('supabase/tests/shared_crash_trenball_transactional.sql');
  assert.match(rollback,/^BEGIN;/m);
  assert.match(rollback,/^ROLLBACK;/m);
  for(const outcome of ['Classic 2x auto cashout mismatch','Trenball red payout mismatch',
    'Trenball green payout mismatch','Trenball moon payout mismatch','Idempotent replay failed']) {
    assert.ok(rollback.includes(outcome),outcome+' staging regression test missing');
  }
});
