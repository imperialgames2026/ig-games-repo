// Pure payout arithmetic/coverage/source checks, NOT observed runtime branches.
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {total,blackjackExpected,coverage} from './oracles.mjs';import {createManualCashoutAttempt} from './attempt.mjs';
test('main payout oracle covers naturals push win lose bust and soft aces',()=>{
 assert.equal(total([0,13,9]),12);
 assert.equal(blackjackExpected([0,9],[8,7],2,1).main,5);
 assert.equal(blackjackExpected([0,9],[13,22],2,1).main,2);
 assert.equal(blackjackExpected([9,7],[8,8],2,1).status,'push');
 assert.equal(blackjackExpected([9,22],[8,7],2,1).main,4);
 assert.equal(blackjackExpected([9,5],[9,8],2,1).main,0);
 assert.equal(blackjackExpected([9,7,5],[9,8],2,1).status,'bust');
});
test('pairs payout oracle distinguishes mixed colored perfect and zero',()=>{
 for(const [cards,pair,pairKind]of [[[9,22],6,'mixed'],[[9,48],13,'colored'],[[9,9],26,'perfect'],[[9,8],0,'miss']])assert.deepEqual(Object.fromEntries(Object.entries(blackjackExpected(cards,[8,7],2,1)).filter(([k])=>['pair','pairKind'].includes(k))),{pair,pairKind});
});
test('coverage never fills branches that were not observed',()=>{
 const c=coverage([]);assert.equal(c.mainPositive,false);assert.equal(c.sidePositive,false);assert.equal(c.unobservedMain.length,5);assert.equal(c.unobservedPairs.length,4);
 const one=coverage([{status:'win',main:4,pair:0,pairKind:'miss'}]);assert.equal(one.mainPositive,true);assert.equal(one.mainZero,false);assert.ok(one.unobservedPairs.includes('perfect'));
});
test('source has finite bounds, actual adapters and no outcome/seed overwrite',()=>{
 const s=readFileSync(new URL('./phases.mjs',import.meta.url),'utf8');assert.match(s,/maxBlackjackRounds<=12/);assert.match(s,/maxCrashRounds<=6/);assert.match(s,/db\.race\('different-key grant/);assert.match(s,/db\.race\('competing insufficient funds/);assert.match(s,/fullAccountingAcceptance:false/);assert.match(s,/publicRefund:false/);assert.doesNotMatch(s,/set\s+(?:crash_point|seed_secret|paid_units|duration_ms)\s*=/i);assert.match(s,/p\.phase,'payout'/);
});
test('manual HTTP adapter rejects remote and unapproved targets before fetch',async()=>{
 assert.throws(()=>createManualCashoutAttempt({origin:'https://production.invalid',anon:'not-real'}));const f=createManualCashoutAttempt({origin:'http://127.0.0.1:54321',anon:'not-real'});await assert.rejects(f(null,'ig-crash-v2',{action:'cashout'}));
});

test('manual cashout timing captured before verification SQL and replay',()=>{const s=readFileSync(new URL('./phases.mjs',import.meta.url),'utf8');assert.match(s,/response=await attempt\(a,'ig-crash-v2',body\);const roundTripMs=Date\.now\(\)-started;/);assert.match(s,/cashoutX:Number\(landed\.x\),roundTripMs,/);assert.doesNotMatch(s,/roundTripMs:Date\.now/);});
