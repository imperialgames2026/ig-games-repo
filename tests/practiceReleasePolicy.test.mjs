import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {activePracticeGameRoutes,parkedPracticeGameRoutes,disabledFinancialRoutes} from '../lib/practiceReleasePolicy.js';
import {approvedPracticeGames,approvedCatalogRoute} from '../lib/approvedPracticeGames.js';

test('the current table verification slice contains eight games and the blackjack alias',()=>{
 assert.deepEqual([...activePracticeGameRoutes].sort(),['PlayPoker','PlayOmaha','PlayBlackjack','PlayMultiplayerBlackjack','PlayBaccarat','PlayCraps','PlayRoulette','PlayCrash','PlayTrenball'].sort());
 assert.equal(approvedPracticeGames.length,8);
 for(const game of approvedPracticeGames)assert.ok(activePracticeGameRoutes.includes(game.route.slice(1)));
});
test('parked Originals and Mines cannot become approved catalog routes',()=>{
 for(const route of parkedPracticeGameRoutes){
  assert.equal(activePracticeGameRoutes.includes(route),false);
  assert.equal(approvedCatalogRoute({slug:route.slice(4).toLowerCase(),route:'/'+route,game_type:'internal',practice_only:true,real_wagers_enabled:false}),null);
 }
});
test('financial entry routes mount the notice instead of the request forms',()=>{
 assert.deepEqual([...disabledFinancialRoutes].sort(),['Payments','Withdraw','CryptoWallet','DepositNetworks','PrizeClaims'].sort());
 const app=readFileSync(new URL('../App.jsx',import.meta.url),'utf8');
 assert.match(app,/disabledFinancialRoutes\.has\(path\)[\s\S]*?<ProtectedRoute><PracticeFinancialUnavailable/);
 const notice=readFileSync(new URL('../components/casino/PracticeFinancialUnavailable.jsx',import.meta.url),'utf8');
 assert.doesNotMatch(notice,/supabase|functions\.invoke|useEffect|<form/);
});
test('catalog reads reject unreviewed rows before legacy card-route guessing',()=>{
 const source=readFileSync(new URL('../lib/supabaseLegacyReads.js',import.meta.url),'utf8');
 assert.match(source,/filter\(game => approvedCatalogRoute\(game\) !== null\)/);
 const unavailable=readFileSync(new URL('../components/games/GameUnavailable.jsx',import.meta.url),'utf8');
 assert.doesNotMatch(unavailable,/to="\/PlayDice"/);
 assert.match(unavailable,/parkedPracticeGameRoutes\.includes\(game\)/);
});
