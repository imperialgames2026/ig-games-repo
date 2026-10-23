import test from "node:test";
import assert from "node:assert/strict";
import {
  createOutcome,
  validateOutcome,
  presentToUnity,
  passLine,
  pockets,
  draw,
} from "../components/practice/outcomes.mjs";
test("practice outcomes are immutable and validated before Unity dispatch", () => {
  const o = createOutcome("craps", () => 5);
  assert.deepEqual(o.values, [6, 6]);
  assert.ok(Object.isFrozen(o.values));
  let sent;
  presentToUnity({ SendMessage: (...args) => (sent = args) }, o);
  assert.equal(sent[0], "PracticeBridge");
  assert.deepEqual(JSON.parse(sent[2]), o);
  assert.throws(() => presentToUnity({}, { ...o, mode: "cash" }));
  assert.equal(validateOutcome({ ...o, values: [7, 1] }), false);
});
test("roulette pockets contain each single-zero number once", () => {
  assert.equal(new Set(pockets).size, 37);
  assert.deepEqual(
    [...pockets].sort((a, b) => a - b),
    Array.from({ length: 37 }, (_, i) => i),
  );
});
test("pass line establishes, carries and resolves the point", () => {
  assert.deepEqual(passLine(0, 6), { point: 6, result: "point" });
  assert.equal(passLine(6, 8).result, "roll");
  assert.equal(passLine(6, 6).result, "win");
  assert.equal(passLine(6, 7).result, "lose");
  for (const n of [7, 11]) assert.equal(passLine(0, n).result, "win");
  for (const n of [2, 3, 12]) assert.equal(passLine(0, n).result, "lose");
});
test("rejection sampling rejects biased tail", () => {
  let i = 0;
  assert.equal(
    draw(37, (a) => (a[0] = i++ ? 36 : 4294967295)),
    36,
  );
  assert.equal(i, 2);
});
import { settlePractice } from "../components/practice/practice-rules.mjs";
import { validateUnityManifest } from "../components/practice/unity-loader.mjs";
const result = (game, values) => ({ ...createOutcome(game), values });
test("roulette zero and payout semantics", () => {
  for (const selected of ["red", "black", "even", "odd"])
    assert.equal(
      settlePractice({ outcome: result("roulette", [0]), selected, stake: 10 })
        .credit,
      0,
    );
  assert.equal(
    settlePractice({ outcome: result("roulette", [0]), selected: 0, stake: 10 })
      .credit,
    360,
  );
  assert.equal(
    settlePractice({
      outcome: result("roulette", [1]),
      selected: "red",
      stake: 25,
    }).credit,
    50,
  );
  assert.equal(
    settlePractice({
      outcome: result("roulette", [2]),
      selected: "black",
      stake: 50,
    }).credit,
    100,
  );
});
test("pass line preserves the reserved stake until a terminal outcome", () => {
  let chips = 1000,
    point = 0;
  const stake = 25;
  for (const values of [
    [3, 3],
    [2, 2],
    [1, 5],
  ]) {
    if (!point) chips -= stake;
    const s = settlePractice({
      outcome: result("craps", values),
      stake,
      point,
    });
    chips += s.credit;
    point = s.point;
  }
  assert.equal(chips, 1025);
  assert.equal(point, 0);
});
test("pass line seven-out loses only the reserved stake", () => {
  const s = settlePractice({
    outcome: result("craps", [3, 4]),
    stake: 50,
    point: 6,
  });
  assert.equal(s.credit, 0);
  assert.equal(s.point, 0);
  assert.equal(s.result, "lose");
});
test("Unity manifest rejects executable assets outside the versioned same-origin directory", () => {
  const manifest = {
    version: 1,
    mode: "practice",
    loaderUrl: "/unity/practice/v2/Build/WebGL.loader.js",
    dataUrl: "/unity/practice/v2/Build/WebGL.data",
    codeUrl: "/unity/practice/v2/Build/WebGL.wasm",
    frameworkUrl: "/unity/practice/v2/Build/WebGL.framework.js",
  };
  assert.equal(
    validateUnityManifest(manifest, "https://imperialgaming.llc")
      .productVersion,
    "1",
  );
  for (const loaderUrl of [
    "https://evil.example/loader.js",
    "/unity/practice/v2/../../bad.js",
    "javascript:alert(1)",
    "/other.js",
  ])
    assert.throws(() =>
      validateUnityManifest(
        { ...manifest, loaderUrl },
        "https://imperialgaming.llc",
      ),
    );
});
import {tableReducer,initialTableState} from '../components/practice/practice-rules.mjs';
import {betFromPixel,betPixel,validBet} from '../components/practice/bet-layout.mjs';
test('unlimited repeated placements aggregate; undo refunds only last placement',()=>{
 let s=initialTableState;for(let i=0;i<300;i++)s=tableReducer(s,{type:'place',selection:'red',amount:1});
 assert.equal(s.bets.red,300);assert.equal(s.chips,700);assert.equal(s.undo.length,300);
 s=tableReducer(s,{type:'place',selection:'0',amount:125});assert.equal(s.chips,575);
 s=tableReducer(s,{type:'undo'});assert.equal(s.bets['0'],undefined);assert.equal(s.chips,700);
 s=tableReducer(s,{type:'settle',outcome:result('roulette',[2])});assert.equal(s.bets.red,300);assert.equal(s.chips,400);
 s=tableReducer(s,{type:'clear'});assert.equal(s.chips,700);assert.deepEqual(s.bets,{});
});
test('multiple winning bets settle independently and reserve next round',()=>{
 let s=tableReducer(initialTableState,{type:'place',selection:'red',amount:100});s=tableReducer(s,{type:'place',selection:'1',amount:25});
 s=tableReducer(s,{type:'settle',outcome:result('roulette',[1])});assert.equal(s.chips,1850);assert.deepEqual(s.bets,{red:100,1:25});
});
test('unaffordable repeat keeps placements without spending balance below zero',()=>{
 let s=tableReducer(initialTableState,{type:'place',selection:'red',amount:600});s=tableReducer(s,{type:'settle',outcome:result('roulette',[2])});assert.equal(s.chips,400);assert.equal(s.funded,false);assert.equal(s.bets.red,600);
 s=tableReducer(s,{type:'clear'});assert.equal(s.chips,400);
});
test('craps pass contract stays reserved across point rolls and repeats after resolution',()=>{
 let s=tableReducer({...initialTableState,game:'craps'},{type:'place',selection:'pass',amount:100});s=tableReducer(s,{type:'settle',outcome:result('craps',[3,3])});assert.equal(s.point,6);assert.equal(s.chips,900);assert.equal(tableReducer(s,{type:'clear'}),s);
 s=tableReducer(s,{type:'settle',outcome:result('craps',[4,4])});assert.equal(s.chips,900);s=tableReducer(s,{type:'settle',outcome:result('craps',[2,4])});assert.equal(s.point,0);assert.equal(s.chips,1000);assert.equal(s.bets.pass,100);
});
test('felt hit positions match every offered selection including green zero',()=>{
 for(const game of ['roulette','craps'])for(const selection of game==='craps'?['pass']:[...Array.from({length:37},(_,n)=>String(n)),'red','black','even','odd']){const p=betPixel(game,selection);assert.equal(betFromPixel(game,p.x,p.y),selection);}
 assert.equal(validBet({version:1,game:'roulette',locked:false,placements:[{selection:'red',amount:123}]}),true);
});
