import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const scene=readFileSync('components/games/3d/GameTableScene3D.jsx','utf8');
const multi=readFileSync('components/games/MultiplayerPracticeTable.jsx','utf8');
const blackjack=readFileSync('components/games/BlackjackPracticeTable.jsx','utf8');
const shared=readFileSync('components/games/SharedEventPracticeTable.jsx','utf8');
const poker=readFileSync('components/games/HoldemPracticeTable.jsx','utf8');

test('shared 3D layer renders tables, chips, cards, roulette and dice without settlement authority',()=>{
  assert.match(scene,/WebGLRenderer/);
  assert.match(scene,/ROULETTE/);
  assert.match(scene,/addChipStack/);
  assert.match(scene,/BoxGeometry\(\.72/);
  assert.match(scene,/PlaneGeometry\(\.78/);
  assert.doesNotMatch(scene,/supabase|wallet|settle|withdraw|deposit/i);
});

test('roulette and craps production practice table use shared 3D presentation',()=>{
  assert.match(multi,/GameTableScene3D/);
  assert.match(multi,/game=\{game\}/);
  assert.match(multi,/outcome=\{last\}/);
});

test('blackjack and baccarat use shared 3D table presentation',()=>{
  assert.match(blackjack,/game="blackjack"/);
  assert.match(blackjack,/dealerCards\.map/);
  assert.match(shared,/game="baccarat"/);
});

test('holdem and omaha use shared 3D table presentation',()=>{
  assert.match(poker,/isOmaha\?'omaha':'poker'/);
  assert.match(poker,/table\?\.board/);
  assert.match(poker,/seats=\{seats\}/);
});
