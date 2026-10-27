import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync}from'node:fs';import vm from'node:vm';import ts from'typescript';
const source=readFileSync(new URL('../supabase/functions/poker-table-v1/index.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source.replace(/^import[^\n]*\n/,''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const context={Deno:{serve:()=>{}}};vm.runInNewContext(compiled+';globalThis.awardForTest=awards;',context);
const board=[10,11,12,13,14].map(rank=>({rank,suit:'s'}));
for(const capacity of [2,4,6,8,9])test(`actual evaluator conserves tied pots clockwise at capacity ${capacity}`,()=>{
 const last=capacity-1;const seats=[{seat_no:0,committed:1,folded:false,private_hole:[{rank:2,suit:'c'},{rank:3,suit:'c'}]},{seat_no:last,committed:1,folded:false,private_hole:[{rank:4,suit:'d'},{rank:5,suit:'d'}]}];
 if(capacity>2)seats.push({seat_no:1,committed:1,folded:true,private_hole:[]});
 for(let button=0;button<capacity;button++){
  const paid=JSON.parse(JSON.stringify(context.awardForTest(seats,board,button,'holdem',capacity)));
  const ordered=[0,last].sort((a,b)=>((a-button-1+capacity)%capacity)-((b-button-1+capacity)%capacity));
  assert.deepEqual(paid.map(x=>x.seat),ordered);assert.equal(paid.reduce((n,x)=>n+x.chips,0),seats.length);
  assert.equal(paid[0].chips,capacity===2?1:2);assert.equal(paid[1].chips,1);
 }
});
