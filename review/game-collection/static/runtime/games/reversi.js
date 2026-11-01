import { initial, log, finish, requireThat, reduce } from "./common.js";
const dirs = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];
export function flips(board, index, player) {
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index >= 64 ||
    board[index] !== null
  )
    return [];
  const out = [],
    row = Math.floor(index / 8),
    col = index % 8;
  for (const [dr, dc] of dirs) {
    let r = row + dr,
      c = col + dc;
    const line = [];
    while (
      r >= 0 &&
      r < 8 &&
      c >= 0 &&
      c < 8 &&
      board[r * 8 + c] === 1 - player
    ) {
      line.push(r * 8 + c);
      r += dr;
      c += dc;
    }
    if (
      line.length &&
      r >= 0 &&
      r < 8 &&
      c >= 0 &&
      c < 8 &&
      board[r * 8 + c] === player
    )
      out.push(...line);
  }
  return out;
}
export function legalMoves(s, player = s.turn) {
  return s.over
    ? []
    : s.board.flatMap((x, index) =>
        x === null && flips(s.board, index, player).length
          ? [{ type: "place", index }]
          : [],
      );
}
export function counts(board) {
  return [
    board.filter((p) => p === 0).length,
    board.filter((p) => p === 1).length,
  ];
}
export function create(seed = 1) {
  const s = {
    ...initial(seed),
    board: Array(64).fill(null),
    turn: 0,
    lastMove: null,
    passes: 0,
  };
  s.board[27] = 1;
  s.board[36] = 1;
  s.board[28] = 0;
  s.board[35] = 0;
  s.scores = counts(s.board);
  log(s, "Black moves first. Bracket opposing discs to flip them.");
  return s;
}
function end(s) {
  s.scores = counts(s.board);
  finish(
    s,
    s.scores[0] === s.scores[1]
      ? `Draw — ${s.scores[0]} discs each.`
      : `${s.scores[0] > s.scores[1] ? "Black" : "White"} wins ${Math.max(...s.scores)}–${Math.min(...s.scores)}.`,
  );
}
export function apply(s, a) {
  return reduce(s, a, (n, a) => {
    requireThat(!n.over, "Match finished.");
    if (a.type === "pass") {
      requireThat(
        !legalMoves(n).length,
        "You must play when a legal move exists.",
      );
      log(
        n,
        `${n.turn === 0 ? "Black" : "White"} has no legal move and passes.`,
      );
      n.turn = 1 - n.turn;
      n.passes++;
      if (!legalMoves(n).length) end(n);
      return;
    }
    requireThat(a.type === "place", "Choose a legal square.");
    const captures = flips(n.board, a.index, n.turn);
    requireThat(
      captures.length,
      "A legal move must bracket and flip at least one opposing disc.",
    );
    n.board[a.index] = n.turn;
    for (const i of captures) n.board[i] = n.turn;
    n.lastMove = a.index;
    n.passes = 0;
    log(
      n,
      `${n.turn === 0 ? "Black" : "White"} plays ${"ABCDEFGH"[a.index % 8]}${Math.floor(a.index / 8) + 1}, flipping ${captures.length}.`,
    );
    n.turn = 1 - n.turn;
    n.scores = counts(n.board);
    if (!legalMoves(n).length && !legalMoves(n, 1 - n.turn).length) end(n);
  });
}
export function bot(s) {
  const legal = legalMoves(s);
  if (!legal.length) return { type: "pass" };
  const p = s.turn,
    corners = [0, 7, 56, 63],
    danger = {
      1: 0,
      8: 0,
      9: 0,
      6: 7,
      14: 7,
      15: 7,
      48: 56,
      49: 56,
      57: 56,
      54: 63,
      55: 63,
      62: 63,
    };
  let best = -Infinity,
    choice = legal[0];
  for (const move of legal) {
    const board = [...s.board],
      changed = flips(board, move.index, p);
    board[move.index] = p;
    for (const i of changed) board[i] = p;
    const mobility = legalMoves({ ...s, board }, 1 - p).length,
      filled = board.filter((x) => x !== null).length;
    const score =
      (corners.includes(move.index) ? 10000 : 0) -
      (danger[move.index] !== undefined && board[danger[move.index]] !== p
        ? 400
        : 0) -
      mobility * 15 +
      changed.length * (filled > 45 ? 8 : 1);
    if (score > best) {
      best = score;
      choice = move;
    }
  }
  return choice;
}
