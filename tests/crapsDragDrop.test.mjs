import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validCrapsDropTarget,canDropCrapsChip} from '../lib/crapsChipDragRules.js';
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const game=source('components/games/MultiplayerPracticeTable.jsx');
const css=source('components/games/craps-casino.css');

test('all existing craps wager zones accept a chip during eligible come-out',()=>{
  for(const target of ['pass','dont_pass','field','any_seven','place_4','place_5','place_6','place_8','place_9','place_10']){
    assert.equal(validCrapsDropTarget(target,null),true,target);
  }
});
test('point phase prevents new pass-line wagers while place, field and any-seven remain eligible',()=>{
  for(const target of ['pass','dont_pass'])assert.equal(validCrapsDropTarget(target,9),false);
  for(const target of ['place_4','place_9','field','any_seven'])
    assert.equal(validCrapsDropTarget(target,9),true);
  for(const target of ['place_7','any_eleven','roulette_red','',null])
    assert.equal(validCrapsDropTarget(target,null),false);
});
test('dragging never bypasses bet window, balance, stake or account restrictions',()=>{
  const base={enabled:true,blocked:false,amount:25,available:50,target:'field',point:null};
  assert.equal(canDropCrapsChip(base),true);
  for(const bad of [
    {enabled:false},{blocked:true},{amount:100},{amount:0},{amount:-1},
    {amount:101},{amount:1.5},{available:24},{available:NaN},
    {target:'place_7'},{target:'pass',point:9}
  ])assert.equal(canDropCrapsChip({...base,...bad}),false,JSON.stringify(bad));
});
test('pointer events support mobile touch and desktop without browser-native drag API',()=>{
  assert.match(game,/onPointerDown:event=>begin\(event,amount\)/);
  assert.match(game,/onPointerMove:move/);
  assert.match(game,/onPointerUp:end/);
  assert.match(game,/onPointerCancel:cancel/);
  assert.match(game,/setPointerCapture/);
  assert.match(game,/document\.elementFromPoint/);
  assert.match(game,/data-craps-bet-target/);
  assert.match(game,/setHovered\(pickTarget/);
  assert.match(game,/const target=g\.moved\?pickTarget/);
  assert.match(game,/if\(!g\.moved\)return;/);
  assert.match(css,/touch-action:none/);
  assert.match(css,/pointer-events:none/);
});
test('dragged chips submit only to authenticated existing practice betting RPC',()=>{
  assert.match(game,/onDrop:async\(target,amount\)=>/);
  assert.match(game,/await placeBet\(target,amount\)/);
  assert.match(game,/inFlight\.current=true/);
  assert.match(game,/inFlight\.current=false/);
  assert.match(game,/setNotice\(ok\?'Placed/);
  assert.match(game,/mine\(target\)/);
  assert.match(game,/function CrapsChipRack/);
  assert.match(game,/function CrapsBettingCard/);
  assert.doesNotMatch(game,/\.from\(['"]wallets['"]\)|Math\.random\(\)/);
});
