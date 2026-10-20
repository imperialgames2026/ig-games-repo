import test from 'node:test';
import assert from 'node:assert/strict';
import {approvedCatalogRoute} from '../lib/approvedPracticeGames.js';

test('approved catalog routes override legacy slug guesses for Crash and Originals', () => {
 for (const [slug,route] of [['crash','/PlayCrash'],['coin-flip','/PlayCoinFlip'],['hashdice','/PlayHashDice'],['omaha','/PlayOmaha']]) {
  assert.equal(approvedCatalogRoute({slug,route,game_type:'internal',practice_only:true,real_wagers_enabled:false}),route);
 }
});
test('catalog route selection rejects foreign URLs, mismatched games and nonpractice records', () => {
 const game={slug:'crash',route:'/PlayCrash',game_type:'internal',practice_only:true,real_wagers_enabled:false};
 for (const patch of [{route:'https://example.invalid'},{route:'/PlayRocket'},{slug:'mines'},{practice_only:false},{real_wagers_enabled:true},{game_type:'external'}]) {
  assert.equal(approvedCatalogRoute({...game,...patch}),null);
 }
});
