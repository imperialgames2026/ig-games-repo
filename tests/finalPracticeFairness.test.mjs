import test from 'node:test';
import assert from 'node:assert/strict';
import {finalSample,finalCard,towerLayout,verifyFinalRound} from '../lib/finalPracticeFairness.js';
import {sha256Hex} from '../lib/practiceFairDice.js';
const seed='ab'.repeat(32),client='client:unicode-🎲';
test('final games match independent Python HMAC vectors',async()=>{
 assert.equal(await finalSample(seed,client,'darts',0,100),30);assert.equal(await finalSample(seed,client,'dicezone',0,100),11);
 assert.deepEqual(await finalCard(seed,client,0),{rank:9,suit:0});assert.deepEqual(await finalCard(seed,client,1),{rank:4,suit:3});
 assert.deepEqual(await towerLayout(seed,client,'easy'),[[0],[1],[1],[0],[0],[2],[0],[0],[2]]);
});
test('final proofs bind original inputs and replay the full HiLo/Towers transcript',async()=>{
 for(const game of ['darts','dicezone','hilo','towers']){
  const options=game==='hilo'?{}:game==='dicezone'?{start:1,end:50}:{difficulty:'easy'};
  const commit={roundId:'round',game,options,serverSeedHash:await sha256Hex(seed),clientSeed:client,algorithm:'hmac-sha256-final-v1',practiceOnly:true};
  const state={...commit,phase:'ended',version:1,serverSeed:seed,history:[],endReason:'completed',outcome:game==='darts'?{zone:0,multiplier:.5}:game==='dicezone'?{roll:12,won:true}:null};
  if(game==='hilo'){state.history=[{choice:'lowerOrSame',card:{rank:4,suit:3},won:true}];state.outcome={rank:4,suit:3};state.endReason='stopped';state.version=3;}
  if(game==='towers'){state.history=[{tile:1,safe:true}];state.layout=await towerLayout(seed,client,'easy');state.endReason='stopped';state.version=3;}
  assert.equal(await verifyFinalRound(commit,state),true,game);
  for(const patch of [{clientSeed:'changed'},{serverSeedHash:'00'.repeat(32)},{options:{}},{algorithm:'other'},{practiceOnly:false}]){
   if(game==='hilo'&&patch.options)continue;
   assert.equal(await verifyFinalRound(commit,{...state,...patch}),false,game);
  }
  if(game==='hilo'||game==='towers')assert.equal(await verifyFinalRound(commit,{...state,endReason:'cleared'}),false);
 }
});
