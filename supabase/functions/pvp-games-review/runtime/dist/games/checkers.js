import { initial, log, finish, requireThat, reduce } from "./common.js";
const inside = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
export function create(seed = 1) {
  const s = {
    ...initial(seed),
    board: Array(64).fill(null),
    turn: 0,
    forced: null,
    quiet: 0,
    positions: {},
    opponent: "computer",
  };
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if ((r + c) % 2 === 1 && (r < 3 || r > 4))
        s.board[r * 8 + c] = { player: r < 3 ? 1 : 0, king: false };
  log(s, "Red moves first. Captures are compulsory.");
  s.positions[key(s)] = 1;
  return s;
}
function key(s) {
  return (
    s.board
      .map((p) => (p ? `${p.player}${p.king ? "K" : "m"}` : "."))
      .join("") + s.turn
  );
}
function fromMoves(s, i, captures) {
  const p = s.board[i];
  if (!p || p.player !== s.turn) return [];
  const out = [],
    r = Math.floor(i / 8),
    c = i % 8;
  for (const dr of p.king ? [-1, 1] : [p.player === 0 ? -1 : 1])
    for (const dc of [-1, 1]) {
      const rr = r + dr,
        cc = c + dc;
      if (!inside(rr, cc)) continue;
      const mid = rr * 8 + cc;
      if (captures) {
        const tr = r + 2 * dr,
          tc = c + 2 * dc;
        if (
          inside(tr, tc) &&
          s.board[mid] &&
          s.board[mid].player !== p.player &&
          !s.board[tr * 8 + tc]
        )
          out.push({ from: i, to: tr * 8 + tc, capture: mid });
      } else if (!s.board[mid]) out.push({ from: i, to: mid });
    }
  return out;
}
export function legalMoves(s) {
  if (s.over) return [];
  if (s.forced !== null) return fromMoves(s, s.forced, true);
  const all = s.board.flatMap((_, i) => fromMoves(s, i, true));
  return all.length ? all : s.board.flatMap((_, i) => fromMoves(s, i, false));
}
export function apply(s, a) {
  return reduce(s, a, (n, a) => {
    requireThat(!n.over, "The match is finished.");
    const m = legalMoves(n).find((m) => m.from === a.from && m.to === a.to);
    requireThat(
      m,
      "Choose a legal move. A capture must be taken when available.",
    );
    const p = n.board[m.from];
    n.board[m.to] = p;
    n.board[m.from] = null;
    if (m.capture !== undefined) n.board[m.capture] = null;
    const crowned =
      !p.king && Math.floor(m.to / 8) === (p.player === 0 ? 0 : 7);
    if (crowned) p.king = true;
    n.quiet = m.capture !== undefined || crowned ? 0 : n.quiet + 1;
    log(
      n,
      `${n.turn === 0 ? "Red" : "Ivory"} ${m.capture !== undefined ? "jumps" : "moves"} ${m.from + 1} → ${m.to + 1}${crowned ? " and crowns a king" : ""}.`,
    );
    n.forced = null;
    if (
      m.capture !== undefined &&
      !crowned &&
      fromMoves(n, m.to, true).length
    ) {
      n.forced = m.to;
      return;
    }
    n.turn = 1 - n.turn;
    if (!legalMoves(n).length) {
      finish(
        n,
        `${n.turn === 0 ? "Ivory" : "Red"} wins — opponent has no legal move.`,
      );
      return;
    }
    const k = key(n);
    n.positions[k] = (n.positions[k] || 0) + 1;
    if (n.positions[k] >= 3 || n.quiet >= 80)
      finish(
        n,
        "Draw by repeated position or 40 moves without a capture or promotion.",
      );
  });
}
export function bot(s) {
  const moves = legalMoves(s);
  return moves.sort(
    (a, b) =>
      (b.capture !== undefined ? 100 : 0) +
      (Math.floor(b.to / 8) === 7 ? 30 : 0) -
      (a.capture !== undefined ? 100 : 0) -
      (Math.floor(a.to / 8) === 7 ? 30 : 0),
  )[0];
}
