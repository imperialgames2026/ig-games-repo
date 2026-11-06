import {
  initial,
  deck,
  deal,
  suits,
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
export const strength = (c) => [9, 11, 12, 13, 10, 14].indexOf(c.r);
export function meldScore(hand, trump) {
  const count = (s, r) => hand.filter((c) => c.s === s && c.r === r).length;
  let score = 0;
  const runs = Math.min(...[14, 10, 13, 12, 11].map((r) => count(trump, r)));
  score += runs === 2 ? 150 : runs === 1 ? 15 : 0;
  for (const suit of suits) {
    let pairs = Math.min(count(suit, 13), count(suit, 12));
    if (suit === trump) pairs -= runs;
    score += pairs * (suit === trump ? 4 : 2);
  }
  const pinochles = Math.min(count("S", 12), count("D", 11));
  score += pinochles === 2 ? 30 : pinochles === 1 ? 4 : 0;
  for (const [r, single, double] of [
    [14, 10, 100],
    [13, 8, 80],
    [12, 6, 60],
    [11, 4, 40],
  ]) {
    const n = Math.min(...suits.map((s) => count(s, r)));
    score += n === 2 ? double : n === 1 ? single : 0;
  }
  score += count(trump, 9);
  return score;
}
export function create(seed = 1) {
  const s = { ...initial(seed), dealer: 3, target: 150 };
  newRound(s);
  return s;
}
function newRound(s) {
  s.round++;
  deal(s, deck([9, 11, 12, 13, 10, 14], 2), 12);
  s.phase = "bid";
  s.turn = (s.dealer + 1) % 4;
  s.bid = 24;
  s.bidder = null;
  s.passed = [false, false, false, false];
  s.trump = null;
  s.meld = [0, 0, 0, 0];
  s.trick = [];
  s.lastTrick = [];
  s.taken = [0, 0, 0, 0];
  s.counters = [0, 0, 0, 0];
  s.trickNumber = 0;
  log(
    s,
    `Hand ${s.round}. Auction opens at 25. Single deck, no partner card exchange.`,
  );
}
function advanceBid(s) {
  if (s.passed.filter(Boolean).length >= 3 && s.bidder !== null) {
    s.phase = "trump";
    s.turn = s.bidder;
    log(s, `${names[s.bidder]} wins the bid at ${s.bid}. Choose trump.`);
    return;
  }
  if (s.passed.every(Boolean)) {
    s.bidder = s.dealer;
    s.bid = 25;
    s.phase = "trump";
    s.turn = s.dealer;
    return;
  }
  do {
    s.turn = (s.turn + 1) % 4;
  } while (s.passed[s.turn]);
}
export function legalCards(s, p = s.turn) {
  if (s.phase !== "play" || s.over) return [];
  const hand = s.hands[p];
  if (!s.trick.length) return hand;
  const led = s.trick[0].card.s,
    matching = hand.filter((c) => c.s === led),
    trumps = hand.filter((c) => c.s === s.trump);
  const candidates = matching.length ? matching : trumps.length ? trumps : hand;
  const winning = candidates.filter(
    (c) =>
      winner(
        [...s.trick, { player: p, card: c }],
        s.trump,
        (c) => c.s,
        strength,
      ) === p,
  );
  return winning.length ? winning : candidates;
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
      requireThat(n.phase === "bid", "Bidding is closed.");
      if (a.amount === null) {
        n.passed[n.turn] = true;
        log(n, `${names[n.turn]} passes.`);
      } else {
        requireThat(
          Number.isInteger(a.amount) &&
            a.amount >= Math.max(25, n.bid + 1) &&
            a.amount <= 250,
          "Bid a whole number above the current bid, up to 250.",
        );
        n.bid = a.amount;
        n.bidder = n.turn;
        log(n, `${names[n.turn]} bids ${n.bid}.`);
      }
      advanceBid(n);
    } else if (a.type === "trump") {
      requireThat(
        n.phase === "trump" && suits.includes(a.suit),
        "Choose a trump suit.",
      );
      n.trump = a.suit;
      n.meld = n.hands.map((h) => meldScore(h, n.trump));
      n.phase = "play";
      n.turn = n.bidder;
      log(n, `Trump ${n.trump}. Meld: ${n.meld.join(" / ")}. Bidder leads.`);
    } else if (a.type === "play") {
      requireThat(
        legalCards(n).some((c) => c.id === a.id),
        "Follow suit and head the trick if able; otherwise trump and overtrump if able.",
      );
      n.trick.push({ player: n.turn, card: take(n.hands[n.turn], a.id) });
      if (n.trick.length === 4) {
        const win = winner(n.trick, n.trump, (c) => c.s, strength);
        n.counters[win] += n.trick.filter((x) =>
          [14, 10, 13].includes(x.card.r),
        ).length;
        if (n.trickNumber === 11) n.counters[win]++;
        collect(n, win);
        if (n.trickNumber === 12) {
          const bidTeam = team(n.bidder),
            earned = [0, 0];
          for (let p = 0; p < 4; p++) earned[p % 2] += n.counters[p];
          for (let t = 0; t < 2; t++)
            if (n.taken[t] + n.taken[t + 2] > 0)
              earned[t] += n.meld[t] + n.meld[t + 2];
          for (let t = 0; t < 2; t++)
            n.scores[t] +=
              t === bidTeam && earned[t] < n.bid ? -n.bid : earned[t];
          n.phase = "round";
          log(
            n,
            `${earned[bidTeam] < n.bid ? "Contract set. " : ""}Hand totals ${earned.join(" – ")}. Scores ${n.scores.join(" – ")}.`,
          );
          if (Math.max(...n.scores) >= n.target) {
            const winTeam =
              n.scores[bidTeam] >= n.target ? bidTeam : 1 - bidTeam;
            finish(
              n,
              `${winTeam === 0 ? "South + North" : "West + East"} wins.`,
            );
          }
        }
      } else n.turn = (n.turn + 1) % 4;
    } else throw new Error("Unknown action.");
  });
}
export function bot(s) {
  const hand = s.hands[s.turn];
  if (s.phase === "bid") {
    const best = Math.max(
      ...suits.map(
        (suit) =>
          meldScore(hand, suit) +
          hand.filter((c) => c.s === suit).length * 3 +
          12,
      ),
    );
    return {
      type: "bid",
      amount: s.bid < Math.min(best, 70) ? Math.max(25, s.bid + 1) : null,
    };
  }
  if (s.phase === "trump") {
    const best = suits
      .map((suit) => ({
        suit,
        score:
          meldScore(hand, suit) + hand.filter((c) => c.s === suit).length * 3,
      }))
      .sort((a, b) => b.score - a.score)[0];
    return { type: "trump", suit: best.suit };
  }
  const legal = legalCards(s);
  return {
    type: "play",
    id: [...legal].sort(
      (a, b) =>
        (a.s === s.trump ? 10 : 0) +
        strength(a) -
        (b.s === s.trump ? 10 : 0) -
        strength(b),
    )[0].id,
  };
}
