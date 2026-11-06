import { initial, log, finish, requireThat, reduce } from "./common.js";
export const ROWS = 6,
  COLS = 7;
const order = [3, 2, 4, 1, 5, 0, 6];
export function landing(board, column) {
  if (!Number.isInteger(column) || column < 0 || column >= 7) return -1;
  for (let row = 5; row >= 0; row--)
    if (board[row * 7 + column] === null) return row * 7 + column;
  return -1;
}
export function winningLine(board, index) {
  const p = board[index];
  if (p === null || p === undefined) return [];
  const row = Math.floor(index / 7),
    col = index % 7;
  for (const [dr, dc] of [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ]) {
    const cells = [index];
    for (const sign of [-1, 1]) {
      let r = row + dr * sign,
        c = col + dc * sign;
      while (r >= 0 && r < 6 && c >= 0 && c < 7 && board[r * 7 + c] === p) {
        cells.push(r * 7 + c);
        r += dr * sign;
        c += dc * sign;
      }
    }
    if (cells.length >= 4) return cells;
  }
  return [];
}
export function create(seed = 1) {
  const s = {
    ...initial(seed),
    board: Array(42).fill(null),
    turn: 0,
    lastMove: null,
    winning: [],
    moves: 0,
  };
  log(
    s,
    "Red drops first. Connect four horizontally, vertically, or diagonally.",
  );
  return s;
}
export function legalMoves(s) {
  return s.over
    ? []
    : order
        .filter((column) => landing(s.board, column) >= 0)
        .map((column) => ({ type: "drop", column }));
}
export function apply(s, a) {
  return reduce(s, a, (n, a) => {
    requireThat(!n.over && a.type === "drop", "Choose an open column.");
    const index = landing(n.board, a.column);
    requireThat(index >= 0, "That column is full or invalid.");
    n.board[index] = n.turn;
    n.lastMove = index;
    n.moves++;
    log(n, `${n.turn === 0 ? "Red" : "Gold"} drops in column ${a.column + 1}.`);
    n.winning = winningLine(n.board, index);
    if (n.winning.length) {
      finish(n, `${n.turn === 0 ? "Red" : "Gold"} wins with four in a row.`);
      return;
    }
    if (n.moves === 42) {
      finish(n, "Draw — the board is full.");
      return;
    }
    n.turn = 1 - n.turn;
  });
}
function evaluate(board, p) {
  let score = 0;
  for (let r = 0; r < 6; r++)
    if (board[r * 7 + 3] !== null) score += board[r * 7 + 3] === p ? 5 : -5;
  for (let r = 0; r < 6; r++)
    for (let c = 0; c < 7; c++)
      for (const [dr, dc] of [
        [0, 1],
        [1, 0],
        [1, 1],
        [1, -1],
      ]) {
        if (
          r + 3 * dr < 0 ||
          r + 3 * dr >= 6 ||
          c + 3 * dc < 0 ||
          c + 3 * dc >= 7
        )
          continue;
        let own = 0,
          enemy = 0;
        for (let k = 0; k < 4; k++) {
          const x = board[(r + k * dr) * 7 + c + k * dc];
          if (x === p) own++;
          else if (x === 1 - p) enemy++;
        }
        if (!enemy) score += [0, 1, 8, 60, 10000][own];
        if (!own) score -= [0, 1, 9, 70, 10000][enemy];
      }
  return score;
}
export function bot(s) {
  const board = [...s.board];
  function search(player, depth, alpha, beta) {
    if (depth === 0) return evaluate(board, player);
    let best = -Infinity;
    for (const col of order) {
      const index = landing(board, col);
      if (index < 0) continue;
      board[index] = player;
      const value = winningLine(board, index).length
        ? 100000 + depth
        : -search(1 - player, depth - 1, -beta, -alpha);
      board[index] = null;
      best = Math.max(best, value);
      alpha = Math.max(alpha, value);
      if (alpha >= beta) break;
    }
    return best === -Infinity ? 0 : best;
  }
  let best = -Infinity,
    choice = null;
  for (const column of order) {
    const index = landing(board, column);
    if (index < 0) continue;
    board[index] = s.turn;
    const score = winningLine(board, index).length
      ? 200000
      : -search(1 - s.turn, 4, -Infinity, -best);
    board[index] = null;
    if (score > best) {
      best = score;
      choice = column;
    }
  }
  return { type: "drop", column: choice };
}
