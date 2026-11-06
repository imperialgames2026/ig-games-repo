import {
  initial,
  deck,
  deal,
  suits,
  sortHand,
  take,
  team,
  log,
  finish,
  requireThat,
  reduce,
  follow,
  winner,
  collect,
  names,
} from "./common.js";
export const sameColor = { C: "S", S: "C", D: "H", H: "D" };
export function effective(c, trump) {
  return c.r === 11 && c.s === sameColor[trump] ? trump : c.s;
}
export function strength(c, trump) {
  if (c.r === 11 && c.s === trump) return 30;
  if (c.r === 11 && c.s === sameColor[trump]) return 29;
  return c.r;
}
export function create(seed = 1) {
  const s = { ...initial(seed), target: 10, dealer: 3 };
  newRound(s);
  return s;
}
function newRound(s) {
  s.round++;
  const stock = deal(s, deck([9, 10, 11, 12, 13, 14]), 5);
  s.upcard = stock.pop();
  s.kitty = stock;
  s.trump = null;
  s.maker = null;
  s.alone = false;
  s.sittingOut = null;
  s.bidRound = 1;
  s.bidPasses = 0;
  s.turn = (s.dealer + 1) % 4;
  s.phase = "bid";
  s.trick = [];
  s.lastTrick = [];
  s.taken = [0, 0, 0, 0];
  s.trickNumber = 0;
  log(s, `Hand ${s.round}. Dealer: ${names[s.dealer]}. Upcard ${s.upcard.s}.`);
}
function next(s, p) {
  let q = (p + 1) % 4;
  if (q === s.sittingOut) q = (q + 1) % 4;
  return q;
}
function startPlay(s) {
  s.phase = "play";
  s.turn = next(s, s.dealer);
  log(s, `${names[s.maker]} calls ${s.trump}${s.alone ? " alone" : ""}.`);
}
export function legalCards(s, p = s.turn) {
  if (s.phase === "discard") return s.hands[p];
  if (s.phase !== "play" || s.over) return [];
  return follow(s.hands[p], s.trick, (c) => effective(c, s.trump));
}
export function bidOptions(s) {
  if (s.phase !== "bid") return [];
  return s.bidRound === 1
    ? [s.upcard.s]
    : suits.filter((suit) => suit !== s.upcard.s);
}
export function apply(s, a) {
  return reduce(s, a, (n, a) => {
    requireThat(!n.over, "Match finished.");
    if (a.type === "next") {
      requireThat(n.phase === "round", "Finish this hand first.");
      n.dealer = (n.dealer + 1) % 4;
      newRound(n);
      return;
    }
    if (a.type === "bid") {
      requireThat(n.phase === "bid", "Trump has already been selected.");
      if (a.suit === null) {
        requireThat(
          !(n.bidRound === 2 && n.turn === n.dealer),
          "Stick the dealer: dealer must choose a suit in round two.",
        );
        n.bidPasses++;
        n.turn = (n.turn + 1) % 4;
        if (n.bidPasses === 4) {
          n.bidPasses = 0;
          n.bidRound = 2;
          n.turn = (n.dealer + 1) % 4;
          log(n, "Upcard turned down. Name another suit.");
        }
        return;
      }
      requireThat(
        bidOptions(n).includes(a.suit),
        "That suit cannot be called in this bidding round.",
      );
      n.trump = a.suit;
      n.maker = n.turn;
      n.alone = !!a.alone;
      n.sittingOut = n.alone ? (n.maker + 2) % 4 : null;
      if (n.bidRound === 1) {
        n.hands[n.dealer].push(n.upcard);
        sortHand(n.hands[n.dealer]);
        n.phase = "discard";
        n.turn = n.dealer;
      } else startPlay(n);
    } else if (a.type === "discard") {
      requireThat(n.phase === "discard", "No dealer discard is pending.");
      n.buried = take(n.hands[n.dealer], a.id);
      startPlay(n);
    } else if (a.type === "play") {
      requireThat(
        legalCards(n).some((c) => c.id === a.id),
        "Follow the effective suit; the left bower is trump.",
      );
      n.trick.push({ player: n.turn, card: take(n.hands[n.turn], a.id) });
      log(n, `${names[n.turn]} plays a card.`);
      if (n.trick.length === (n.alone ? 3 : 4)) {
        const win = winner(
          n.trick,
          n.trump,
          (c) => effective(c, n.trump),
          (c) => strength(c, n.trump),
        );
        collect(n, win);
        if (n.trickNumber === 5) {
          const m = team(n.maker),
            tricks = n.taken[m] + n.taken[m + 2];
          const earned = tricks < 3 ? 2 : tricks === 5 ? (n.alone ? 4 : 2) : 1;
          const scoring = tricks < 3 ? 1 - m : m;
          n.scores[scoring] += earned;
          n.phase = "round";
          log(
            n,
            `${tricks < 3 ? "Euchred! " : ""}${scoring === 0 ? "South + North" : "West + East"} scores ${earned}. Match ${n.scores.join(" – ")}.`,
          );
          if (Math.max(...n.scores) >= 10)
            finish(
              n,
              `${n.scores[0] >= 10 ? "South + North" : "West + East"} wins.`,
            );
        }
      } else n.turn = next(n, n.turn);
    } else throw new Error("Unknown action.");
  });
}
export function bot(s) {
  const hand = s.hands[s.turn];
  if (s.phase === "bid") {
    const options = bidOptions(s)
      .map((suit) => ({
        suit,
        power: hand.reduce(
          (sum, c) =>
            sum +
            (effective(c, suit) === suit
              ? strength(c, suit)
              : c.r === 14
                ? 9
                : 0),
          0,
        ),
      }))
      .sort((a, b) => b.power - a.power);
    const best = options[0],
      forced = s.bidRound === 2 && s.turn === s.dealer;
    return {
      type: "bid",
      suit: forced || best.power >= 53 ? best.suit : null,
      alone: best.power >= 100,
    };
  }
  if (s.phase === "discard") {
    const sorted = [...hand].sort(
      (a, b) =>
        (effective(a, s.trump) === s.trump ? 100 : 0) +
        strength(a, s.trump) -
        (effective(b, s.trump) === s.trump ? 100 : 0) -
        strength(b, s.trump),
    );
    return { type: "discard", id: sorted[0].id };
  }
  const legal = legalCards(s),
    led = s.trick.length ? effective(s.trick[0].card, s.trump) : null;
  const cost = (c) =>
    (effective(c, s.trump) === s.trump
      ? 100
      : effective(c, s.trump) === led
        ? 40
        : 0) + strength(c, s.trump);
  const ordered = [...legal].sort((a, b) => cost(a) - cost(b));
  if (s.trick.length) {
    const current = winner(
      s.trick,
      s.trump,
      (c) => effective(c, s.trump),
      (c) => strength(c, s.trump),
    );
    if (team(current) !== team(s.turn)) {
      const winning = ordered.find(
        (c) =>
          winner(
            [...s.trick, { player: s.turn, card: c }],
            s.trump,
            (x) => effective(x, s.trump),
            (x) => strength(x, s.trump),
          ) === s.turn,
      );
      if (winning) return { type: "play", id: winning.id };
    }
  }
  return { type: "play", id: ordered[0].id };
}
