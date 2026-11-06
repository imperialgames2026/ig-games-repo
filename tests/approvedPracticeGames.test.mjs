import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {approvedCatalogRoute} from '../lib/approvedPracticeGames.js';
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('approved catalog routes use the reviewed active practice table entries', () => {
 for (const [slug,route] of [['crash','/PlayCrash'],['poker','/PlayPoker'],['roulette','/PlayRoulette'],['omaha','/PlayOmaha']]) {
  assert.equal(approvedCatalogRoute({slug,route,game_type:'internal',practice_only:true,real_wagers_enabled:false}),route);
 }
});
test('catalog route selection rejects foreign URLs, mismatched games and nonpractice records', () => {
 const game={slug:'crash',route:'/PlayCrash',game_type:'internal',practice_only:true,real_wagers_enabled:false};
 for (const patch of [{route:'https://example.invalid'},{route:'/PlayRocket'},{slug:'mines'},{practice_only:false},{real_wagers_enabled:true},{game_type:'external'}]) {
  assert.equal(approvedCatalogRoute({...game,...patch}),null);
 }
});
test('parked Originals source layouts remain intact for their separate review',()=>{
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

// Homepage and Games must follow the same registry as the private-room selector.
test('homepage catalog count follows the enabled catalog and accurate wording', async () => {
 const {practiceCatalogSummary} = await import('../lib/practiceCatalogSummary.mjs');
 const {pendingPvpGames} = await import('../lib/pvpIntegration.mjs');
 const {approvedPracticeGames} = await import('../lib/approvedPracticeGames.js');
 assert.deepEqual(practiceCatalogSummary('true'), {count:pendingPvpGames.length,label:'Practice variants'});
 for (const flag of [undefined, 'false', '', true]) {
  assert.deepEqual(practiceCatalogSummary(flag), {count:approvedPracticeGames.length,label:'Practice tables'});
 }
 const home=source('pages/Home.jsx'), games=source('pages/Games.jsx');
 assert.match(home,/practiceCatalogSummary\(import\.meta\.env\.VITE_ENABLE_PVP_PRACTICE\)/);
 assert.match(home,/\{practiceCatalog.count\}/);
 assert.match(home,/\{practiceCatalog.label\}/);
 assert.doesNotMatch(home,/Reviewed games/);
 assert.match(games,/\{pendingPvpGames.length\} authored practice variants/);
});
