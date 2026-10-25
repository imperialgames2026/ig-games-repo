import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {randomUUID} from 'node:crypto';
import {createPracticeActionQueue} from '../lib/practiceActionQueue.js';
const memory=()=>{const rows=new Map();return {getItem:k=>rows.get(k)??null,setItem:(k,v)=>rows.set(k,v),removeItem:k=>rows.delete(k)};};
const queue=(storage,key='synthetic-player:craps')=>createPracticeActionQueue({storage,key,makeId:randomUUID});
test('uncertain requests retain the same inputs and receipt across retry and reload',()=>{
 const storage=memory(),first=queue(storage);const pending=first.prepare('bet',{target:'pass',units:10});first.failed(pending.requestId);
 assert.equal(first.prepare('bet',{units:10,target:'pass'}).requestId,pending.requestId);
 assert.throws(()=>first.prepare('bet',{target:'field',units:10}),/pending/);
 const restored=queue(storage);assert.equal(restored.peek().uncertain,true);assert.equal(restored.prepare('bet',pending.params).requestId,pending.requestId);
 restored.confirm(pending.requestId);assert.equal(restored.peek(),null);
 assert.notEqual(restored.prepare('bet',pending.params).requestId,pending.requestId);
});
test('original roll round is preserved and identities/games do not share pending requests',()=>{
 const storage=memory(),a=queue(storage);const pending=a.prepare('roll',{expectedRound:7});a.failed(pending.requestId);
 assert.throws(()=>a.prepare('roll',{expectedRound:8}),/pending/);assert.deepEqual(queue(storage).peek().params,{expectedRound:7});
 assert.equal(queue(storage,'synthetic-player:roulette').peek(),null);assert.equal(queue(storage,'other-player:craps').peek(),null);
});
test('fresh explicit rejection clears the request but cannot discard earlier uncertainty',()=>{
 const q=queue(memory());const first=q.prepare('refill',{});q.failed(first.requestId,{definitiveRejection:true});assert.equal(q.peek(),null);
 const second=q.prepare('refill',{});q.failed(second.requestId);q.failed(second.requestId,{definitiveRejection:true});assert.equal(q.peek().requestId,second.requestId);
});
test('unwritable storage, tampered records and player roulette spin fail closed',()=>{
 const q=queue({getItem:()=>null,setItem:()=>{throw Error('Storage unavailable');},removeItem:()=>{}});assert.throws(()=>q.prepare('bet',{target:'pass',units:10}));assert.equal(q.peek(),null);
 const storage=memory();storage.setItem('synthetic-player:craps',JSON.stringify({action:'spin',params:{expectedRound:7},requestId:randomUUID(),uncertain:false}));assert.throws(()=>queue(storage),/restored safely/);
 assert.throws(()=>queue(memory()).prepare('bet',{target:'pass',units:10,action:'refill'}));assert.throws(()=>queue(memory()).prepare('spin',{expectedRound:7}));
});

// Execute the actual hook callbacks in-process. Effects are deliberately not
// mounted: these tests isolate outgoing requests, not browser or server runtime.
const source=readFileSync(new URL('../hooks/useMultiplayerPractice.js',import.meta.url),'utf8').replace(/^import[^\n]*\n/gm,'').replace('export function useMultiplayerPractice','function useMultiplayerPractice');
function hookHarness({game='craps',invoke,check=async x=>x,storage=memory()}={}){
 let stateIndex=0;const calls=[];
 const hook=vm.runInNewContext(source+'\nuseMultiplayerPractice;',{useCallback:fn=>fn,useEffect:()=>{},useRef:current=>({current}),useState:initial=>[stateIndex++===0?{game,round:7}:initial,()=>{}],useAuth:()=>({user:{id:'11111111-1111-4111-8111-111111111111'},isAuthenticated:true}),createPracticeActionQueue,window:{sessionStorage:storage},crypto:{randomUUID},acceptTableFairness:check,supabase:{functions:{invoke:async(_name,{body})=>{calls.push(JSON.parse(JSON.stringify(body)));return invoke?invoke(body,calls.length):{data:{state:{game,revision:1}}};}}},Date,Error,Promise,console});
 return {hook:hook(game),calls,storage};
}
test('actual hook repeats the receipt after lost response and after remount',async()=>{
 const first=hookHarness({invoke:async(_body,n)=>n===1?{error:{context:{status:503}}}:{data:{state:{game:"craps",revision:1}}}});assert.equal(await first.hook.placeBet('pass',10),false);assert.equal(await first.hook.placeBet('pass',10),true);assert.equal(first.calls[0].requestId,first.calls[1].requestId);
 const lost=hookHarness({invoke:async()=>({error:{}})});await lost.hook.placeBet('pass',10);const resumed=hookHarness({storage:lost.storage});assert.equal(await resumed.hook.retryPending(),true);assert.deepEqual(resumed.calls[0],lost.calls[0]);
});
test('actual hook retains receipt when accepted state verification fails',async()=>{
 let bad=true;const h=hookHarness({invoke:async()=>({data:{state:{game:'craps',revision:1}}}),check:async state=>{if(bad){bad=false;throw Error('Synthetic state verification failure');}return state;}});assert.equal(await h.hook.placeBet('pass',10),false);assert.equal(await h.hook.retryPending(),true);assert.equal(h.calls[0].requestId,h.calls[1].requestId);
});
test('actual hook prevents same-tick duplicate dispatch and never submits roulette spin',async()=>{
 let finish;const h=hookHarness({invoke:()=>new Promise(resolve=>finish=resolve)});const first=h.hook.placeBet('pass',10);assert.equal(await h.hook.placeBet('pass',10),false);assert.equal(h.calls.length,1);finish({data:{state:{game:"craps",revision:1}}});assert.equal(await first,true);
 const roulette=hookHarness({game:'roulette'});assert.equal(await roulette.hook.runRound(),false);assert.equal(roulette.calls.length,0);
});

test('actual hook keeps the original receipt when a success response omits its table state',async()=>{
 let valid=false;const h=hookHarness({invoke:async()=>({data:{state:valid?{game:'craps',revision:1}:null}})});assert.equal(await h.hook.placeBet('pass',10),false);valid=true;assert.equal(await h.hook.retryPending(),true);assert.equal(h.calls[0].requestId,h.calls[1].requestId);
});

const crashSource=readFileSync(new URL('../components/games/CrashPracticeV2.jsx',import.meta.url),'utf8').replace(/^import[^\n]*\n/gm,'').replace('export default function CrashPracticeV2','function CrashPracticeV2').split('  const vertices=')[0]+' return {act};\n}\nCrashPracticeV2;';
function crashHarness({invoke,storage=memory(),initialMode='crash'}={}){
 const calls=[];let stateIndex=0;
 const component=vm.runInNewContext(crashSource,{useCallback:fn=>fn,useEffect:()=>{},useRef:current=>({current}),useState:initial=>[stateIndex++===2?{round:7,phase:'betting',joined:true,myBets:[{id:'22222222-2222-4222-8222-222222222222',round:7,mode:'crash_manual',status:'active'}]}:initial,()=>{}],useAuth:()=>({user:{id:'11111111-1111-4111-8111-111111111111'},isAuthenticated:true}),createPracticeActionQueue,window:{sessionStorage:storage},crypto:{randomUUID},rememberCrashCommitment:()=>{},requireSupabase:()=>({functions:{invoke:async(_name,{body})=>{calls.push(JSON.parse(JSON.stringify(body)));return invoke(body,calls.length);}}}),Date,Error,Promise,console});
 return {hook:component({initialMode}),calls,storage};
}
const crashState={practiceOnly:true,realMoneyEnabled:false,serverTime:'2026-10-25T12:00:00Z'};
test('actual Crash and Trenball callbacks retain original wager and receipt across lost response and reload',async()=>{
 for(const initialMode of ['crash','trenball']){
  let valid=false;const first=crashHarness({initialMode,invoke:async()=>valid?{data:{state:crashState}}:{error:{message:'Synthetic lost response'}}});
  await first.hook.act('bet');const original=first.calls[0];valid=true;
  const resumed=crashHarness({storage:first.storage,initialMode,invoke:async()=>({data:{state:crashState}})});await resumed.hook.act('',true);
  assert.deepEqual(resumed.calls[0],original);assert.equal(original.mode,initialMode==='crash'?'crash_manual':'tren_red');
 }
});
test('actual Crash cashout callback blocks duplicate dispatch and retains receipt without returned state',async()=>{
 let finish;const h=crashHarness({invoke:body=>body.action==='state'?Promise.resolve({data:{state:crashState}}):new Promise(resolve=>finish=resolve)});
 const first=h.hook.act('cashout');await h.hook.act('cashout');assert.equal(h.calls.length,1);finish({data:{action:{}}});await first;
 const resumed=crashHarness({storage:h.storage,invoke:async()=>({data:{state:crashState}})});await resumed.hook.act('',true);assert.deepEqual(resumed.calls[0],h.calls[0]);
});
