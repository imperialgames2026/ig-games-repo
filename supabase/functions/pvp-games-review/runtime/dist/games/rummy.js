import {
  initial,
  deal,
  deck,
  sortHand,
  take,
  pip,
  log,
  finish,
  requireThat,
  reduce,
} from "./common.js";
export function validMeld(cards) {
  if (cards.length < 3) return false;
  if (new Set(cards.map((c) => c.r)).size === 1)
    return (
      cards.length <= 4 && new Set(cards.map((c) => c.s)).size === cards.length
    );
  const sorted = [...cards].sort((a, b) => a.r - b.r);
  return (
    new Set(cards.map((c) => c.s)).size === 1 &&
    sorted.every((c, i) => !i || c.r === sorted[i - 1].r + 1)
  );
}
export function meldsFor(hand) {
  const results = [];
  for (let mask = 0; mask < 1 << hand.length; mask++) {
    const n = mask.toString(2).replaceAll("0", "").length;
    if (n < 3) continue;
    const cards = hand.filter((_, i) => mask & (1 << i));
    if (validMeld(cards)) results.push(cards);
  }
  return results.sort((a, b) => b.length - a.length);
}
export function create(seed = 1, players = 2) {
  requireThat([2, 6].includes(players), "Rummy supports two or six seats.");
  const s = { ...initial(seed), target: 100, players, scores: Array(players).fill(0) };
  newRound(s);
  return s;
}
function newRound(s) {
  s.round++;
  const players = s.players || 2;
  s.stock = deal(s, deck(), players === 2 ? 10 : 6, players);
  s.discard = [s.stock.pop()];
  s.melds = [];
  s.turn = (s.round - 1) % (s.players || 2);
  s.phase = "draw";
  s.picked = null;
  s.melded = false;
  log(s, `Round ${s.round}. Draw, optionally meld or lay off, then discard.`);
}
function won(s, p) {
  s.scores[p] += s.hands.reduce((total, h, i) => total + (i === p ? 0 : h.reduce((v,c) => v + pip(c),0)), 0);
  s.phase = "round";
  log(
    s,
    `${s.players === 6 ? "Seat " + (p + 1) : p === 0 ? "South" : "North"} goes out. Scores ${s.scores.join(" – ")}.`,
  );
  if (Math.max(...s.scores) >= s.target)
    finish(
      s,
      `${s.players === 6 ? "Seat " + (s.scores.indexOf(Math.max(...s.scores))+1) : s.scores[0] > s.scores[1] ? "South" : "North"} wins the match.`,
    );
}
export function apply(s, a) {
  return reduce(s, a, (n, a) => {
    requireThat(!n.over, "Match finished.");
    if (a.type === "next") {
      requireThat(n.phase === "round", "Finish the hand first.");
      newRound(n);
      return;
    }
    const p = n.turn,
      hand = n.hands[p];
    if (a.type === "draw") {
      requireThat(n.phase === "draw", "You already drew this turn.");
      if (a.source === "discard") {
        requireThat(n.discard.length, "Discard pile is empty.");
        const c = n.discard.pop();
        n.picked = c.id;
        hand.push(c);
      } else {
        requireThat(n.stock.length, "Stock exhausted.");
        hand.push(n.stock.pop());
        n.picked = null;
      }
      sortHand(hand);
      n.phase = "meld";
      n.melded = false;
      log(
        n,
        `${s.players === 6 ? "Seat " + (p + 1) : p === 0 ? "South" : "North"} draws from ${a.source === "discard" ? "discard" : "stock"}.`,
      );
    } else if (a.type === "meld") {
      requireThat(
        n.phase === "meld" && !n.melded,
        "Meld once per turn after drawing.",
      );
      requireThat(
        new Set(a.ids).size === a.ids.length,
        "Select distinct cards.",
      );
      const cards = a.ids.map((id) => hand.find((c) => c.id === id));
      requireThat(
        cards.every(Boolean) && validMeld(cards),
        "Use 3+ consecutive cards of one suit or 3–4 of the same rank.",
      );
      for (const c of cards) take(hand, c.id);
      n.melds.push({ owner: p, cards: cards.sort((a, b) => a.r - b.r) });
      n.melded = true;
      log(
        n,
        `${s.players === 6 ? "Seat " + (p + 1) : p === 0 ? "South" : "North"} lays down a ${cards.length}-card meld.`,
      );
      if (!hand.length) won(n, p);
    } else if (a.type === "layoff") {
      requireThat(n.phase === "meld", "Draw before laying off.");
      const card = hand.find((c) => c.id === a.id),
        m = n.melds[a.meld];
      requireThat(
        card && m && validMeld([...m.cards, card]),
        "That card does not extend this meld.",
      );
      take(hand, card.id);
      m.cards.push(card);
      m.cards.sort((a, b) => a.r - b.r);
      log(n, `${s.players === 6 ? "Seat " + (p + 1) : p === 0 ? "South" : "North"} extends meld ${a.meld + 1}.`);
      if (!hand.length) won(n, p);
    } else if (a.type === "discard") {
      requireThat(n.phase === "meld", "Draw before discarding.");
      requireThat(
        a.id !== n.picked,
        "You cannot return the discard you just picked up.",
      );
      n.discard.push(take(hand, a.id));
      log(n, `${s.players === 6 ? "Seat " + (p + 1) : p === 0 ? "South" : "North"} discards.`);
      if (!hand.length) {
        won(n, p);
        return;
      }
      n.turn = (p + 1) % (n.players || 2);
      n.phase = "draw";
      n.picked = null;
      if (!n.stock.length) {
        n.phase = "round";
        log(n, "Stock exhausted. Hand is a draw; scores are unchanged.");
      }
    } else throw new Error("Unknown action.");
  });
}
export function bot(s) {
  const hand = s.hands[s.turn];
  if (s.phase === "draw") {
    const top = s.discard.at(-1);
    const use =
      top &&
      meldsFor([...hand, top]).some((m) => m.some((c) => c.id === top.id));
    return { type: "draw", source: use ? "discard" : "stock" };
  }
  if (!s.melded) {
    const meld = meldsFor(hand)[0];
    if (meld) return { type: "meld", ids: meld.map((c) => c.id) };
  }
  for (let mi = 0; mi < s.melds.length; mi++)
    for (const c of hand)
      if (validMeld([...s.melds[mi].cards, c]))
        return { type: "layoff", id: c.id, meld: mi };
  const candidates = hand.filter((c) => c.id !== s.picked);
  const usefulness = (c) =>
    hand.filter(
      (x) =>
        x.id !== c.id &&
        (x.r === c.r || (x.s === c.s && Math.abs(x.r - c.r) <= 2)),
    ).length *
      10 -
    pip(c);
  candidates.sort((a, b) => usefulness(a) - usefulness(b));
  return { type: "discard", id: candidates[0].id };
}
