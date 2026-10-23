import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createVisibleRounds} from '../components/practice/visible-rounds.mjs';
import {tableReducer, initialTableState} from '../components/practice/practice-rules.mjs';
function fixture() {
 let time=0, hidden=false, serial=0; const tasks=new Map(), callbacks=[];
 const clock={hidden:()=>hidden, now:()=>time, set(fn,ms){const id=++serial;tasks.set(id,{fn,at:time+ms});callbacks.push(fn);return id;},clear:id=>tasks.delete(id)};
 const rounds=createVisibleRounds(clock);
 return {rounds,callbacks, hide(){hidden=true;rounds.visibilityChanged();},show(){hidden=false;rounds.visibilityChanged();},rawHide(){hidden=true;},tick(ms){const end=time+ms;for(;;){const entry=[...tasks].sort((a,b)=>a[1].at-b[1].at)[0];if(!entry||entry[1].at>end)break;time=entry[1].at;tasks.delete(entry[0]);entry[1].fn();}time=end;},tasks};
}
for(const game of ['roulette','craps'])for(const auto of [false,true])for(const duration of [35000,60000])test(`${game}: hide ${duration}ms during animation, auto=${auto}`,()=>{
 const f=fixture();let settlements=0,plays=0;
 let state=tableReducer({...initialTableState,game},{type:'place',selection:game==='roulette'?'red':'pass',amount:10});
 const reserved=structuredClone(state), outcome={version:1,mode:'practice',roundId:'11111111-1111-4111-8111-111111111111',game,values:game==='roulette'?[1]:[3,4]};
 const expected=tableReducer(state,{type:'settle',outcome});
 const finish=()=>{state=tableReducer(state,{type:'settle',outcome});settlements++;f.rounds.scheduleAuto(auto?()=>plays++:null);};
 assert(f.rounds.start('round',30000,finish));f.tick(5000);f.hide();f.tick(duration);
 assert.equal(settlements,0);assert.equal(plays,0);assert.deepEqual(state,reserved);assert.equal(f.rounds.canPlay(),false);
 assert.equal(f.rounds.start('hidden',30000,finish),false);
 f.show();f.tick(24999);assert.equal(settlements,0);f.tick(1);assert.equal(settlements,1);
 f.tick(1399);assert.equal(plays,0);f.tick(1);assert.equal(plays,auto?1:0);
 f.rounds.complete('round');assert.equal(settlements,1);assert.deepEqual(state,expected);assert.notDeepEqual(state,reserved);
});
test('hidden completion waits for visibility; duplicate and stale callbacks cannot settle twice',()=>{
 const f=fixture();let n=0;f.rounds.start('a',30000,()=>n++);const stale=f.callbacks.at(-1);
 f.tick(1000);f.hide();f.rounds.complete('wrong');f.rounds.complete('a');f.rounds.complete('a');stale();f.tick(60000);assert.equal(n,0);
 f.show();assert.equal(n,1);stale();f.rounds.complete('a');assert.equal(n,1);
 f.rounds.start('b',30000,()=>n++);stale();f.rounds.complete('a');assert.equal(n,1);f.rounds.complete('b');assert.equal(n,2);
});
test('inter-round hide resets full delay; repeated hide/resume cannot catch up; disabling auto cancels',()=>{
 const f=fixture();let n=0;f.rounds.scheduleAuto(()=>n++);const stale=f.callbacks.at(-1);f.tick(1200);f.hide();f.tick(60000);assert.equal(n,0);
 f.show();stale();f.tick(1399);assert.equal(n,0);f.hide();f.tick(35000);f.show();f.tick(1400);assert.equal(n,1);f.tick(60000);assert.equal(n,1);
 f.rounds.scheduleAuto(()=>n++);f.hide();f.rounds.scheduleAuto(null);f.show();f.tick(60000);assert.equal(n,1);
});
test('watchdog/completion race and canceled timer after resume are exactly once',()=>{
 for(const completionFirst of [true,false]){const f=fixture();let n=0;f.rounds.start('a',30000,()=>n++);const stale=f.callbacks.at(-1);
 f.tick(1000);f.hide();f.show();stale();assert.equal(n,0);
 if(completionFirst)f.rounds.complete('a');f.tick(29000);f.rounds.complete('a');assert.equal(n,1);}
});
test('hidden guard works even before visibility event; dispose rejects pending callbacks',()=>{
 const f=fixture();let n=0;f.rounds.start('a',100,()=>n++);const stale=f.callbacks.at(-1);f.rawHide();f.tick(100);assert.equal(n,0);f.rounds.complete('a');assert.equal(n,0);
 f.rounds.dispose();f.show();stale();f.rounds.complete('a');f.rounds.scheduleAuto(()=>n++);f.tick(60000);assert.equal(n,0);assert.equal(f.rounds.canPlay(),false);
});
test('TableLab routes timing, completion, play, bets and unmount through visibility controller',()=>{
 const source=readFileSync(new URL('../pages/TableLab.jsx',import.meta.url),'utf8');
 assert.match(source,/rounds\.current\?\.complete\(id\)/);assert.match(source,/rounds\.current\.start\(next.roundId/);
 assert.equal((source.match(/!rounds\.current\?\.canPlay\(\)/g)||[]).length,2);
 assert.match(source,/rounds\.current\?\.visibilityChanged\(\)/);assert.match(source,/rounds\.current\?\.dispose\(\)/);
 assert.doesNotMatch(source,/setTimeout\(/);
});
test('repeated visibility events consume only visible watchdog time; unmount cancels auto',()=>{
 const f=fixture();let n=0;f.rounds.start('a',30000,()=>n++);
 f.tick(10000);f.hide();f.tick(35000);f.hide();f.show();f.tick(5000);f.hide();f.tick(60000);f.show();f.tick(14999);assert.equal(n,0);f.tick(1);assert.equal(n,1);
 f.rounds.scheduleAuto(()=>n++);const queued=f.callbacks.at(-1);f.rounds.dispose();queued();f.tick(60000);assert.equal(n,1);assert.equal(f.tasks.size,0);
});
