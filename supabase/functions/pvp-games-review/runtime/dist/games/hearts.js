import {
  initial,
  deck,
  deal,
  take,
  sortHand,
  log,
  finish,
  requireThat,
  reduce,
  follow,
  winner,
  collect,
  names,
} from "./common.js";
export const points = (c) =>
  c.s === "H" ? 1 : c.s === "S" && c.r === 12 ? 13 : 0;
export function create(seed = 1) {
  const s = { ...initial(seed), scores: [0, 0, 0, 0], target: 100 };
  newRound(s);
  return s;
}
function newRound(s) {
  s.round++;
  deal(s, deck(Array.from({ length: 13 }, (_, i) => i + 2)), 13);
  s.taken = [0, 0, 0, 0];
  s.penalties = [0, 0, 0, 0];
  s.trick = [];
  s.lastTrick = [];
  s.trickNumber = 0;
  s.broken = false;
  s.passDirection = [1, 3, 2, 0][(s.round - 1) % 4];
  s.passed = [null, null, null, null];
  s.phase = s.passDirection ? "pass" : "play";
  s.turn = 0;
  if (!s.passDirection) startPlay(s);
  else
    log(
      s,
      `Pass three cards ${["", "left", "across", "right"][s.passDirection]}.`,
    );
}
function startPlay(s) {
  s.phase = "play";
  s.turn = s.hands.findIndex((h) => h.some((c) => c.s === "C" && c.r === 2));
  log(s, `${names[s.turn]} leads the two of clubs.`);
}
export function legalCards(s, p = s.turn) {
  if (s.phase !== "play" || s.over) return [];
  const hand = s.hands[p];
  if (s.trickNumber === 0 && !s.trick.length)
    return hand.filter((c) => c.s === "C" && c.r === 2);
  let legal = follow(hand, s.trick);
  if (!s.trick.length && !s.broken) {
    const nonHearts = legal.filter((c) => c.s !== "H");
    if (nonHearts.length) legal = nonHearts;
  }
  if (s.trickNumber === 0) {
    const nonPoints = legal.filter((c) => !points(c));
    if (nonPoints.length) legal = nonPoints;
  }
  return legal;
}
export function apply(s, a) {
  return reduce(s, a, (n, a) => {
    requireThat(!n.over, "Match finished.");
    if (a.type === "next") {
      requireThat(n.phase === "round", "Finish the hand first.");
      newRound(n);
      return;
    }
    if (a.type === "pass") {
      requireThat(n.phase === "pass", "Passing is not active.");
      const p = a.player ?? n.turn;
      requireThat(
        p >= 0 && p < 4 && !n.passed[p],
        "This player already passed.",
      );
      requireThat(
        a.ids.length === 3 &&
          new Set(a.ids).size === 3 &&
          a.ids.every((id) => n.hands[p].some((c) => c.id === id)),
        "Select three distinct cards.",
      );
      n.passed[p] = [...a.ids];
      if (n.passed.every(Boolean)) {
        const sent = n.passed.map((ids, p) =>
          ids.map((id) => take(n.hands[p], id)),
        );
        for (let p = 0; p < 4; p++)
          n.hands[(p + n.passDirection) % 4].push(...sent[p]);
        n.hands.forEach(sortHand);
        startPlay(n);
      }
      return;
    }
    requireThat(
      a.type === "play" && legalCards(n).some((c) => c.id === a.id),
      "Follow suit. No penalty cards on the opening trick if avoidable; hearts must be broken.",
    );
    const card = take(n.hands[n.turn], a.id);
    if (card.s === "H") n.broken = true;
    n.trick.push({ player: n.turn, card });
    if (n.trick.length === 4) {
      const win = winner(n.trick);
      n.penalties[win] += n.trick.reduce((sum, x) => sum + points(x.card), 0);
      collect(n, win);
      if (n.trickNumber === 13) {
        const moon = n.penalties.indexOf(26);
        const handPoints =
          moon >= 0
            ? n.penalties.map((_, p) => (p === moon ? 0 : 26))
            : n.penalties;
        n.scores = n.scores.map((v, p) => v + handPoints[p]);
        n.phase = "round";
        log(
          n,
          `${moon >= 0 ? names[moon] + " shoots the moon. " : ""}Hand points ${handPoints.join(" / ")}.`,
        );
        if (Math.max(...n.scores) >= 100) {
          const low = Math.min(...n.scores),
            winners = n.scores
              .map((v, p) => (v === low ? names[p] : null))
              .filter(Boolean);
          finish(
            n,
            `${winners.join(" and ")} ${winners.length > 1 ? "tie for the win" : "wins"} with ${low} points.`,
          );
        }
      }
    } else n.turn = (n.turn + 1) % 4;
  });
}
export function passChoice(s, p) {
  return [...s.hands[p]]
    .sort((a, b) => points(b) * 12 + b.r - (points(a) * 12 + a.r))
    .slice(0, 3)
    .map((c) => c.id);
}
export function bot(s, p = s.turn) {
  if (s.phase === "pass")
    return { type: "pass", player: p, ids: passChoice(s, p) };
  const legal = legalCards(s),
    led = s.trick[0]?.card.s;
  let choice;
  if (!s.trick.length) choice = [...legal].sort((a, b) => a.r - b.r)[0];
  else {
    const follows = legal.every((c) => c.s === led);
    if (follows) {
      const top = Math.max(
        ...s.trick.filter((x) => x.card.s === led).map((x) => x.card.r),
      );
      const under = legal.filter((c) => c.r < top);
      choice = [...(under.length ? under : legal)].sort((a, b) =>
        under.length ? b.r - a.r : a.r - b.r,
      )[0];
    } else
      choice = [...legal].sort(
        (a, b) => points(b) * 20 + b.r - (points(a) * 20 + a.r),
      )[0];
  }
  return { type: "play", id: choice.id };
}
