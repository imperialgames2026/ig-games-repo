import { Chess } from "../chess/vendor/chess.js";
import { chooseMove } from "../chess/engine.js";
import { outcome, pgnFor } from "../chess/match.js";
import { initial, log, requireThat, reduce } from "./common.js";
export function position(s) {
  const g = new Chess();
  if (s.pgn) g.loadPgn(s.pgn);
  return g;
}
function sync(s, g) {
  s.fen = g.fen();
  s.pgn = pgnFor(g, s.resigned);
  s.board = g.board().flat();
  s.turn = g.turn() === "w" ? 0 : 1;
  s.legal = g
    .moves({ verbose: true })
    .map((m) => ({ from: m.from, to: m.to, promotion: m.promotion }));
  const result = outcome(g, s.resigned);
  s.over = result.over;
  s.phase = s.over ? "finished" : "play";
  s.message = result.title + ". " + result.detail;
  s.result = result.result;
  s.last = g.history({ verbose: true }).at(-1) || null;
}
export function create(seed = 1) {
  const s = { ...initial(seed), resigned: null, pgn: "" };
  sync(s, new Chess());
  return s;
}
export function apply(s, a) {
  return reduce(s, a, (n, a) => {
    requireThat(!n.over, "Match finished.");
    const g = position(n);
    if (a.type === "resign") {
      n.resigned = g.turn();
      log(n, `${g.turn() === "w" ? "White" : "Black"} resigned.`);
    } else {
      requireThat(a.type === "play", "Choose a chess move.");
      const m = g.move({
        from: a.from,
        to: a.to,
        ...(a.promotion ? { promotion: a.promotion } : {}),
      });
      requireThat(m, "Illegal chess move.");
      log(n, m.san);
    }
    sync(n, g);
  });
}
export function bot(s) {
  return { type: "play", ...chooseMove(s.fen, 2, 250) };
}
