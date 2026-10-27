import assert from 'node:assert/strict';
export function units(n){assert.ok(Number.isSafeInteger(n)&&n>=0,'invalid chip units');return n;}
export function awardBudget(awards,seats,pot){
 units(pot);assert.ok(Array.isArray(awards)&&awards.length>0);const valid=new Set(seats);let total=0;
 for(const row of awards){assert.ok(valid.has(row.seat),'award to unknown seat');total+=units(row.chips);units(total);}assert.equal(total,pot,'award sum differs from escrow');return total;
}
export function transactionDelta(rows,paid){
 assert.equal(rows.posts,2);assert.equal(Number(rows.net),0);assert.equal(Number(rows.stack),-paid);assert.equal(Number(rows.escrow),paid);
}
export function boundedOutcome({initial,remaining,eliminated,moved,showdowns}){
 assert.ok(Number.isInteger(remaining)&&remaining>=1&&remaining<=initial);
 const consolidationObserved=eliminated>0&&remaining<=9&&moved>0;
 return {showdownObserved:showdowns>0,eliminationObserved:eliminated>0,consolidationObserved,championObserved:remaining===1,
  status:showdowns>0&&consolidationObserved?'PASS_BOUNDED_MULTITABLE_SLICE':'INCONCLUSIVE_NATURAL_OUTCOME',
  unobserved:[...(eliminated?[]:['natural elimination']),...(consolidationObserved?[]:['natural cross-table consolidation']),...(remaining===1?[]:['tournament champion completion'])]};
}
