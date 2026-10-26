import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {evaluatePokerReceiptResolution as evaluate} from '../review/pokerReceiptResolutionContract.mjs';
const actor='11111111-1111-4111-8111-111111111111';
function fixture(outcome='committed'){
 const pending={action:'pokerAct',requestId:'22222222-2222-4222-8222-222222222222',params:{tableId:'33333333-3333-4333-8333-333333333333',version:7,move:'raise',amount:40},uncertain:true};
 return {pending,authenticatedActor:actor,minimumObservedVersion:9,snapshot:{table:{id:pending.params.tableId,version:9},seats:[]},response:{protocol:'ig.poker.receipt-resolution.v1',actorId:actor,tableId:pending.params.tableId,actionId:pending.requestId,request:{version:7,move:'raise',amount:40,systemTimeout:false},outcome,resolutionId:pending.requestId,finality:{durable:true,serialized:true,originalExecutionSealed:true},snapshotVersion:9,receipt:outcome==='committed'?{accepted:true,tableId:pending.params.tableId,version:8,action:'raise',timeout:false,chipsCommitted:20}:null}};
}
const denied=input=>{const result=evaluate(input);assert.equal(result.canResume,false);assert.equal(result.state,'unresolved');};
const paused=input=>{const result=evaluate(input);assert.equal(result.canResume,false);assert.equal(result.state,'committed');};
test('review contract accepts only correlated committed receipt without guessing requested amount from paid chips',()=>{
 const input=fixture();const before=structuredClone(input);assert.deepEqual(evaluate(input),{state:'committed',canResume:true,resolutionId:input.response.resolutionId,actionId:input.pending.requestId});assert.deepEqual(input,before);
});
test('committed outcome requires durable serialized sealed execution; negative outcomes never unlock',()=>{
 for(const key of ['durable','serialized','originalExecutionSealed']){const changed=fixture();changed.response.finality[key]=false;denied(changed);}
 denied(fixture('rejected'));
});
test('legacy missing pending conflict and snapshot-only evidence always remain unresolved',()=>{
 for(const outcome of ['legacy_unknown','not_found','pending','conflict']){const input=fixture();input.response.outcome=outcome;denied(input);}
 const missing=fixture();missing.response=null;denied(missing);const noAmount=fixture();noAmount.response.request=null;denied(noAmount);
});
test('crossactor crosstable other receipt and changed request inputs cannot resume play',()=>{
 for(const [key,value] of [['actorId','55555555-5555-4555-8555-555555555555'],['tableId','66666666-6666-4666-8666-666666666666'],['actionId','77777777-7777-4777-8777-777777777777']]){const input=fixture();input.response[key]=value;denied(input);}
 for(const [key,value] of [['version',8],['move','call'],['amount',20],['systemTimeout',true]]){const input=fixture();input.response.request[key]=value;denied(input);}
 const noAuth=fixture();noAuth.authenticatedActor=null;denied(noAuth);
});
test('stale malformed uncorrelated snapshots cannot resolve a request',()=>{
 for(const value of [null,{},[],{table:{id:'wrong',version:9},seats:[]},{table:{id:fixture().pending.params.tableId,version:8},seats:[]},{table:{id:fixture().pending.params.tableId,version:9},seats:null}]){const input=fixture();input.snapshot=value;paused(input);}
 const stale=fixture();stale.minimumObservedVersion=10;paused(stale);
 const advanced=fixture();advanced.snapshot.table.version=10;advanced.minimumObservedVersion=10;assert.equal(evaluate(advanced).canResume,true);
});
test('malformed committed receipts protocol and extra unreviewed fields fail closed',()=>{
 for(const [key,value] of [['accepted',false],['version',7],['action','fold'],['timeout',true],['chipsCommitted',-1]]){const input=fixture();input.response.receipt[key]=value;denied(input);}
 const wrongReference=fixture();wrongReference.response.resolutionId='44444444-4444-4444-8444-444444444444';denied(wrongReference);
 const extra=fixture();extra.response.actorFromUserMetadata=true;denied(extra);const protocol=fixture();protocol.response.protocol='v2';denied(protocol);
 for(const value of [NaN,Infinity,-1,1.5,Number.MAX_SAFE_INTEGER+1]){const input=fixture();input.pending.params.version=value;denied(input);}
});
test('disconnect/remount preserves original inputs and the draft does not clear or wire production receipts',()=>{
 const input=JSON.parse(JSON.stringify(fixture()));const original=structuredClone(input.pending);assert.equal(evaluate(input).canResume,true);assert.deepEqual(input.pending,original);
 const component=readFileSync(new URL('../components/games/HoldemPracticeTable.jsx',import.meta.url),'utf8');assert.equal(component.includes('pokerReceiptResolutionContract'),false);
 const source=readFileSync(new URL('../review/pokerReceiptResolutionContract.mjs',import.meta.url),'utf8');assert.doesNotMatch(source,/fetch\(|functions\.invoke|\.confirm\(|removeItem|makeId|randomUUID/);
});

test('existing legacy ownership and payload reconciliation flags cannot be cleared by newly echoed input',()=>{
 for(const recovery of ['legacy_receipt','actor_mismatch','payload_mismatch']){const input=fixture();input.pending.recovery=recovery;denied(input);assert.equal(evaluate(input).reason,'manual_reconciliation_contract_required');}
});

test('historical owner can retain committed receipt proof without obtaining other players current snapshot',()=>{
 const input=fixture();input.snapshot=null;const result=evaluate(input);assert.equal(result.state,'committed');assert.equal(result.canResume,false);assert.equal(result.reason,'snapshot_not_correlated_or_stale');assert.equal(Object.hasOwn(result,'seats'),false);assert.equal(Object.hasOwn(result,'receipt'),false);
 input.authenticatedActor='55555555-5555-4555-8555-555555555555';denied(input);
});
