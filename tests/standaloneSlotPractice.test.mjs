import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GAMES,evaluateGrid,validateSpinInput} from '../supabase/functions/ig-slot-practice-v1/validation.js';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const migratedPages=[
 'PlayMysticForest','PlayDiamondDynasty','PlaySapphireStorm','PlayEmeraldEmpire','PlayPhoenixFire',
 'PlayAztecTreasure','PlayOceanTreasure','PlayFarmageddon','PlayNeonNights','PlayCosmicCrown',
 'PlayGoldenDragon','PlayLuckyFortune','PlayRoyalRuby'
];

test('standalone slot practice catalog is bounded to the reviewed 13 cabinets',()=>{
 assert.equal(Object.keys(GAMES).length,13);
 for(const name of migratedPages){
  const page=read('pages/'+name+'.jsx');
  assert.match(page,/StandaloneSlotPracticePage/);
  assert.doesNotMatch(page,/base44|UserWallet|Transaction\.create|WalletDisplay/);
 }
 const engine=read('components/slots/StandaloneSlotGame.jsx');
 assert.match(engine,/ig-slot-practice-v1/);
 assert.doesNotMatch(engine,/base44|generateSlotOutcome|UserWallet|Transaction\.create/);
});

test('practice slot input accepts only bounded canonical games, stake and lines',()=>{
 assert.equal(validateSpinInput('aztec-treasure',1,20),true);
 assert.equal(validateSpinInput('farmageddon',100,6),true);
 for(const args of [['fake',1,1],['aztec-treasure',0,1],['aztec-treasure',101,1],['farmageddon',1,7],['aztec-treasure',1.5,1]])
  assert.equal(validateSpinInput(...args),false);
});

test('five-reel payline evaluation is deterministic and wild-aware',()=>{
 const grid=Array.from({length:5},()=>[4,0,5]);
 const r=evaluateGrid('aztec-treasure',2,1,grid);
 assert.equal(r.scatterCount,0);
 assert.equal(r.paidUnits,200);
 assert.deepEqual(r.winningCells,['0,1','1,1','2,1','3,1','4,1']);
 const wildGrid=Array.from({length:5},()=>[3,3,3]);
 wildGrid[0][1]=7;wildGrid[1][1]=0;wildGrid[2][1]=0;wildGrid[3][1]=4;
 const w=evaluateGrid('aztec-treasure',1,1,wildGrid);
 assert.equal(w.paidUnits,20);
 assert.deepEqual(w.winningCells,['0,1','1,1','2,1']);
});

test('scatter award and winning-cell coordinates are server-derived',()=>{
 const grid=Array.from({length:5},()=>[0,1,2]);
 grid[0][0]=8;grid[2][1]=8;grid[4][2]=8;
 const r=evaluateGrid('aztec-treasure',2,5,grid);
 assert.equal(r.scatterCount,3);
 assert.ok(r.paidUnits>=20);
 for(const cell of ['0,0','2,1','4,2'])assert.ok(r.winningCells.includes(cell));
});

test('slot practice storage is backend-only and cannot touch financial tables',()=>{
 const sql=read('supabase/migrations/20261023180147_standalone_slot_practice_v1.sql');
 const fn=read('supabase/functions/ig-slot-practice-v1/index.ts');
 assert.match(sql,/enable row level security/);
 assert.match(sql,/revoke all on public\.ig_slot_practice_accounts,public\.ig_slot_practice_spins from public,anon,authenticated/i);
 assert.match(sql,/grant execute .* to service_role/i);
 assert.doesNotMatch(sql,/public\.(wallets|transactions|withdrawal_requests)/i);
 assert.match(fn,/auth\.getUser/);
 assert.match(fn,/is_anonymous/);
 assert.match(fn,/realMoneyEnabled:false/);
 assert.match(fn,/ig_slot_practice_spin_v1/);
 assert.doesNotMatch(fn,/\b(?:wallets|transactions|withdrawal_requests)\b/);
});
