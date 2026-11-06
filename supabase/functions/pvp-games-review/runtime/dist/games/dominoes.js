import {
  initial,
  shuffle,
  log,
  finish,
  requireThat,
  reduce,
} from "./common.js";
const value = (t) => t[0] + t[1];
export function create(seed = 1) {
  const s = { ...initial(seed), target: 100 };
  newRound(s);
  return s;
}
function newRound(s) {
  s.round++;
  const all = [];
  for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) all.push([a, b]);
  s.stock = shuffle(all, s);
  s.hands = [s.stock.splice(0, 7), s.stock.splice(0, 7)];
  s.chain = [];
  s.passes = 0;
  s.phase = "play";
  let best = -1,
    owner = 0;
  for (let p = 0; p < 2; p++)
    for (const t of s.hands[p])
      if (t[0] === t[1] && t[0] > best) {
        best = t[0];
        owner = p;
      }
  if (best < 0) {
    let high = -1;
    for (let p = 0; p < 2; p++)
      for (const t of s.hands[p])
        if (value(t) > high) {
          high = value(t);
          owner = p;
        }
  }
  s.turn = owner;
  s.opening =
    best >= 0
      ? [best, best]
      : s.hands[owner].reduce((a, b) => (value(a) > value(b) ? a : b));
  log(
    s,
    `Round ${s.round}. ${owner === 0 ? "South" : "North"} opens with ${s.opening.join("|")}.`,
  );
}
export function legalMoves(s, p = s.turn) {
  if (s.phase !== "play" || s.over) return [];
  return s.hands[p].flatMap((t, index) => {
    if (!s.chain.length)
      return t[0] === s.opening[0] && t[1] === s.opening[1]
        ? [{ type: "play", index, side: "right" }]
        : [];
    const left = s.chain[0][0],
      right = s.chain.at(-1)[1];
    return [
      ...(t.includes(left) ? [{ type: "play", index, side: "left" }] : []),
      ...(t.includes(right) ? [{ type: "play", index, side: "right" }] : []),
    ];
  });
}
function endRound(s, winner, blocked = false) {
  const sums = s.hands.map((h) => h.reduce((sum, t) => sum + value(t), 0));
  if (winner !== null)
    s.scores[winner] += blocked
      ? Math.abs(sums[0] - sums[1])
      : sums[1 - winner];
  s.phase = "round";
  log(
    s,
    winner === null
      ? "Blocked round is tied. No score."
      : `${winner === 0 ? "South" : "North"} wins the round. Scores: ${s.scores.join(" – ")}.`,
  );
  if (Math.max(...s.scores) >= s.target)
    finish(
      s,
      `${s.scores[0] > s.scores[1] ? "South wins" : "North wins"} the match.`,
    );
}
export function apply(s, a) {
  return reduce(s, a, (n, a) => {
    requireThat(!n.over, "Match finished.");
    if (a.type === "next") {
      requireThat(n.phase === "round", "Finish the round first.");
      newRound(n);
      return;
    }
    requireThat(n.phase === "play", "Round finished.");
    const p = n.turn;
    if (a.type === "play") {
      requireThat(
        legalMoves(n).some((m) => m.index === a.index && m.side === a.side),
        "This tile does not fit that end.",
      );
      let t = n.hands[p].splice(a.index, 1)[0];
      if (n.chain.length) {
        if (a.side === "left") {
          if (t[1] !== n.chain[0][0]) t = [t[1], t[0]];
          n.chain.unshift(t);
        } else {
          if (t[0] !== n.chain.at(-1)[1]) t = [t[1], t[0]];
          n.chain.push(t);
        }
      } else n.chain.push(t);
      n.passes = 0;
      log(
        n,
        `${p === 0 ? "South" : "North"} plays ${t.join("|")} on the ${a.side}.`,
      );
      if (!n.hands[p].length) {
        endRound(n, p);
        return;
      }
      n.turn = 1 - p;
    } else if (a.type === "draw") {
      requireThat(
        !legalMoves(n).length,
        "Play a matching tile before drawing.",
      );
      requireThat(n.stock.length, "The boneyard is empty. Pass instead.");
      n.hands[p].push(n.stock.pop());
      log(n, `${p === 0 ? "South" : "North"} draws a tile.`);
    } else if (a.type === "pass") {
      requireThat(
        !n.stock.length && !legalMoves(n).length,
        "Pass only when the boneyard is empty and no tile fits.",
      );
      n.passes++;
      n.turn = 1 - p;
      log(n, `${p === 0 ? "South" : "North"} passes.`);
      if (n.passes >= 2) {
        const sums = n.hands.map((h) =>
          h.reduce((sum, t) => sum + value(t), 0),
        );
        endRound(
          n,
          sums[0] === sums[1] ? null : sums[0] < sums[1] ? 0 : 1,
          true,
        );
      }
    } else throw new Error("Unknown action.");
  });
}
export function bot(s) {
  const moves = legalMoves(s);
  return (
    moves.sort(
      (a, b) =>
        value(s.hands[s.turn][b.index]) - value(s.hands[s.turn][a.index]),
    )[0] || { type: s.stock.length ? "draw" : "pass" }
  );
}
