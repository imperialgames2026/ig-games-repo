import test from 'node:test';import assert from 'node:assert/strict';
import {serverPresentation,serverTarget,serverMarkers} from '../components/practice/multiplayer-visual.mjs';
test('shared results map to stable presentation IDs without changing outcomes',()=>{
 const r={game:'roulette',round:9,number:0};const a=serverPresentation('roulette',r);assert.deepEqual(a.values,[0]);assert.equal(a.roundId,serverPresentation('roulette',r).roundId);assert.ok(Object.isFrozen(a.values));
 const d={game:'craps',round:9,dice:[2,4]};const b=serverPresentation('craps',d);d.dice[0]=6;assert.deepEqual(b.values,[2,4]);assert.notEqual(a.roundId,b.roundId);
 for(const r of [{game:'roulette',round:0,number:1},{game:'roulette',round:1,number:37},{game:'craps',round:1,dice:[0,6]}])assert.equal(serverPresentation(r.game,r),null);
 assert.equal(serverPresentation('roulette',{game:'craps',round:1,dice:[2,4]}),null);
});
test('felt taps map only to supported server wager targets',()=>{
 assert.equal(serverTarget('roulette','0'),'number_0');assert.equal(serverTarget('roulette','36'),'number_36');assert.equal(serverTarget('roulette','red'),'red');assert.equal(serverTarget('craps','pass'),'pass');assert.equal(serverTarget('craps','red'),null);assert.equal(serverTarget('roulette','dozen_1'),null);
});
test('only confirmed server totals create markers; unsupported bets remain in server panels',()=>{
 assert.deepEqual(serverMarkers('roulette',[{target:'red',units:5},{target:'red',units:10},{target:'number_0',units:25},{target:'dozen_1',units:20},{target:'black',units:-4}]),[{selection:'red',amount:15},{selection:'0',amount:25}]);
 assert.deepEqual(serverMarkers('craps',[{target:'pass',units:15},{target:'field',units:20}]),[{selection:'pass',amount:15}]);
});
