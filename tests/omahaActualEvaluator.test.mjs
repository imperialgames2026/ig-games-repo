import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Compile the deployed Edge Function's actual evaluator into an isolated VM.
// This tests server production source, not a separate copy that may drift.
const source=readFileSync(new URL('../supabase/functions/poker-table-v1/index.ts',import.meta.url),'utf8');
const a=source.indexOf('type C='), b=source.indexOf('function awards(');
if(a<0||b<a)throw Error('Poker evaluator missing from deployed-source record');
const helpers=source.slice(a,b);
const js=ts.transpileModule(helpers,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
const isolated={};
vm.runInNewContext(js+'\nthis.evaluateOmaha=bestOmaha;this.evaluateHoldem=best;this.compare=compare;',isolated,
  {timeout:1000});

const c=(rank,suit)=>({rank,suit});
const order=(s)=>s.split(' ').map(text=>c(
  text.length>2?Number(text.slice(0,-1)):
  ({A:14,K:13,Q:12,J:11,T:10})[text[0]]||Number(text[0]),
  text.slice(-1)));

test('board-only royal flush must NOT win Omaha showdown',()=>{
  const hole=order('2c 3d 4s 5c');
  const royalBoard=order('Ah Kh Qh Jh Th');
  assert.equal(isolated.evaluateOmaha(hole,royalBoard)[0],0);
  assert.equal(isolated.evaluateHoldem([...hole.slice(0,2),...royalBoard])[0],8);
});

test('Omaha royal flush requires two suited hole cards plus three board cards',()=>{
  const score=isolated.evaluateOmaha(order('Ah Kh 2c 3d'),order('Qh Jh Th 9c 8d'));
  assert.equal(score[0],8);
  assert.equal(score[1],14);
});

test('Omaha exactly-two-hole rule supports valid queen-high straight flush',()=>{
  const score=isolated.evaluateOmaha(order('As Ks Qs Js'),order('Ts 9s 8s 2d 3c'));
  assert.equal(score[0],8);
  assert.equal(score[1],12);
});

test('Omaha full house cannot be made from five community cards only',()=>{
  const score=isolated.evaluateOmaha(order('2c 3d 4s 5c'),order('Ah Ad As Kc Kd'));
  assert.equal(score[0],3);
});

test('Omaha evaluator rejects incorrect hole and board counts',()=>{
  assert.throws(()=>isolated.evaluateOmaha(order('Ah Kh'),order('Qh Jh Th 9c 8d')));
  assert.throws(()=>isolated.evaluateOmaha(order('Ah Kh 2c 3d'),order('Qh Jh Th')));
});
