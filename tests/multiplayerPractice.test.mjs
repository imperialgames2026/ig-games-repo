import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const sql = source('supabase/migrations/20261017200000_multiplayer_practice_tables.sql');
const api = source('supabase/functions/ig-multiplayer-practice/index.ts');
const felt = source('components/games/MultiplayerPracticeTable.jsx');

test('public Craps and Roulette pages cannot mutate the real wallet', () => {
  for (const name of ['Craps', 'Roulette']) {
    const page = source('pages/Play' + name + '.jsx');
    assert.match(page, /MultiplayerPracticeTable/);
    assert.doesNotMatch(page, /base44|UserWallet|Transaction\.create|onBet=/);
  }
});
test('multiplayer backend is locked to staging with verified authentication', () => {
  assert.match(api, /STAGING_REF = "qonqemhljgxlwpghkxhn"/);
  assert.match(api, /auth\.getUser\(token\)/);
  assert.match(api, /verify_jwt/i.test(api) ? /verify_jwt/i : /createClient\(url, publishable/);
  assert.match(api, /ig_mp_action/);
  assert.match(api, /ig_mp_state/);
  assert.doesNotMatch(api, /(?:from|rpc)\(["'](?:wallets|transactions|withdrawal_requests)["']/);
});
test('database prevents client-managed practice chips and double settlement', () => {
  assert.match(sql, /alter table public\.ig_mp_bets enable row level security/);
  assert.match(sql, /revoke all on public\.ig_mp_tables/);
  assert.match(sql, /grant execute on function public\.ig_mp_action\(.+ to service_role/);
  assert.match(sql, /for update/);
  assert.match(sql, /unique\(game,user_id,request_id\)/);
  assert.match(sql, /unique\(game,round_no\)/);
  assert.match(sql, /v_user_role/);
  assert.doesNotMatch(sql, /\bupdate\s+public\.wallets\b/i);
});
test('multiplayer felt has shooter-only controls and table side-bet zones', () => {
  for (const name of ['pass','dont_pass','field','any_seven']) {
    assert.ok(felt.includes(name), 'missing craps area '+name);
  }
  assert.match(felt, /CRAPS_POINTS = \[4,5,6,8,9,10\]/);
  assert.match(felt, /'place_' \+ num/);
  for (const name of ['red','black','odd','even','dozen_1','column_1','number_0']) {
    assert.ok(felt.includes(name), 'missing roulette area '+name);
  }
  assert.match(felt, /amShooter &&/);
  assert.match(felt, /practice chips/i);
  assert.match(felt, /MultiplayerPracticeTable/);
});

const windowMigration = source('supabase/migrations/20261017201000_multiplayer_betting_windows_and_seats.sql');
const hook = source('hooks/useMultiplayerPractice.js');

test('multiplayer rounds have server-enforced betting windows', () => {
  assert.match(windowMigration, /betting_closes_at/);
  assert.match(windowMigration, /now\(\)\s*>?=\s*t\.betting_closes_at/);
  assert.match(windowMigration, /now\(\)\s*<\s*t\.betting_closes_at/);
  assert.match(windowMigration, /interval '12 seconds'/);
  assert.match(windowMigration, /'bettingClosesAt'/);
  assert.match(windowMigration, /'serverTime'/);
  assert.match(felt, /secondsLeft/);
  assert.match(felt, /canShoot/);
  assert.match(felt, /Leave table/);
});
test('seat release never grants another initial chip allocation', () => {
  assert.match(windowMigration, /p_action='leave'/);
  assert.match(windowMigration, /seated=false/);
  assert.match(windowMigration, /seated=true/);
  assert.match(windowMigration, /count\(\*\) from public\.ig_mp_players where game=p_game and seated/);
  assert.doesNotMatch(windowMigration, /set chips\s*=\s*1000/);
  assert.match(api, /"leave"/);
  assert.match(hook, /leave: \(\) => action\('leave'\)/);
});

const reclamation = source('supabase/migrations/20261017201500_multiplayer_idle_seat_reclamation.sql');
test('inactive-seat recovery is not a chip reset or wallet operation', () => {
  assert.match(reclamation, /seen_at < now\(\)-interval '10 minutes'/);
  assert.match(reclamation, /set seated=false/);
  assert.match(reclamation, /t\.shooter_id := null/);
  assert.doesNotMatch(reclamation, /set chips\s*=/i);
  assert.doesNotMatch(reclamation, /public\.wallets/i);
});
