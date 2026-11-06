import {
  initial,
  shuffle,
  log,
  finish,
  requireThat,
  reduce,
} from "./common.js";
export const SIZE = 11;
export const values = Object.fromEntries(
  Object.entries({
    AEILNORSTU: 1,
    DG: 2,
    BCMP: 3,
    FHVWY: 4,
    K: 5,
    JX: 8,
    QZ: 10,
  }).flatMap(([letters, n]) => [...letters].map((c) => [c, n])),
);
const distribution = {
  A: 9,
  B: 2,
  C: 2,
  D: 4,
  E: 12,
  F: 2,
  G: 3,
  H: 2,
  I: 9,
  J: 1,
  K: 1,
  L: 4,
  M: 2,
  N: 6,
  O: 8,
  P: 2,
  Q: 1,
  R: 6,
  S: 4,
  T: 6,
  U: 4,
  V: 2,
  W: 2,
  X: 1,
  Y: 2,
  Z: 1,
};
export function create(seed = 1) {
  const s = {
    ...initial(seed),
    board: Array(121).fill(null),
    bag: [],
    hands: [[], []],
    turn: 0,
    passes: 0,
    phase: "play",
  };
  s.bag = shuffle(
    Object.entries(distribution).flatMap(([c, n]) => Array(n).fill(c)),
    s,
  );
  refill(s, 0);
  refill(s, 1);
  log(
    s,
    "Build through the center. Words connect horizontally or vertically; every formed word must be in the local dictionary.",
  );
  return s;
}
function refill(s, p) {
  while (s.hands[p].length < 7 && s.bag.length) s.hands[p].push(s.bag.pop());
}
export function validate(s, placements, dictionary) {
  requireThat(
    placements.length > 0 && placements.length <= s.hands[s.turn].length,
    "Place at least one tile from your rack.",
  );
  const board = [...s.board],
    rack = [...s.hands[s.turn]],
    indices = new Set();
  for (const p of placements) {
    requireThat(
      Number.isInteger(p.index) &&
        p.index >= 0 &&
        p.index < 121 &&
        !board[p.index] &&
        !indices.has(p.index),
      "Use distinct empty squares.",
    );
    const i = rack.indexOf(p.letter);
    requireThat(i >= 0, "That letter is not in your rack.");
    rack.splice(i, 1);
    board[p.index] = p.letter;
    indices.add(p.index);
  }
  const rows = new Set(placements.map((p) => Math.floor(p.index / 11))),
    cols = new Set(placements.map((p) => p.index % 11));
  requireThat(
    rows.size === 1 || cols.size === 1,
    "Place tiles in one row or column.",
  );
  const step = rows.size === 1 ? 1 : 11,
    sorted = placements.map((p) => p.index).sort((a, b) => a - b);
  for (let i = sorted[0]; i <= sorted.at(-1); i += step)
    requireThat(board[i], "There cannot be gaps between tiles.");
  const existing = s.board.some(Boolean);
  if (!existing)
    requireThat(
      indices.has(60),
      "The opening word must cover the center star.",
    );
  else
    requireThat(
      placements.some((p) => {
        const i = p.index;
        return [
          i >= 11 ? i - 11 : -1,
          i < 110 ? i + 11 : -1,
          i % 11 > 0 ? i - 1 : -1,
          i % 11 < 10 ? i + 1 : -1,
        ].some((j) => j >= 0 && s.board[j]);
      }),
      "Your word must connect to a tile already on the board.",
    );
  const words = new Map();
  for (const p of placements)
    for (const delta of [1, 11]) {
      let start = p.index;
      while (
        delta === 1
          ? start % 11 > 0 && board[start - 1]
          : start >= 11 && board[start - 11]
      )
        start -= delta;
      let i = start,
        text = "",
        score = 0;
      while (i < 121 && board[i]) {
        text += board[i];
        score += values[board[i]];
        if (delta === 1 && i % 11 === 10) break;
        i += delta;
      }
      if (text.length >= 2) words.set(`${start}/${delta}`, { text, score });
    }
  requireThat(words.size > 0, "Words must contain at least two letters.");
  for (const w of words.values())
    requireThat(
      dictionary.has(w.text),
      `${w.text} is not in the local dictionary.`,
    );
  return {
    board,
    rack,
    words: [...words.values()].map((w) => w.text),
    score:
      [...words.values()].reduce((n, w) => n + w.score, 0) +
      (placements.length === 7 ? 10 : 0),
  };
}
function end(s) {
  const left = s.hands.map((h) => h.reduce((v, c) => v + values[c], 0));
  s.scores = s.scores.map((v, p) => v - left[p]);
  if (s.hands[0].length === 0) s.scores[0] += left[1];
  if (s.hands[1].length === 0) s.scores[1] += left[0];
  finish(
    s,
    s.scores[0] === s.scores[1]
      ? "The word duel is a draw."
      : `${s.scores[0] > s.scores[1] ? "South" : "North"} wins the word duel, ${s.scores.join(" – ")}.`,
  );
}
export function apply(s, a, dictionary) {
  return reduce(s, a, (n, a) => {
    requireThat(!n.over, "Match finished.");
    const p = n.turn;
    if (a.type === "play") {
      const result = validate(n, a.placements, dictionary);
      n.board = result.board;
      n.hands[p] = result.rack;
      n.scores[p] += result.score;
      refill(n, p);
      n.passes = 0;
      log(
        n,
        `${p === 0 ? "South" : "North"} plays ${result.words.join(" + ")} for ${result.score}.`,
      );
    } else if (a.type === "pass") {
      n.passes++;
      log(n, `${p === 0 ? "South" : "North"} passes.`);
    } else if (a.type === "exchange") {
      requireThat(
        n.bag.length >= 7,
        "At least seven tiles must remain in the bag to exchange.",
      );
      requireThat(
        a.indices.length > 0 &&
          new Set(a.indices).size === a.indices.length &&
          a.indices.every(
            (i) => Number.isInteger(i) && i >= 0 && i < n.hands[p].length,
          ),
        "Select rack tiles to exchange.",
      );
      const old = [];
      for (const i of [...a.indices].sort((a, b) => b - a))
        old.push(n.hands[p].splice(i, 1)[0]);
      refill(n, p);
      n.bag = shuffle([...n.bag, ...old], n);
      n.passes++;
      log(n, `${p === 0 ? "South" : "North"} exchanges ${old.length} tiles.`);
    } else throw new Error("Unknown action.");
    if ((!n.bag.length && !n.hands[p].length) || n.passes >= 6) end(n);
    else n.turn = 1 - p;
  });
}
export function makeTrie(dictionary) {
  const root = {};
  for (const word of dictionary) {
    let node = root;
    for (const c of word) node = node[c] ??= {};
    node.$ = true;
  }
  return root;
}
export function bestMove(
  s,
  dictionary,
  trie = makeTrie(dictionary),
  limit = 35000,
) {
  let best = null,
    nodes = 0;
  const counts = {};
  for (const c of s.hands[s.turn]) counts[c] = (counts[c] || 0) + 1;
  const existing = s.board.some(Boolean);
  for (const step of [1, 11])
    for (let start = 0; start < 121; start++) {
      if (nodes > limit) return best || { type: "pass" };
      const prev = step === 1 ? (start % 11 > 0 ? start - 1 : -1) : start - 11;
      if (prev >= 0 && s.board[prev]) continue;
      if (
        !existing &&
        (step === 1
          ? Math.floor(start / 11) !== 5 || start % 11 > 5
          : start % 11 !== 5 || start > 60)
      )
        continue;
      function dfs(index, node, placements, length) {
        if (++nodes > limit) return;
        if (
          node.$ &&
          length >= 2 &&
          placements.length &&
          (index >= 121 || (step === 1 && index % 11 === 0) || !s.board[index])
        ) {
          try {
            const v = validate(s, placements, dictionary);
            if (!best || v.score > best.score)
              best = {
                type: "play",
                placements: placements.map((p) => ({ ...p })),
                score: v.score,
              };
          } catch {}
        }
        if (
          index >= 121 ||
          (step === 1 && length && index % 11 === 0) ||
          length >= 11
        )
          return;
        const fixed = s.board[index];
        if (fixed) {
          if (node[fixed])
            dfs(index + step, node[fixed], placements, length + 1);
          return;
        }
        for (const c of Object.keys(counts)) {
          if (!counts[c] || !node[c]) continue;
          counts[c]--;
          placements.push({ index, letter: c });
          dfs(index + step, node[c], placements, length + 1);
          placements.pop();
          counts[c]++;
        }
      }
      dfs(start, trie, [], 0);
    }
  return best || { type: "pass" };
}
