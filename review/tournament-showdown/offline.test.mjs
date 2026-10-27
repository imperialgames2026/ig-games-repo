// Pure budget, bounded classification and source checks; NOT runtime coverage.
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {awardBudget,transactionDelta,boundedOutcome} from './checks.mjs';import {tournamentShowdown} from './phase.mjs';
test('award budget accepts normal/split awards and rejects unknown or fabricated totals',()=>{
 assert.equal(awardBudget([{seat:0,chips:9000}],[0,1,2],9000),9000);
 assert.equal(awardBudget([{seat:0,chips:4500},{seat:1,chips:4500}],[0,1],9000),9000);
 for(const awards of [[{seat:9,chips:9000}],[{seat:0,chips:9001}],[{seat:0,chips:-1}],[]])assert.throws(()=>awardBudget(awards,[0,1],9000));
});
test('all-in ledger delta must debit stack and credit matching escrow exactly once',()=>{
 transactionDelta({posts:2,net:0,stack:-995,escrow:995},995);
 for(const row of [{posts:3,net:0,stack:-995,escrow:995},{posts:2,net:1,stack:-995,escrow:996},{posts:2,net:0,stack:-994,escrow:994}])assert.throws(()=>transactionDelta(row,995));
});
test('natural ties or no consolidation never become a fabricated success',()=>{
 const tie=boundedOutcome({initial:18,remaining:18,eliminated:0,moved:0,showdowns:2});assert.equal(tie.status,'INCONCLUSIVE_NATURAL_OUTCOME');assert.equal(tie.championObserved,false);
 const partial=boundedOutcome({initial:18,remaining:2,eliminated:16,moved:1,showdowns:2});assert.equal(partial.status,'PASS_BOUNDED_MULTITABLE_SLICE');assert.equal(partial.championObserved,false);assert.ok(partial.unobserved.includes('tournament champion completion'));
 assert.equal(boundedOutcome({initial:18,remaining:1,eliminated:17,moved:1,showdowns:3}).championObserved,true);
});
test('unapproved invocation fails before any HTTP or SQL callback',async()=>{
 let called=0;await assert.rejects(tournamentShowdown({run:'a'.repeat(32),users:[],db:{run:'wrong',sql:()=>{called++;}},call:()=>{called++;}}));assert.equal(called,0);
});
test('phase has only SELECT operator SQL, natural actions and finite MTT fixture',()=>{
 const s=readFileSync(new URL('./phase.mjs',import.meta.url),'utf8');assert.match(s,/maxCycles<=3/);assert.match(s,/players.length,18/);assert.match(s,/format:'scheduled_mtt'/);assert.match(s,/move:'allin'/);assert.match(s,/action:'advance'/);assert.match(s,/action:'settle'/);assert.match(s,/fullAccountingAcceptance:false/);
 assert.doesNotMatch(s,/\b(?:update|insert\s+into|delete\s+from|alter\s+table|create\s+table|set_config)\b/i);
 assert.match(s,/currentSnapshotDenied:true,ownedHistoricalReplay:true/);assert.match(s,/request_ref='\$\{body.actionId\}'/);
});
