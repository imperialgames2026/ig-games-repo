import test from 'node:test';
import assert from 'node:assert/strict';
import {createOutcome,validateOutcome,presentToUnity,passLine,pockets,draw} from '../components/practice/outcomes.mjs';
test('practice outcomes are immutable and validated before Unity dispatch',()=>{
 const o=createOutcome('craps',()=>5);assert.deepEqual(o.values,[6,6]);assert.ok(Object.isFrozen(o.values));
 let sent;presentToUnity({SendMessage:(...args)=>sent=args},o);assert.equal(sent[0],'PracticeBridge');assert.deepEqual(JSON.parse(sent[2]),o);
 assert.throws(()=>presentToUnity({}, {...o,mode:'cash'}));assert.equal(validateOutcome({...o,values:[7,1]}),false);
});
test('roulette pockets contain each single-zero number once',()=>{assert.equal(new Set(pockets).size,37);assert.deepEqual([...pockets].sort((a,b)=>a-b),Array.from({length:37},(_,i)=>i));});
test('pass line establishes, carries and resolves the point',()=>{
 assert.deepEqual(passLine(0,6),{point:6,result:'point'});assert.equal(passLine(6,8).result,'roll');assert.equal(passLine(6,6).result,'win');assert.equal(passLine(6,7).result,'lose');
 for(const n of [7,11])assert.equal(passLine(0,n).result,'win');for(const n of [2,3,12])assert.equal(passLine(0,n).result,'lose');
});
test('rejection sampling rejects biased tail',()=>{let i=0;assert.equal(draw(37,a=>a[0]=i++?36:4294967295),36);assert.equal(i,2);});
