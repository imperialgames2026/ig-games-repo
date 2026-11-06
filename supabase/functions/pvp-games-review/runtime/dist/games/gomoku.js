import { initial, log, finish, requireThat, reduce } from "./common.js";
export const SIZE = 15;
const dirs = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
];
export function winningLine(board, index) {
  const p = board[index];
  if (p === null || p === undefined) return [];
  const row = Math.floor(index / 15),
    col = index % 15;
  for (const [dr, dc] of dirs) {
    const line = [index];
    for (const sign of [-1, 1]) {
      let r = row + dr * sign,
        c = col + dc * sign;
      while (r >= 0 && r < 15 && c >= 0 && c < 15 && board[r * 15 + c] === p) {
        line.push(r * 15 + c);
        r += dr * sign;
        c += dc * sign;
      }
    }
    if (line.length === 5) return line;
  }
  return [];
}
export function create(seed = 1) {
  const s = {
    ...initial(seed),
    board: Array(225).fill(null),
    turn: 0,
    moves: 0,
    lastMove: null,
    winning: [],
  };
  log(
    s,
    "Black starts. Build exactly five in a row. Six or more does not win.",
  );
  return s;
}
export function apply(s, a) {
  return reduce(s, a, (n, a) => {
    requireThat(!n.over && a.type === "place", "Choose an empty intersection.");
    requireThat(
      Number.isInteger(a.index) &&
        a.index >= 0 &&
        a.index < 225 &&
        n.board[a.index] === null,
      "That intersection is occupied or invalid.",
    );
    n.board[a.index] = n.turn;
    n.lastMove = a.index;
    n.moves++;
    log(
      n,
      `${n.turn === 0 ? "Black" : "White"} plays ${"ABCDEFGHIJKLMNO"[a.index % 15]}${Math.floor(a.index / 15) + 1}.`,
    );
    n.winning = winningLine(n.board, a.index);
    if (n.winning.length) {
      finish(n, `${n.turn === 0 ? "Black" : "White"} wins with exactly five.`);
      return;
    }
    if (n.moves === 225) {
      finish(n, "Draw — the board is full.");
      return;
    }
    n.turn = 1 - n.turn;
  });
}
export function candidates(board) {
  if (board.every((x) => x === null)) return [112];
  const out = new Set();
  for (let i = 0; i < 225; i++)
    if (board[i] !== null) {
      const row = Math.floor(i / 15),
        col = i % 15;
      for (let dr = -2; dr <= 2; dr++)
        for (let dc = -2; dc <= 2; dc++) {
          const r = row + dr,
            c = col + dc;
          if (
            r >= 0 &&
            r < 15 &&
            c >= 0 &&
            c < 15 &&
            board[r * 15 + c] === null
          )
            out.add(r * 15 + c);
        }
    }
  return [...out];
}
function potential(board, index, p) {
  const row = Math.floor(index / 15),
    col = index % 15;
  let total = 0;
  for (const [dr, dc] of dirs)
    for (let offset = 0; offset < 5; offset++) {
      const sr = row - offset * dr,
        sc = col - offset * dc,
        er = sr + 4 * dr,
        ec = sc + 4 * dc;
      if (
        sr < 0 ||
        sr >= 15 ||
        sc < 0 ||
        sc >= 15 ||
        er < 0 ||
        er >= 15 ||
        ec < 0 ||
        ec >= 15
      )
        continue;
      let own = 0,
        blocked = false;
      for (let k = 0; k < 5; k++) {
        const v = board[(sr + k * dr) * 15 + sc + k * dc];
        if (v === 1 - p) {
          blocked = true;
          break;
        }
        if (v === p) own++;
      }
      if (!blocked) total += [1, 6, 35, 250, 3000, 50000][own];
    }
  return total;
}
export function bot(s) {
  const board = [...s.board],
    choices = candidates(board);
  for (const p of [s.turn, 1 - s.turn])
    for (const index of choices) {
      board[index] = p;
      const win = winningLine(board, index).length;
      board[index] = null;
      if (win) return { type: "place", index };
    }
  let best = -Infinity,
    choice = choices[0];
  for (const index of choices) {
    board[index] = s.turn;
    const own = potential(board, index, s.turn);
    board[index] = 1 - s.turn;
    const defense = potential(board, index, 1 - s.turn);
    board[index] = null;
    const center =
        14 - Math.abs(Math.floor(index / 15) - 7) - Math.abs((index % 15) - 7),
      score = own + defense * 0.95 + center;
    if (score > best) {
      best = score;
      choice = index;
    }
  }
  return { type: "place", index: choice };
}
