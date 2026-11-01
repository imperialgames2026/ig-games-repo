import { initial, random, log, finish, requireThat, reduce } from "./common.js";
const sign = (p) => (p === 0 ? 1 : -1);
const die = (s) => Math.floor(random(s) * 6) + 1;
export function pipCounts(s) {
  return [0, 1].map(
    (p) =>
      s.bar[p] * 25 +
      s.points.reduce(
        (sum, n, i) =>
          sum +
          (n * sign(p) > 0 ? Math.abs(n) * (p === 0 ? i + 1 : 24 - i) : 0),
        0,
      ),
  );
}
export function allHome(s, p) {
  return (
    s.bar[p] === 0 &&
    s.points.every((n, i) => n * sign(p) <= 0 || (p === 0 ? i <= 5 : i >= 18))
  );
}
export function rawMoves(s, p, d) {
  const sg = sign(p),
    moves = [];
  const sources = s.bar[p]
    ? ["bar"]
    : s.points.flatMap((n, i) => (n * sg > 0 ? [i] : []));
  for (const from of sources) {
    const to =
      from === "bar" ? (p === 0 ? 24 - d : d - 1) : from + (p === 0 ? -d : d);
    if (to >= 0 && to < 24) {
      if (s.points[to] * sg >= -1)
        moves.push({ type: "move", from, to, die: d });
    } else if (from !== "bar" && allHome(s, p)) {
      const distance = p === 0 ? from + 1 : 24 - from;
      const higher = s.points.some(
        (n, i) => n * sg > 0 && (p === 0 ? i > from : i < from),
      );
      if (d === distance || (d > distance && !higher))
        moves.push({ type: "move", from, to: "off", die: d });
    }
  }
  return moves;
}
export function moved(s, p, move) {
  const n = { ...s, points: [...s.points], bar: [...s.bar], off: [...s.off] },
    sg = sign(p);
  if (move.from === "bar") n.bar[p]--;
  else n.points[move.from] -= sg;
  if (move.to === "off") n.off[p]++;
  else {
    if (n.points[move.to] * sg === -1) {
      n.points[move.to] = 0;
      n.bar[1 - p]++;
    }
    n.points[move.to] += sg;
  }
  return n;
}
function remainingAfter(dice, d) {
  const out = [...dice];
  out.splice(out.indexOf(d), 1);
  return out;
}
export function legalMoves(s) {
  if (s.over || s.phase !== "move" || !s.remaining.length) return [];
  const memo = new Map(),
    p = s.turn;
  function maxSteps(pos, dice) {
    if (!dice.length || pos.off[p] === 15) return 0;
    const key =
      pos.points.join(",") +
      "/" +
      pos.bar.join(",") +
      "/" +
      pos.off.join(",") +
      "/" +
      [...dice].sort().join("");
    if (memo.has(key)) return memo.get(key);
    let max = 0;
    for (const d of new Set(dice))
      for (const m of rawMoves(pos, p, d)) {
        max = Math.max(
          max,
          1 + maxSteps(moved(pos, p, m), remainingAfter(dice, d)),
        );
        if (max === dice.length) {
          memo.set(key, max);
          return max;
        }
      }
    memo.set(key, max);
    return max;
  }
  const candidates = [];
  let required = 0;
  for (const d of new Set(s.remaining))
    for (const move of rawMoves(s, p, d)) {
      const steps =
        1 + maxSteps(moved(s, p, move), remainingAfter(s.remaining, d));
      required = Math.max(required, steps);
      candidates.push({ move, steps });
    }
  let result = candidates
    .filter((c) => c.steps === required)
    .map((c) => c.move);
  if (
    required === 1 &&
    s.remaining.length === 2 &&
    s.remaining[0] !== s.remaining[1]
  ) {
    const higher = Math.max(...result.map((m) => m.die));
    result = result.filter((m) => m.die === higher);
  }
  return result;
}
function opening(s) {
  s.round++;
  s.points = Array(24).fill(0);
  for (const [i, n] of [
    [23, 2],
    [12, 5],
    [7, 3],
    [5, 5],
    [0, -2],
    [11, -5],
    [16, -3],
    [18, -5],
  ])
    s.points[i] = n;
  s.bar = [0, 0];
  s.off = [0, 0];
  let a, b;
  do {
    a = die(s);
    b = die(s);
  } while (a === b);
  s.dice = [a, b];
  s.remaining = [a, b];
  s.turn = a > b ? 0 : 1;
  s.phase = "move";
  s.lastMove = null;
  s.moveNumber = 0;
  log(
    s,
    `Game ${s.round}. Opening roll: Ivory ${a}, Onyx ${b}. ${s.turn === 0 ? "Ivory" : "Onyx"} plays both dice.`,
  );
}
export function create(seed = 1) {
  const s = { ...initial(seed), target: 5 };
  opening(s);
  return s;
}
function endTurn(s, blocked = false) {
  s.remaining = [];
  s.turn = 1 - s.turn;
  s.phase = "roll";
  if (blocked) log(s, "No further dice can be played. Turn passes.");
}
function scoreGame(s, p) {
  const opp = 1 - p;
  let points = 1;
  if (s.off[opp] === 0) {
    points = 2;
    const enemyInHome = s.points.some(
      (n, i) => n * sign(opp) > 0 && (p === 0 ? i <= 5 : i >= 18),
    );
    if (s.bar[opp] || enemyInHome) points = 3;
  }
  s.scores[p] += points;
  s.phase = "round";
  s.remaining = [];
  log(
    s,
    `${p === 0 ? "Ivory" : "Onyx"} wins a ${points === 1 ? "single" : points === 2 ? "gammon" : "backgammon"} for ${points} match point${points === 1 ? "" : "s"}.`,
  );
  if (s.scores[p] >= s.target)
    finish(
      s,
      `${p === 0 ? "Ivory" : "Onyx"} wins the cubeless match ${s.scores.join(" – ")}.`,
    );
}
export function apply(s, a) {
  return reduce(s, a, (n, a) => {
    requireThat(!n.over, "Match finished.");
    if (a.type === "next") {
      requireThat(n.phase === "round", "Finish this game first.");
      opening(n);
      return;
    }
    if (a.type === "roll") {
      requireThat(
        n.phase === "roll",
        "Play the current dice before rolling again.",
      );
      n.dice = [die(n), die(n)];
      n.remaining =
        n.dice[0] === n.dice[1] ? Array(4).fill(n.dice[0]) : [...n.dice];
      n.phase = "move";
      log(
        n,
        `${n.turn === 0 ? "Ivory" : "Onyx"} rolls ${n.dice.join(" and ")}.`,
      );
      if (!legalMoves(n).length) endTurn(n, true);
      return;
    }
    if (a.type === "pass") {
      requireThat(
        n.phase === "move" && !legalMoves(n).length,
        "You must use every die that can legally be played.",
      );
      endTurn(n, true);
      return;
    }
    requireThat(a.type === "move", "Choose a legal checker move.");
    const move = legalMoves(n).find(
      (m) => m.from === a.from && m.to === a.to && m.die === a.die,
    );
    requireThat(
      move,
      "That move would not use the maximum dice, or violates entry/bearing-off rules.",
    );
    const p = n.turn;
    const after = moved(n, p, move);
    n.points = after.points;
    n.bar = after.bar;
    n.off = after.off;
    n.remaining = remainingAfter(n.remaining, move.die);
    n.lastMove = move;
    n.moveNumber++;
    log(
      n,
      `${p === 0 ? "Ivory" : "Onyx"} ${move.from === "bar" ? "bar" : move.from + 1} → ${move.to === "off" ? "off" : move.to + 1} (${move.die}).`,
    );
    if (n.off[p] === 15) {
      scoreGame(n, p);
      return;
    }
    if (!n.remaining.length) endTurn(n);
    else if (!legalMoves(n).length) endTurn(n, true);
  });
}
export function bot(s) {
  if (s.phase === "roll") return { type: "roll" };
  const legal = legalMoves(s);
  if (!legal.length) return { type: "pass" };
  let best = -Infinity,
    choice = legal[0];
  const p = s.turn,
    sg = sign(p);
  for (const move of legal) {
    const n = moved(s, p, move);
    let blocks = 0,
      blots = 0;
    for (let i = 0; i < 24; i++)
      if (n.points[i] * sg > 0) {
        if (Math.abs(n.points[i]) >= 2)
          blocks += (p === 0 && i < 6) || (p === 1 && i >= 18) ? 3 : 1;
        else blots++;
      }
    const score =
      n.off[p] * 120 +
      n.bar[1 - p] * 30 -
      n.bar[p] * 30 -
      pipCounts(n)[p] +
      blocks * 8 -
      blots * 5;
    if (score > best) {
      best = score;
      choice = move;
    }
  }
  return choice;
}
