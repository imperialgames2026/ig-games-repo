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
    loaderUrl: "/unity/practice/v1/Build/WebGL.loader.js",
    dataUrl: "/unity/practice/v1/Build/WebGL.data",
    codeUrl: "/unity/practice/v1/Build/WebGL.wasm",
    frameworkUrl: "/unity/practice/v1/Build/WebGL.framework.js",
  };
  assert.equal(
    validateUnityManifest(manifest, "https://imperialgaming.llc")
      .productVersion,
    "1",
  );
  for (const loaderUrl of [
    "https://evil.example/loader.js",
    "/unity/practice/v1/../../bad.js",
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
