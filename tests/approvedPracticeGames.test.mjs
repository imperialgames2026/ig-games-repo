import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {approvedCatalogRoute} from '../lib/approvedPracticeGames.js';
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

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
test('verified originals use fixed mobile cockpit layouts instead of page-scroll gameplay',()=>{
 const files=['components/games/VerifiedOriginalsGame.jsx','components/games/VerifiedMinesGame.jsx','components/games/FinalPracticeGame.jsx','pages/PlayDice.jsx'];
 for(const name of files){
  const text=source(name);
  assert.match(text,/originals-cockpit\.css/);
  assert.match(text,/ig-original-screen/);
  assert.match(text,/ig-original-grid/);
  assert.match(text,/ig-original-controls/);
  assert.match(text,/ig-original-stage/);
  assert.doesNotMatch(text,/overflow-x-auto/);
 }
 const css=source('components/games/originals-cockpit.css');
 assert.match(css,/height:calc\(100dvh - 64px\)/);
 assert.match(css,/overflow:hidden/);
 assert.match(css,/ig-original-extra/);
});
